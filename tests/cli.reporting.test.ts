import fs from 'fs';
import os from 'os';
import path from 'path';

type LoadCliOptions = {
  preflightError?: string;
  jestExitCode?: number;
  jestSuccess?: boolean;
  jestJson?: Record<string, unknown> | null;
  spawnError?: string;
};

type LoadedCli = {
  runCli: typeof import('../src/cli').runCli;
  spawnSyncMock: jest.Mock;
};

const ORIGINAL_ENV = {...process.env};
const ORIGINAL_CWD = process.cwd();

function createJestJsonResult(success: boolean): Record<string, unknown> {
  return {
    success,
    startTime: 1711711711000,
    numTotalTests: 2,
    numPassedTests: success ? 2 : 1,
    numFailedTests: success ? 0 : 1,
    numPendingTests: 0,
    numTodoTests: 0,
    numTotalTestSuites: 1,
    numPassedTestSuites: success ? 1 : 0,
    numFailedTestSuites: success ? 0 : 1,
    testResults: [
      {
        name: 'tests/integration/weatherTools.test.ts',
        status: success ? 'passed' : 'failed',
        message: success ? '' : 'Expected forecast to match',
        perfStats: {runtime: 42},
        assertionResults: [
          {
            ancestorTitles: ['weather.current'],
            title: 'returns a forecast',
            fullName: 'weather.current returns a forecast',
            status: 'passed',
            duration: 8,
            failureMessages: [],
          },
          {
            ancestorTitles: ['weather.current'],
            title: 'returns the expected city',
            fullName: 'weather.current returns the expected city',
            status: success ? 'passed' : 'failed',
            duration: 5,
            failureMessages: success ? [] : ['Expected: Montreal\nReceived: Toronto'],
          },
        ],
      },
    ],
  };
}

async function loadCli(options: LoadCliOptions = {}): Promise<LoadedCli> {
  jest.resetModules();

  const spawnSyncMock = jest.fn((_command: string, args: string[]) => {
    const outputFileIndex = args.indexOf('--outputFile');
    const outputFilePath = outputFileIndex >= 0 ? String(args[outputFileIndex + 1]) : '';

    if (options.jestJson !== null && outputFilePath) {
      const jsonPayload = options.jestJson ?? createJestJsonResult(options.jestSuccess ?? true);
      fs.mkdirSync(path.dirname(outputFilePath), {recursive: true});
      fs.writeFileSync(outputFilePath, JSON.stringify(jsonPayload), 'utf8');
    }

    return {
      status: options.jestExitCode ?? 0,
      error: options.spawnError ? new Error(options.spawnError) : undefined,
    };
  });

  const clientFactory = jest.fn(() => ({
    connect: options.preflightError ? jest.fn().mockRejectedValue(new Error(options.preflightError)) : jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getServerInfo: jest.fn().mockResolvedValue({name: 'preflight-server', version: '1.0.0'}),
    listTools: jest.fn().mockResolvedValue([{name: 'weather.current', title: 'Weather', description: 'Current weather lookup'}]),
    listResources: jest.fn().mockResolvedValue([
      {
        name: 'forecast-city',
        uri: 'resource://weather/forecast/{city}',
        mimeType: 'application/json',
        description: 'Weather forecast by city',
      },
    ]),
    listPrompts: jest.fn().mockResolvedValue([
      {
        name: 'weather-summary',
        argumentCount: 1,
        description: 'Summarize weather conditions for a city.',
      },
    ]),
  }));

  jest.doMock('child_process', () => ({spawnSync: spawnSyncMock}));
  jest.doMock('../src/env', () => ({
    loadSharedMcpTestClientConfigFromEnv: jest.fn(() => ({baseUrl: 'http://127.0.0.1:36719'})),
  }));
  jest.doMock('../src/mcpTestClient', () => ({McpTestClient: clientFactory}));

  const cliModule = jest.requireActual('../src/cli') as typeof import('../src/cli');
  return {
    runCli: cliModule.runCli,
    spawnSyncMock,
  };
}

function readGeneratedReport(tempDir: string): string {
  const reportsDir = path.join(tempDir, 'mcproof-reports');
  const files = fs.readdirSync(reportsDir);
  expect(files).toHaveLength(1);
  expect(files[0].startsWith('mcproof-report-')).toBe(true);
  return fs.readFileSync(path.join(reportsDir, files[0]), 'utf8');
}

describe('CLI HTML reporting', () => {
  let tempDir: string;

  beforeEach(() => {
    process.env = {...ORIGINAL_ENV};
    delete process.env.MCPROOF_SKIP_PREFLIGHT;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcproof-cli-report-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    process.env = ORIGINAL_ENV;
    fs.rmSync(tempDir, {recursive: true, force: true});
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('../src/env');
    jest.unmock('../src/mcpTestClient');
    jest.unmock('child_process');
  });

  test('runCli writes an HTML report with preflight metadata and individual test results', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown): void => {
      logs.push(String(message));
    };

    try {
      const {runCli, spawnSyncMock} = await loadCli();
      const exitCode = await runCli(['test']);

      expect(exitCode).toBe(0);
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock.mock.calls[0][1]).toEqual(expect.arrayContaining(['--forceExit']));
      expect(logs.some(line => line.includes('Report:'))).toBe(true);

      const html = readGeneratedReport(tempDir);
      expect(html).toContain('MCProof Report 🛡️');
      expect(html).toContain('Overall status</dt><dd><span class="status-badge status-success">success</span>');
      expect(html).toContain('preflight-server');
      expect(html).toContain('http://127.0.0.1:36719');
      expect(html).toContain('weather.current');
      expect(html).toContain('forecast-city');
      expect(html).toContain('weather-summary');
      expect(html).toContain('Server Information');
      expect(html).toContain('Status</dt><dd><span class="status-badge status-success">success</span>');
      expect(html).toContain('Test Summary');
      expect(html).toContain('Detailed Test Results');
      expect(html).toContain('tests/integration/weatherTools.test.ts');
      expect(html).toContain('weather.current returns the expected city');
      expect(html).not.toContain('Exit code');
      expect(html).toContain('Total tests');
      expect(html.indexOf('Total suites')).toBeLessThan(html.indexOf('Total tests'));
      expect(html.indexOf('Passed suites')).toBeLessThan(html.indexOf('Passed tests'));
      expect(html.indexOf('Failed suites')).toBeLessThan(html.indexOf('Failed tests'));
      expect(html).toContain('Duration</dt><dd>42 ms</dd>');
    } finally {
      console.log = originalLog;
    }
  });

  test('runCli writes a failed report when preflight fails before Jest starts', async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (message?: unknown): void => {
      errors.push(String(message));
    };

    try {
      const {runCli, spawnSyncMock} = await loadCli({preflightError: 'Unable to connect to MCP endpoint'});
      const exitCode = await runCli(['test']);

      expect(exitCode).toBe(1);
      expect(spawnSyncMock).not.toHaveBeenCalled();
      expect(errors.some(line => line.includes('Unable to connect to MCP endpoint'))).toBe(true);

      const html = readGeneratedReport(tempDir);
      expect(html).toContain('failed');
      expect(html).toContain('Unable to connect to MCP endpoint');
      expect(html).toContain('Tests were not executed to completion.');
    } finally {
      console.error = originalError;
    }
  });

  test('runCli writes a failed report when Jest reports failing tests', async () => {
    const {runCli} = await loadCli({
      jestExitCode: 1,
      jestSuccess: false,
    });

    const exitCode = await runCli(['test']);

    expect(exitCode).toBe(1);

    const html = readGeneratedReport(tempDir);
    expect(html).toContain('Expected forecast to match');
    expect(html).toContain('Expected: Montreal');
    expect(html).toContain('Received: Toronto');
    expect(html).toContain('Failed tests');
  });
});