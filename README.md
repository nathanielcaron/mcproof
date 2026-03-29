# MCProof 🛡️

MCProof: A test framework for MCP servers

## Install

```bash
npm install mcproof
```

## Quick Start

Create a `.env.mcproof` file in your project root:

```env
MCPROOF_BASE_URL=http://localhost:36719
MCPROOF_TIMEOUT_MS=10000
MCPROOF_HEADERS='{ "Authorization": "Bearer integration-token", "x-api-key":"demo-key" }'
```

Write granular test files without any local client setup:

`weather.test.ts`

```ts
import {expectTool, expectToolCallSuccess, getSharedMcpTestClient} from 'mcproof';

test('weather tool responds', async () => {
  const client = getSharedMcpTestClient();
  await expectTool(client, 'weather.current');
  const result = await client.invokeTool({
    name: 'weather.current',
    input: { city: 'Montreal' },
  });

  expectToolCallSuccess(result);
});
```

`time.test.ts`

```ts
import {expectTool, expectToolCallSuccess, getSharedMcpTestClient} from 'mcproof';

test('time tool responds', async () => {
  const client = getSharedMcpTestClient();
  await expectTool(client, 'time.current');
  const result = await client.invokeTool({
    name: 'time.current',
    input: { timezone: 'UTC' },
  });

  expectToolCallSuccess(result);
});
```

Run the suite with the framework CLI:

```bash
npx mcproof test
```

e.g.,
![MCProof Logging Screenshot](resources/images/MCProof_Logging_Screenshot.png)

Each CLI test run also writes a simple HTML report under `mcproof-reports/` in your current working directory.

e.g.,
![MCProof Report Screenshot 1](resources/images/MCProof_Report_Screenshot_1.png)
![MCProof Report Screenshot 2](resources/images/MCProof_Report_Screenshot_2.png)

Show the installed package version:

```bash
npx mcproof --version
```

## Env Configuration

- `MCPROOF_BASE_URL`: required MCP server base URL
- `MCPROOF_TIMEOUT_MS`: optional timeout in milliseconds
- `MCPROOF_HEADERS`: optional JSON object of default headers
- `MCPROOF_HEADER_*`: optional per-header overrides, e.g. `MCPROOF_HEADER_AUTHORIZATION`
- `MCPROOF_ENV_FILE`: optional path to a non-default env file

When both `MCPROOF_HEADERS` and `MCPROOF_HEADER_*` are present, the individual header vars win.

## Advanced Usage

```ts
import {McpTestClient, validateMcpToolCall, expectToolCallSuccess} from 'mcproof';

const client = new McpTestClient({ baseUrl: 'http://localhost:36719', timeoutMs: 10000 });
client.setAuthHeaders({ Authorization: 'Bearer token', 'x-api-key': 'key' });

const validation = validateMcpToolCall({ name: 'ping', requestId: '1' });
if (!validation.isValid) {
  throw new Error(validation.message);
}

const result = await client.invokeTool({ name: 'ping', requestId: '1' });
expectToolCallSuccess(result);

console.log('result output', result.output);
```

## API

- `McpTestClient` - core test client with HTTP MCP integration
  - `connect()`
  - `disconnect()`
  - `getAuthHeaders()`
  - `setAuthHeaders(headers)`
  - `clearAuthHeaders()`
  - `invokeTool(toolCall)`

- `installSharedMcpTestClient(config)`
- `configureSharedMcpTestClient(config)`
- `initializeSharedMcpTestClient()`
- `getSharedMcpTestClient()`
- `disconnectSharedMcpTestClient()`
- `resetSharedMcpTestClient()`

- `validateMcpToolCall(call)` - returns `McpProtocolValidationResult`
- `validateMcpToolResult(result)` - returns `McpProtocolValidationResult`
- `expectTool(client, toolName)`
- `expectToolCallSuccess(result)`
- `expectToolCallError(resultOrInvocation[, expectedMessage])`
- `expectToolCallContent(result, expected)`
- `expectToolCallMeta(result, expected?)`

## Notes

- Uses the official MCP TypeScript SDK client and streamable HTTP transport.
- Designed for stateless HTTP MCP tooling.
- The default `mcproof test` command enforces sequential Jest execution for the shared-client workflow.
- `mcproof test` writes a timestamped HTML summary to `mcproof-reports/` with preflight discovery details and Jest results.
- The manual shared-client APIs are still available for advanced or non-standard integrations.
