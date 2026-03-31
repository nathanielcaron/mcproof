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

export interface McpResourceRead {
  uri: string;
  requestId?: string;
  timeoutMs?: number;
}

export interface McpResourceResult {
  status: 'success' | 'error';
  output?: unknown;
  error?: string;
  requestId?: string;
  durationMs?: number;
  code?: number;
  debug?: Record<string, unknown>;
}

export interface McpPromptGet {
  name: string;
  arguments?: Record<string, string>;
  requestId?: string;
  timeoutMs?: number;
}

export interface McpPromptResult {
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

export interface McpServerInfo {
  name?: string;
  version?: string;
}

export interface McpToolDescriptor {
  name: string;
  title?: string;
  description?: string;
}

export interface McpResourceDescriptor {
  name: string;
  uri: string;
  mimeType?: string;
  title?: string;
  description?: string;
}

export interface McpPromptDescriptor {
  name: string;
  title?: string;
  description?: string;
  argumentCount: number;
}

export type McpSharedClientConfig = McpTestClientOptions;

export interface McpEnvConfigOptions {
  envFilePath?: string;
}

