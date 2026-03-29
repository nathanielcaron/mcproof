import {
  configureSharedMcpTestClient,
  disconnectSharedMcpTestClient,
  expectTool,
  expectToolCallContent,
  expectToolCallMeta,
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

test('time tools use the configured shared client accessor in another file', async () => {
  const client = getSharedMcpTestClient();

  await expectTool(client, 'time.current');

  expect(client.getAuthHeaders()).toEqual({ Authorization: 'Bearer suite-token' });

  const result = await client.invokeTool({
    name: 'time.current',
    input: { timezone: 'UTC' },
    requestId: 'time-1',
  });

  expectToolCallSuccess(result);
  expectToolCallContent(result, { timezone: 'UTC', isoTime: '2026-03-28T12:00:00Z' });
  expectToolCallMeta(result, { source: 'mock-server', tool: 'time.current' });
});