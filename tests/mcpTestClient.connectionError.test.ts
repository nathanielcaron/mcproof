import {McpTestClient} from '../src/mcpTestClient';

test('invokeTool surfaces a clear connection error when MCP server is unreachable', async () => {
  const client = new McpTestClient({
    baseUrl: 'http://127.0.0.1:1',
    timeoutMs: 200,
  });

  await expect(
    client.invokeTool({
      name: 'time.current',
      input: { timezone: 'UTC' },
    }),
  ).rejects.toThrow('Could not connect to MCP server at');
});
