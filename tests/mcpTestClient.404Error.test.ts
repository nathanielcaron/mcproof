import {createServer, Server} from 'http';
import {AddressInfo} from 'net';
import {McpTestClient} from '../src/mcpTestClient';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((_, res) => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

test('invokeTool surfaces a clear endpoint hint on HTTP 404', async () => {
  const client = new McpTestClient({ baseUrl, timeoutMs: 500 });

  try {
    await expect(
      client.invokeTool({
        name: 'time.current',
        input: { timezone: 'UTC' },
      }),
    ).rejects.toThrow('MCP server at');

    await expect(
      client.invokeTool({
        name: 'time.current',
        input: { timezone: 'UTC' },
      }),
    ).rejects.toThrow('points to the correct MCP HTTP endpoint path');
  } finally {
    await client.disconnect();
  }
});
