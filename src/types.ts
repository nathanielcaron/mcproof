export interface McpTestClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface McpToolCall {
  name: string;
  input?: Record<string, unknown>;
  requestId?: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface McpToolResult {
  status: 'success' | 'error';
  output?: unknown;
  error?: string;
  requestId?: string;
  durationMs?: number;
  code?: number;
  debug?: Record<string, unknown>;
}

export interface McpProtocolValidationResult {
  isValid: boolean;
  missing?: string[];
  invalidFields?: string[];
  message?: string;
}

export type McpSharedClientConfig = McpTestClientOptions;

export interface McpEnvConfigOptions {
  envFilePath?: string;
}

