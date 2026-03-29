import {createServer, Server} from 'http';
import {AddressInfo} from 'net';

interface MockServerState {
  server?: Server;
  baseUrl?: string;
}

const MOCK_SERVER_STATE_KEY = Symbol.for('mcproof.mockServerState');

function getMockServerState(): MockServerState {
  const processWithState = process as NodeJS.Process & {
    [MOCK_SERVER_STATE_KEY]?: MockServerState;
  };

  if (!processWithState[MOCK_SERVER_STATE_KEY]) {
    processWithState[MOCK_SERVER_STATE_KEY] = {};
  }

  return processWithState[MOCK_SERVER_STATE_KEY] as MockServerState;
}

export async function startMockMcpServer(): Promise<string> {
  const state = getMockServerState();

  if (state.server?.listening && state.baseUrl) {
    return state.baseUrl;
  }

  state.server = createServer((req, res) => {
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
      const payload = (body.trim().length > 0 ? JSON.parse(body) : {}) as {
        jsonrpc?: string;
        id?: string | number;
        method?: string;
        params?: { name?: string; arguments?: Record<string, unknown> };
        request?: { name: string; input?: Record<string, unknown>; requestId?: string };
      };

      const jsonRpcMethod = payload.method;
      const jsonRpcToolName = payload.params?.name;
      const jsonRpcArguments = payload.params?.arguments;

      const legacyRequest = payload.request as { name: string; input?: Record<string, unknown>; requestId?: string } | undefined;
      const requestName = jsonRpcMethod === 'tools/call' ? jsonRpcToolName : legacyRequest?.name;
      const requestInput = jsonRpcMethod === 'tools/call' ? jsonRpcArguments : legacyRequest?.input;
      const requestId = payload.id ?? legacyRequest?.requestId;

      if (jsonRpcMethod === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'mcp-session-id': 'mock-session-id',
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
                name: 'mcproof-mock-server',
                version: '1.0.0',
              },
            },
          }),
        );
        return;
      }

      if (jsonRpcMethod === 'notifications/initialized') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (jsonRpcMethod === 'tools/list' || requestName === 'tools/list' || requestName === 'tools.list') {
        const tools = [
          { name: 'weather.current', inputSchema: { type: 'object', properties: { city: { type: 'string' } } } },
          { name: 'time.current', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } } } },
        ];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (payload.jsonrpc === '2.0') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: requestId,
              result: { tools },
            }),
          );
          return;
        }

        res.end(
          JSON.stringify({
            status: 'success',
            output: { tools },
            requestId,
          }),
        );
        return;
      }

      if (requestName === 'weather.current') {
        const weather = { city: requestInput?.city ?? 'unknown', forecast: 'sunny' };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (payload.jsonrpc === '2.0') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{ type: 'text', text: JSON.stringify(weather) }],
                structuredContent: weather,
                _meta: {
                  source: 'mock-server',
                  tool: 'weather.current',
                },
                isError: false,
              },
            }),
          );
          return;
        }

        res.end(
          JSON.stringify({
            status: 'success',
            output: { city: requestInput?.city ?? 'unknown', forecast: 'sunny' },
            requestId,
          }),
        );
        return;
      }

      if (requestName === 'time.current') {
        const time = { timezone: requestInput?.timezone ?? 'UTC', isoTime: '2026-03-28T12:00:00Z' };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (payload.jsonrpc === '2.0') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{ type: 'text', text: JSON.stringify(time) }],
                structuredContent: time,
                _meta: {
                  source: 'mock-server',
                  tool: 'time.current',
                },
                isError: false,
              },
            }),
          );
          return;
        }

        res.end(
          JSON.stringify({
            status: 'success',
            output: { timezone: requestInput?.timezone ?? 'UTC', isoTime: '2026-03-28T12:00:00Z' },
            requestId,
          }),
        );
        return;
      }

      if (payload.jsonrpc === '2.0' && jsonRpcMethod === 'tools/call') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            result: {
              content: [{ type: 'text', text: 'unknown tool' }],
              isError: true,
            },
          }),
        );
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      if (payload.jsonrpc === '2.0') {
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            error: { code: -32601, message: 'Method not found' },
          }),
        );
        return;
      }

      res.end(JSON.stringify({ status: 'error', error: 'unknown tool', requestId }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    state.server?.once('error', reject);
    state.server?.listen(0, '127.0.0.1', () => {
      const address = state.server?.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Mock MCP server could not resolve a listening address.'));
        return;
      }

      state.baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
      state.server?.unref();
      resolve();
    });
  });

  return state.baseUrl;
}

export async function stopMockMcpServer(): Promise<void> {
  const state = getMockServerState();

  if (!state.server) {
    return;
  }

  const activeServer = state.server;
  state.server = undefined;
  state.baseUrl = undefined;

  await new Promise<void>((resolve, reject) => {
    activeServer.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}