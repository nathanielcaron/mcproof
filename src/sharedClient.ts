import {McpTestClient} from './mcpTestClient';
import {McpSharedClientConfig} from './types';

interface SharedMcpClientState {
  config?: McpSharedClientConfig;
  client?: McpTestClient;
  initialized: boolean;
}

const SHARED_STATE_KEY = Symbol.for('mcproof.sharedClientState');

function getSharedState(): SharedMcpClientState {
  const processWithState = process as NodeJS.Process & {
    [SHARED_STATE_KEY]?: SharedMcpClientState;
  };

  if (!processWithState[SHARED_STATE_KEY]) {
    processWithState[SHARED_STATE_KEY] = {
      initialized: false,
    };
  }

  return processWithState[SHARED_STATE_KEY] as SharedMcpClientState;
}

function cloneConfig(config: McpSharedClientConfig): McpSharedClientConfig {
  return {
    ...config,
    headers: config.headers ? { ...config.headers } : undefined,
  };
}

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.keys(headers)
    .sort()
    .reduce<Record<string, string>>((result, key) => {
      result[key] = headers[key];
      return result;
    }, {});
}

function areConfigsEqual(left?: McpSharedClientConfig, right?: McpSharedClientConfig): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.baseUrl === right.baseUrl &&
    left.timeoutMs === right.timeoutMs &&
    JSON.stringify(normalizeHeaders(left.headers)) === JSON.stringify(normalizeHeaders(right.headers))
  );
}

export function configureSharedMcpTestClient(config: McpSharedClientConfig): void {
  const state = getSharedState();

  if (state.config && !areConfigsEqual(state.config, config)) {
    throw new Error('Shared MCP test client has already been configured with different connection details.');
  }

  state.config = cloneConfig(config);
}

export function getSharedMcpTestClient(): McpTestClient {
  const state = getSharedState();

  if (!state.config) {
    throw new Error('Shared MCP test client is not configured. Call configureSharedMcpTestClient() first.');
  }

  if (!state.client) {
    state.client = new McpTestClient(state.config);
  }

  return state.client;
}

export async function initializeSharedMcpTestClient(): Promise<McpTestClient> {
  const state = getSharedState();
  const client = getSharedMcpTestClient();

  if (!state.initialized) {
    await client.connect();
    state.initialized = true;
  }

  return client;
}

export async function disconnectSharedMcpTestClient(): Promise<void> {
  const state = getSharedState();

  if (state.client && state.initialized) {
    await state.client.disconnect();
  }

  state.initialized = false;
}

export function resetSharedMcpTestClient(): void {
  const state = getSharedState();

  state.client = undefined;
  state.config = undefined;
  state.initialized = false;
}

export function installSharedMcpTestClient(config: McpSharedClientConfig): void {
  const jestGlobals = globalThis as {
    beforeAll?: (callback: () => Promise<void> | void) => void;
    afterAll?: (callback: () => Promise<void> | void) => void;
  };

  configureSharedMcpTestClient(config);

  if (typeof jestGlobals.beforeAll === 'function') {
    jestGlobals.beforeAll(async () => {
      await initializeSharedMcpTestClient();
    });

    if (typeof jestGlobals.afterAll === 'function') {
      jestGlobals.afterAll(async () => {
        await disconnectSharedMcpTestClient();
        resetSharedMcpTestClient();
      });
    }

    return;
  }

  void initializeSharedMcpTestClient();
}