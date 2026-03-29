# MCProof API

## default workflow

The default workflow is env-driven.

1. Create `.env.mcproof`
2. Write test files that call `getSharedMcpTestClient()`
3. Run `npx mcproof test`

Supported env variables:

- `MCPROOF_BASE_URL` - required
- `MCPROOF_TIMEOUT_MS` - optional timeout in milliseconds
- `MCPROOF_HEADERS` - optional JSON object string of headers
- `MCPROOF_HEADER_*` - optional individual header overrides
- `MCPROOF_ENV_FILE` - optional override path for the env file

## `McpTestClient`

### constructor(options)
- `baseUrl` (string) - server endpoint
- `timeoutMs` (number, optional)
- `headers` (Record<string,string>, optional)

### methods
- `connect(): Promise<void>` - no-op (connection is established lazily on first operation)
- `disconnect(): Promise<void>` - best-effort session termination and client cleanup
- `getAuthHeaders(): Record<string,string>`
- `setAuthHeaders(auth: Record<string,string>): void`
- `clearAuthHeaders(): void`
- `invokeTool(toolCall: McpToolCall, config?: { timeout?: number }): Promise<McpToolResult>`

## shared client helpers

- `configureSharedMcpTestClient(config: McpSharedClientConfig): void`
- `installSharedMcpTestClient(config: McpSharedClientConfig): void`
- `initializeSharedMcpTestClient(): Promise<McpTestClient>`
- `getSharedMcpTestClient(): McpTestClient`
- `disconnectSharedMcpTestClient(): Promise<void>`
- `resetSharedMcpTestClient(): void`

These APIs remain available for advanced integrations, but they are no longer required for the default workflow.

## helpers

- `validateMcpToolCall(call): McpProtocolValidationResult`
- `validateMcpToolResult(result): McpProtocolValidationResult`
- `expectTool(client, toolName): Promise<void>`
- `expectToolCallSuccess(result): void`
- `expectToolCallError(result, expectedMessage?): void`
- `expectToolCallError(invocationPromise, expectedMessage?): Promise<void>`
- `expectToolCallContent(result, expected): void`
- `expectToolCallMeta(result, expected?): void`
