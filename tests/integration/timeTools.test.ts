import {expectToolOutput, expectToolSuccess, getSharedMcpTestClient} from '../../src';
import {startMockMcpServer, stopMockMcpServer} from './mockServer';

beforeAll(async () => {
  await startMockMcpServer();
});

afterAll(async () => {
  await stopMockMcpServer();
});

test('time tools use the configured shared client accessor in another file', async () => {
  const client = getSharedMcpTestClient();

  expect(client.getAuthHeaders()).toEqual({ Authorization: 'Bearer suite-token' });

  const result = await client.invokeTool({
    name: 'time.current',
    input: { timezone: 'UTC' },
    requestId: 'time-1',
  });

  expectToolSuccess(result);
  expectToolOutput(result, { timezone: 'UTC', isoTime: '2026-03-28T12:00:00Z' });
});