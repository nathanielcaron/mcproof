import path from 'path';
import {spawnSync} from 'child_process';
import {loadSharedMcpTestClientConfigFromEnv} from './env';
import {McpTestClient} from './mcpTestClient';

function printUsage(): void {
  console.log('Usage: mcproof test [jest-args]');
}

function resolveJestBin(): string {
  try {
    return require.resolve('jest/bin/jest');
  } catch {
    throw new Error('Unable to resolve Jest. Ensure mcproof and its runtime dependencies are installed correctly.');
  }
}

function runTestCommand(args: string[]): number {
  const jestBin = resolveJestBin();
  const presetPath = path.resolve(__dirname, 'jestPreset.js');
  const result = spawnSync(process.execPath, [jestBin, '--config', presetPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}

async function runPreflight(): Promise<number> {
  if (process.env.MCPROOF_SKIP_PREFLIGHT === '1') {
    return 0;
  }

  const config = loadSharedMcpTestClientConfigFromEnv();
  const client = new McpTestClient(config);

  try {
    await client.connect();
    console.log(`[mcproof] Successfully connected to MCP server at ${config.baseUrl}`);

    const tools = await client.listAvailableTools();
    if (tools.length > 0) {
      console.log(`[mcproof] Available MCP tools: ${tools.join(', ')}`);
    } else {
      console.log(
        '[mcproof] Connected. Tool discovery returned no list (the server may not support tools/list), continuing with tests.',
      );
    }

    console.log('[mcproof] Executing tests...');
    return 0;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`[mcproof] ${error.message}`);
    } else {
      console.error('[mcproof] Failed preflight check before running tests.');
    }

    return 1;
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

  if (command !== 'test') {
    console.error(`Unknown command: ${command}`);
    printUsage();
    return 1;
  }

  const preflightExitCode = await runPreflight();
  if (preflightExitCode !== 0) {
    return preflightExitCode;
  }

  return runTestCommand(rest);
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