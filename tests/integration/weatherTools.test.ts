import {expectToolOutput, expectToolSuccess, getSharedMcpTestClient} from '../../src';
import {startMockMcpServer, stopMockMcpServer} from './mockServer';

beforeAll(async () => {
  await startMockMcpServer();
});

afterAll(async () => {
  await stopMockMcpServer();
});

test('weather tools use the shared MCP client without local setup', async () => {
  const client = getSharedMcpTestClient();

  expect(client.getAuthHeaders()).toEqual({ Authorization: 'Bearer suite-token' });

  const result = await client.invokeTool({
    name: 'weather.current',
    input: { city: 'Montreal' },
    requestId: 'weather-1',
  });

  expectToolSuccess(result);
  expectToolOutput(result, { city: 'Montreal', forecast: 'sunny' });
});