import {
  configureSharedMcpTestClient,
  getSharedMcpTestClient,
  resetSharedMcpTestClient,
} from '../src/sharedClient';

beforeEach(() => {
  resetSharedMcpTestClient();
});

afterEach(() => {
  resetSharedMcpTestClient();
});

test('getSharedMcpTestClient throws when no shared client config exists', () => {
  expect(() => getSharedMcpTestClient()).toThrow(
    'Shared MCP test client is not configured. Call configureSharedMcpTestClient() first.',
  );
});

test('configureSharedMcpTestClient is idempotent for the same connection details', () => {
  configureSharedMcpTestClient({ baseUrl: 'http://localhost:4000', timeoutMs: 1000 });

  expect(() => configureSharedMcpTestClient({ baseUrl: 'http://localhost:4000', timeoutMs: 1000 })).not.toThrow();
});

test('configureSharedMcpTestClient rejects conflicting connection details', () => {
  configureSharedMcpTestClient({ baseUrl: 'http://localhost:4000' });

  expect(() => configureSharedMcpTestClient({ baseUrl: 'http://localhost:5000' })).toThrow(
    'Shared MCP test client has already been configured with different connection details.',
  );
});