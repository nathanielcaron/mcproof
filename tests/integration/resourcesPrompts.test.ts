import {
  configureSharedMcpTestClient,
  disconnectSharedMcpTestClient,
  expectPrompt,
  expectPromptGetContent,
  expectPromptGetError,
  expectPromptGetMeta,
  expectPromptGetSuccess,
  expectResource,
  expectResourceReadContent,
  expectResourceReadError,
  expectResourceReadMeta,
  expectResourceReadSuccess,
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

test('resource assertions verify presence and resource read output', async () => {
  const client = getSharedMcpTestClient();

  await expectResource(client, 'resource://weather/current', {
    name: 'Weather Resource',
    mimeType: 'application/json',
  });

  const result = await client.readResource({
    uri: 'resource://weather/current',
    requestId: 'resource-1',
  });

  expectResourceReadSuccess(result);
  expectResourceReadContent(
    result,
    expect.arrayContaining([
      expect.objectContaining({
        uri: 'resource://weather/current',
        mimeType: 'application/json',
      }),
    ]),
  );
  expectResourceReadMeta(result, { source: 'mock-server', resource: 'resource://weather/current' });
});

test('resource read error assertion supports rejected invocation promise', async () => {
  const client = getSharedMcpTestClient();

  await expect(
    expectResourceReadError(
      client.readResource({
        uri: 'resource://weather/missing',
        requestId: 'resource-missing',
      }),
      'MCP error -32002: Resource not found: resource://weather/missing',
    ),
  ).resolves.toBeUndefined();
});

test('prompt assertions verify presence and prompt get output', async () => {
  const client = getSharedMcpTestClient();

  await expectPrompt(client, 'summarize.weather', {
    argumentCount: 1,
  });

  const result = await client.getPrompt({
    name: 'summarize.weather',
    arguments: { city: 'Montreal' },
    requestId: 'prompt-1',
  });

  expectPromptGetSuccess(result);
  expectPromptGetContent(
    result,
    expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
      }),
    ]),
  );
  expectPromptGetMeta(result, { source: 'mock-server', prompt: 'summarize.weather' });
});

test('prompt get error assertion supports rejected invocation promise', async () => {
  const client = getSharedMcpTestClient();

  await expect(
    expectPromptGetError(
      client.getPrompt({
        name: 'unknown.prompt',
        requestId: 'prompt-missing',
      }),
      'MCP error -32602: Unknown prompt: unknown.prompt',
    ),
  ).resolves.toBeUndefined();
});
