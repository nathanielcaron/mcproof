import {expectTool, expectToolCallContent, expectToolCallMeta, expectToolCallSuccess, getSharedMcpTestClient} from '../../src';
import {startMockMcpServer, stopMockMcpServer} from './mockServer';

beforeAll(async () => {
  await startMockMcpServer();
});

afterAll(async () => {
  await stopMockMcpServer();
});

test('weather tools use the shared MCP client without local setup', async () => {
  const client = getSharedMcpTestClient();

  await expectTool(client, 'weather.current');

  expect(client.getAuthHeaders()).toEqual({ Authorization: 'Bearer suite-token' });

  const result = await client.invokeTool({
    name: 'weather.current',
    input: { city: 'Montreal' },
    requestId: 'weather-1',
  });

  expectToolCallSuccess(result);
  expectToolCallContent(result, { city: 'Montreal', forecast: 'sunny' });
  expectToolCallMeta(result, { source: 'mock-server', tool: 'weather.current' });
});