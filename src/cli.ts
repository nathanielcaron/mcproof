import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';
import {version as packageVersion} from '../package.json';
import {loadSharedMcpTestClientConfigFromEnv} from './env';
import {McpTestClient} from './mcpTestClient';
import {McproofHtmlReport, McproofReportPreflight, McproofReportSuite, McproofReportTests, writeHtmlReport} from './reporting';
import {McpPromptDescriptor, McpResourceDescriptor, McpToolDescriptor} from './types';

type JestJsonAssertionResult = {
  ancestorTitles?: string[];
  title: string;
  fullName?: string;
  status: string;
  duration?: number | null;
  failureMessages?: string[];
};

type JestJsonSuiteResult = {
  name: string;
  status: string;
  message?: string;
  assertionResults?: JestJsonAssertionResult[];
  perfStats?: {
    start?: number;
    end?: number;
    runtime?: number;
  };
};

type JestJsonOutput = {
  success: boolean;
  startTime?: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  testResults?: JestJsonSuiteResult[];
};

type PreflightExecutionResult = {
  exitCode: number;
  report: McproofReportPreflight;
};

function getPackageVersion(): string {
  return packageVersion;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function renderTable(title: string, headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    return;
  }

  console.log(`\n[mcproof] ${title}`);

  const maxCellWidth = 48;
  const widths = headers.map((header, columnIndex) => {
    const longestCell = rows.reduce((maxLength, row) => {
      const cell = row[columnIndex] ?? '';
      return Math.max(maxLength, truncate(cell, maxCellWidth).length);
    }, header.length);

    return Math.min(Math.max(longestCell, header.length), maxCellWidth);
  });

  const horizontalRule = widths.map(width => '-'.repeat(width + 2)).join('+');
  const formatRow = (row: string[]): string => {
    return widths
      .map((width, columnIndex) => {
        const cell = truncate(row[columnIndex] ?? '', maxCellWidth);
        return ` ${cell.padEnd(width, ' ')} `;
      })
      .join('|');
  };

  console.log(`[mcproof]   ${horizontalRule}`);
  console.log(`[mcproof]   ${formatRow(headers)}`);
  console.log(`[mcproof]   ${horizontalRule}`);
  rows.forEach(row => {
    console.log(`[mcproof]   ${formatRow(row)}`);
  });
  console.log(`[mcproof]   ${horizontalRule}`);
}

function toolRows(tools: McpToolDescriptor[]): string[][] {
  return tools.map(tool => [tool.name, tool.title ?? '', tool.description ?? '']);
}

function resourceRows(resources: McpResourceDescriptor[]): string[][] {
  return resources.map(resource => [resource.name, resource.uri, resource.mimeType ?? '', resource.description ?? '']);
}

function promptRows(prompts: McpPromptDescriptor[]): string[][] {
  return prompts.map(prompt => [prompt.name, String(prompt.argumentCount), prompt.description ?? '']);
}

function printUsage(): void {
  console.log('Usage: mcproof [--help|-h] [--version|-v] test [jest-args]');
}

function printVersion(): void {
  console.log(getPackageVersion());
}

function formatErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function createJestOutputPath(): {directory: string; filePath: string} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcproof-jest-'));
  return {
    directory,
    filePath: path.join(directory, 'results.json'),
  };
}

function parseJestSuiteDuration(suite: JestJsonSuiteResult): number | undefined {
  if (suite.perfStats?.runtime !== undefined) {
    return suite.perfStats.runtime;
  }

  if (suite.perfStats?.start !== undefined && suite.perfStats.end !== undefined) {
    return suite.perfStats.end - suite.perfStats.start;
  }

  const assertionDuration = (suite.assertionResults ?? []).reduce((total, assertion) => total + (assertion.duration ?? 0), 0);

  if (assertionDuration > 0) {
    return assertionDuration;
  }

  return undefined;
}

function mapJestSuites(suites: JestJsonSuiteResult[] = []): McproofReportSuite[] {
  return suites.map(suite => ({
    name: suite.name,
    status: suite.status,
    message: suite.message,
    durationMs: parseJestSuiteDuration(suite),
    testCases: (suite.assertionResults ?? []).map(assertion => ({
      title: assertion.title,
      fullName: assertion.fullName ?? [...(assertion.ancestorTitles ?? []), assertion.title].join(' '),
      status: assertion.status,
      durationMs: assertion.duration ?? undefined,
      failureMessages: assertion.failureMessages ?? [],
    })),
  }));
}

function readJestResults(outputPath: string, exitCode: number, spawnError?: string): McproofReportTests {
  if (spawnError) {
    return {
      status: 'unavailable',
      exitCode,
      errorMessage: spawnError,
      suites: [],
    };
  }

  if (!fs.existsSync(outputPath)) {
    return {
      status: exitCode === 0 ? 'not-run' : 'unavailable',
      exitCode,
      errorMessage: exitCode === 0 ? 'Jest exited without producing structured test results.' : 'Jest did not produce a structured results file.',
      suites: [],
    };
  }

  try {
    const json = fs.readFileSync(outputPath, 'utf8');
    const parsed = JSON.parse(json) as JestJsonOutput;
    const suites = mapJestSuites(parsed.testResults);
    const suiteDurations = suites.reduce((total, suite) => total + (suite.durationMs ?? 0), 0);

    return {
      status: 'completed',
      exitCode,
      success: parsed.success,
      durationMs: suiteDurations > 0 ? suiteDurations : undefined,
      numTotalTests: parsed.numTotalTests,
      numPassedTests: parsed.numPassedTests,
      numFailedTests: parsed.numFailedTests,
      numPendingTests: parsed.numPendingTests,
      numTodoTests: parsed.numTodoTests,
      numTotalTestSuites: parsed.numTotalTestSuites,
      numPassedTestSuites: parsed.numPassedTestSuites,
      numFailedTestSuites: parsed.numFailedTestSuites,
      suites,
    };
  } catch (error: unknown) {
    return {
      status: 'unavailable',
      exitCode,
      errorMessage: formatErrorMessage(error, 'Unable to parse Jest results.'),
      suites: [],
    };
  }
}

function determineOverallStatus(preflight: McproofReportPreflight, tests: McproofReportTests): 'passed' | 'failed' {
  if (preflight.status === 'failed') {
    return 'failed';
  }

  if (tests.status === 'completed') {
    return tests.success ? 'passed' : 'failed';
  }

  return tests.status === 'not-run' ? 'passed' : 'failed';
}

function writeRunReport(report: McproofHtmlReport): void {
  try {
    const reportPath = writeHtmlReport(report);
    console.log(`\n[mcproof] Report: ${reportPath}\n`);
  } catch (error: unknown) {
    console.error(`[mcproof] Failed to write HTML report: ${formatErrorMessage(error, 'unknown error')}`);
  }
}

function resolveJestBin(): string {
  try {
    return require.resolve('jest/bin/jest');
  } catch {
    throw new Error('Unable to resolve Jest. Ensure mcproof and its runtime dependencies are installed correctly.');
  }
}

function runTestCommand(args: string[]): McproofReportTests {
  const jestBin = resolveJestBin();
  const presetPath = path.resolve(__dirname, 'jestPreset.js');
  const jestOutput = createJestOutputPath();
  const result = spawnSync(
    process.execPath,
    [jestBin, '--config', presetPath, '--runInBand', ...args, '--json', '--outputFile', jestOutput.filePath],
    {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    },
  );

  const testResults = readJestResults(jestOutput.filePath, result.status ?? 1, result.error?.message);

  try {
    fs.rmSync(jestOutput.directory, {recursive: true, force: true});
  } catch {
    // Ignore cleanup failures for temporary result directories.
  }

  if (result.error) {
    console.error(result.error.message);
  }

  return testResults;
}

async function runPreflight(): Promise<PreflightExecutionResult> {
  if (process.env.MCPROOF_SKIP_PREFLIGHT === '1') {
    return {
      exitCode: 0,
      report: {
        status: 'skipped',
        tools: [],
        resources: [],
        prompts: [],
      },
    };
  }

  let config;

  try {
    config = loadSharedMcpTestClientConfigFromEnv();
  } catch (error: unknown) {
    const errorMessage = formatErrorMessage(error, 'Failed to load MCProof environment configuration.');
    console.error(`[mcproof] ${errorMessage}`);
    return {
      exitCode: 1,
      report: {
        status: 'failed',
        errorMessage,
        tools: [],
        resources: [],
        prompts: [],
      },
    };
  }

  const client = new McpTestClient(config);

  try {
    await client.connect();
    const serverInfo = await client.getServerInfo();
    const tools = await client.listTools();
    const resources = await client.listResources();
    const prompts = await client.listPrompts();

    console.log('\n[mcproof]      MCProof 🛡️      \n');
    console.log(`[mcproof] MCP endpoint: ${config.baseUrl}`);
    console.log(`[mcproof] MCP server: ${serverInfo.name ?? 'unknown'} v${serverInfo.version ?? 'unknown'}`);
    renderTable('Tools', ['Name', 'Title', 'Description'], toolRows(tools));
    renderTable('Resources', ['Name', 'URI', 'MIME Type', 'Description'], resourceRows(resources));
    renderTable('Prompts', ['Name', 'Args', 'Description'], promptRows(prompts));
    console.log('\n[mcproof] Executing tests...\n');
    return {
      exitCode: 0,
      report: {
        status: 'passed',
        endpoint: config.baseUrl,
        serverInfo,
        tools,
        resources,
        prompts,
      },
    };
  } catch (error: unknown) {
    const errorMessage = formatErrorMessage(error, 'Failed preflight check before running tests.');
    console.error(`[mcproof] ${errorMessage}`);

    return {
      exitCode: 1,
      report: {
        status: 'failed',
        endpoint: config.baseUrl,
        errorMessage,
        tools: [],
        resources: [],
        prompts: [],
      },
    };
  } finally {
    await client.disconnect();
  }
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;

  if (!command) {
    printUsage();
    return 1;
  }

  if (command === '--help' || command === '-h') {
    printUsage();
    return 0;
  }

  if (command === '--version' || command === '-v') {
    printVersion();
    return 0;
  }

  if (command !== 'test') {
    console.error(`Unknown command: ${command}`);
    printUsage();
    return 1;
  }

  const generatedAt = new Date().toISOString();
  const preflightResult = await runPreflight();

  if (preflightResult.exitCode !== 0) {
    writeRunReport({
      generatedAt,
      packageVersion: getPackageVersion(),
      workingDirectory: process.cwd(),
      command: ['mcproof', ...argv],
      overallStatus: 'failed',
      preflight: preflightResult.report,
      tests: {
        status: 'not-run',
        suites: [],
      },
    });
    return preflightResult.exitCode;
  }

  const tests = runTestCommand(rest);
  writeRunReport({
    generatedAt,
    packageVersion: getPackageVersion(),
    workingDirectory: process.cwd(),
    command: ['mcproof', ...argv],
    overallStatus: determineOverallStatus(preflightResult.report, tests),
    preflight: preflightResult.report,
    tests,
  });

  return tests.exitCode ?? 1;
}

if (require.main === module) {
  runCli()
    .then(code => {
      process.exit(code);
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}