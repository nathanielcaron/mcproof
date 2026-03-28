import {createServer, Server} from 'http';
import {AddressInfo} from 'net';
import {runCli} from '../src/cli';

let server: Server;
let baseUrl: string;
const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method === 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'session termination not supported' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      const payload = body.trim().length > 0 ? JSON.parse(body) : {};
      const requestName = payload?.request?.name;
      const method = payload?.method;
      const requestId = payload?.id ?? payload?.request?.requestId;

      if (method === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'mcp-session-id': 'preflight-session-id',
        });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'preflight-server',
                version: '1.0.0',
              },
            },
          }),
        );
        return;
      }

      if (method === 'notifications/initialized') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (method === 'tools/list' || requestName === 'tools/list' || requestName === 'tools.list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (payload?.jsonrpc === '2.0') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: requestId,
              result: {
                tools: [
                  { name: 'timeTool', inputSchema: { type: 'object' } },
                  { name: 'weatherTool', inputSchema: { type: 'object' } },
                ],
              },
            }),
          );
          return;
        }

        res.end(JSON.stringify({ status: 'success', output: { tools: [{ name: 'timeTool' }, { name: 'weatherTool' }] } }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', output: { ok: true } }));
    });
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

test('runCli prints preflight logs before executing tests', async () => {
  process.env = {
    ...ORIGINAL_ENV,
    MCPROOF_BASE_URL: baseUrl,
    MCPROOF_SKIP_PREFLIGHT: '0',
  };

  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (message?: unknown): void => {
    logs.push(String(message));
  };
  console.error = (message?: unknown): void => {
    errors.push(String(message));
  };

  try {
    const exitCode = await runCli(['test', '--help']);
    expect(exitCode).toBe(0);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  expect(errors).toEqual([]);
  expect(logs.some(line => line.includes('Successfully connected to MCP server'))).toBe(true);
  expect(logs.some(line => line.includes('Available MCP tools: timeTool, weatherTool'))).toBe(true);
  expect(logs.some(line => line.includes('Executing tests...'))).toBe(true);
});
