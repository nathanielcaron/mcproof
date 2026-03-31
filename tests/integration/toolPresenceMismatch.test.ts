import {
  configureSharedMcpTestClient,
  disconnectSharedMcpTestClient,
  expectTool,
  expectToolCallError,
  expectToolCallSuccess,
  getSharedMcpTestClient,
  initializeSharedMcpTestClient,
  resetSharedMcpTestClient,
} from '../../src';
import {startMockMcpServer, stopMockMcpServer} from './mockServer';

beforeAll(async () => {
  const baseUrl = await startMockMcpServer();

  resetSharedMcpTestClient();
  configureSharedMcpTestClient({
    baseUrl,
    timeoutMs: 5000,
    headers: {Authorization: 'Bearer suite-token'},
  });
  await initializeSharedMcpTestClient();
});

afterAll(async () => {
  await disconnectSharedMcpTestClient();
  resetSharedMcpTestClient();
  await stopMockMcpServer();
});

test('missing tool fails both discovery and invocation checks', async () => {
  const client = getSharedMcpTestClient();

  await expect(expectTool(client, 'weather.forecast')).rejects.toThrow(
    "Expected MCP server to expose tool 'weather.forecast'",
  );

  const result = await client.invokeTool({
    name: 'weather.forecast',
    input: {city: 'Montreal'},
    requestId: 'missing-tool-1',
  });

  expect(() => expectToolCallSuccess(result)).toThrow('Expected tool call success status but got error');
  expectToolCallError(result);
});
