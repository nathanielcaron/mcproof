import {Client} from '@modelcontextprotocol/sdk/client';
import {StreamableHTTPClientTransport, StreamableHTTPError} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {version as packageVersion} from '../package.json';
import {
  McpPromptGet,
  McpPromptDescriptor,
  McpPromptResult,
  McpResourceRead,
  McpResourceDescriptor,
  McpResourceResult,
  McpServerInfo,
  McpTestClientOptions,
  McpToolCall,
  McpToolDescriptor,
  McpToolResult,
} from './types';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ERR_NETWORK',
]);

interface InvokeToolConfig {
  timeout?: number;
}

export class McpTestClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly staticHeaders: Record<string, string>;
  private readonly authHeaders: Record<string, string>;
  private client?: Client;
  private transport?: StreamableHTTPClientTransport;
  private requestCounter = 1;

  constructor(options: McpTestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.staticHeaders = {};
    this.authHeaders = {};

    Object.entries(options.headers ?? {}).forEach(([key, value]) => {
      if (key === 'Authorization' || key === 'x-api-key') {
        this.authHeaders[key] = value;
        return;
      }

      this.staticHeaders[key] = value;
    });
  }

  getAuthHeaders(): Record<string, string> {
    return { ...this.authHeaders };
  }

  setAuthHeaders(auth: Record<string, string>): void {
    Object.assign(this.authHeaders, auth);
    this.markConnectionDirty();
  }

  clearAuthHeaders(): void {
    delete this.authHeaders.Authorization;
    delete this.authHeaders['x-api-key'];
    this.markConnectionDirty();
  }

  private makeRequestId(preferred?: string): string {
    if (preferred && preferred.trim().length > 0) {
      return preferred;
    }

    const id = String(this.requestCounter);
    this.requestCounter += 1;
    return id;
  }

  private buildHeaders(): Record<string, string> {
    return {
      ...this.staticHeaders,
      ...this.authHeaders,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
  }

  private extractConnectionErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.length > 0) {
      return error;
    }

    return 'unknown network error';
  }

  private isConnectionFailure(error: unknown): boolean {
    if (error instanceof StreamableHTTPError && typeof error.code === 'number' && error.code >= 400) {
      return false;
    }

    if (error && typeof error === 'object') {
      const value = error as { code?: string; cause?: unknown; message?: string };
      if (value.code && NETWORK_ERROR_CODES.has(value.code)) {
        return true;
      }

      if (value.cause && typeof value.cause === 'object') {
        const causeWithCode = value.cause as { code?: string; message?: string };
        if (causeWithCode.code && NETWORK_ERROR_CODES.has(causeWithCode.code)) {
          return true;
        }

        const causeMessage = String(causeWithCode.message ?? '').toLowerCase();
        if (
          causeMessage.includes('econnrefused') ||
          causeMessage.includes('enotfound') ||
          causeMessage.includes('timed out') ||
          causeMessage.includes('timeout') ||
          causeMessage.includes('socket hang up') ||
          causeMessage.includes('network') ||
          causeMessage.includes('bad port')
        ) {
          return true;
        }
      }
    }

    if (!(error instanceof Error)) {
      const message = this.extractConnectionErrorMessage(error).toLowerCase();
      return (
        message.includes('fetch failed') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('timed out') ||
        message.includes('timeout') ||
        message.includes('socket hang up') ||
        message.includes('network') ||
        message.includes('bad port')
      );
    }

    const withCode = error as Error & { code?: string; cause?: unknown };
    if (withCode.code && NETWORK_ERROR_CODES.has(withCode.code)) {
      return true;
    }

    if (withCode.cause && typeof withCode.cause === 'object') {
      const causeWithCode = withCode.cause as { code?: string; message?: string };
      if (causeWithCode.code && NETWORK_ERROR_CODES.has(causeWithCode.code)) {
        return true;
      }

      const causeMessage = String(causeWithCode.message ?? '').toLowerCase();
      if (
        causeMessage.includes('econnrefused') ||
        causeMessage.includes('enotfound') ||
        causeMessage.includes('timed out') ||
        causeMessage.includes('timeout') ||
        causeMessage.includes('socket hang up') ||
        causeMessage.includes('network') ||
        causeMessage.includes('bad port')
      ) {
        return true;
      }
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('socket hang up') ||
      message.includes('network') ||
      message.includes('bad port')
    );
  }

  private normalizeMcpError(error: unknown): never {
    if (error instanceof StreamableHTTPError && error.code === 404) {
      throw new Error(
        `MCP server at ${this.baseUrl} received HTTP 404 for MCP requests. ` +
          'Check that MCPROOF_BASE_URL points to the correct MCP HTTP endpoint path (often ending in /mcp).',
      );
    }

    if (this.isConnectionFailure(error)) {
      const detail = this.extractConnectionErrorMessage(error);
      throw new Error(
        `Could not connect to MCP server at ${this.baseUrl}. Ensure the server is running and reachable. Details: ${detail}`,
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  }

  private async ensureConnected(): Promise<void> {
    if (this.client && this.transport) {
      return;
    }

    try {
      const transport = new StreamableHTTPClientTransport(new URL(this.baseUrl), {
        requestInit: {
          headers: this.buildHeaders(),
        },
      });

      const client = new Client(
        {
          name: 'mcproof',
          version: packageVersion,
        },
        {
          capabilities: {},
        },
      );

      await client.connect(transport, {
        timeout: this.timeoutMs,
      });

      this.transport = transport;
      this.client = client;
    } catch (error: unknown) {
      await this.resetConnection();
      this.normalizeMcpError(error);
    }
  }

  private async resetConnection(): Promise<void> {
    const client = this.client;
    const transport = this.transport;

    this.client = undefined;
    this.transport = undefined;

    if (transport) {
      try {
        await transport.close();
      } catch {
        // Ignore transport cleanup failures during reset.
      }
    }

    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore client cleanup failures during reset.
      }
    }
  }

  private markConnectionDirty(): void {
    if (!this.client && !this.transport) {
      return;
    }

    void this.resetConnection();
  }

  async getServerInfo(): Promise<McpServerInfo> {
    await this.ensureConnected();
    const serverInfo = this.client?.getServerVersion();

    return {
      name: serverInfo?.name,
      version: serverInfo?.version,
    };
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.listTools(undefined, {
          timeout: this.timeoutMs,
        });

        return response.tools.map(tool => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
        }));
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        this.normalizeMcpError(error);
      }
    }

    return [];
  }

  async listAvailableTools(): Promise<string[]> {
    const tools = await this.listTools();
    return tools.map(tool => tool.name);
  }

  async listResources(): Promise<McpResourceDescriptor[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.listResources(undefined, {
          timeout: this.timeoutMs,
        });

        return response.resources.map(resource => ({
          name: resource.name,
          uri: resource.uri,
          mimeType: resource.mimeType,
          title: resource.title,
          description: resource.description,
        }));
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        return [];
      }
    }

    return [];
  }

  async listPrompts(): Promise<McpPromptDescriptor[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.listPrompts(undefined, {
          timeout: this.timeoutMs,
        });

        return response.prompts.map(prompt => ({
          name: prompt.name,
          title: prompt.title,
          description: prompt.description,
          argumentCount: prompt.arguments?.length ?? 0,
        }));
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        return [];
      }
    }

    return [];
  }

  private extractToolErrorMessage(output: unknown): string {
    if (!output || typeof output !== 'object') {
      return 'MCP tools/call failed';
    }

    const candidate = output as {
      content?: Array<{ type?: string; text?: string }>;
      toolResult?: unknown;
    };

    if (Array.isArray(candidate.content)) {
      const textPart = candidate.content.find(part => part?.type === 'text' && typeof part.text === 'string');
      if (textPart?.text) {
        return textPart.text;
      }
    }

    if (candidate.toolResult && typeof candidate.toolResult === 'string') {
      return candidate.toolResult;
    }

    return 'MCP tools/call failed';
  }

  private extractResourceErrorMessage(output: unknown): string {
    if (output instanceof Error) {
      return output.message;
    }

    if (typeof output === 'string' && output.length > 0) {
      return output;
    }

    if (!output || typeof output !== 'object') {
      return 'MCP resources/read failed';
    }

    const candidate = output as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.length > 0) {
      return candidate.message;
    }

    if (typeof candidate.error === 'string' && candidate.error.length > 0) {
      return candidate.error;
    }

    return 'MCP resources/read failed';
  }

  private extractPromptErrorMessage(output: unknown): string {
    if (output instanceof Error) {
      return output.message;
    }

    if (typeof output === 'string' && output.length > 0) {
      return output;
    }

    if (!output || typeof output !== 'object') {
      return 'MCP prompts/get failed';
    }

    const candidate = output as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.length > 0) {
      return candidate.message;
    }

    if (typeof candidate.error === 'string' && candidate.error.length > 0) {
      return candidate.error;
    }

    return 'MCP prompts/get failed';
  }

  async invokeTool(toolCall: McpToolCall, config?: InvokeToolConfig): Promise<McpToolResult> {
    const startedAt = Date.now();
    const requestId = this.makeRequestId(toolCall.requestId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.callTool(
          {
            name: toolCall.name,
            arguments: toolCall.input ?? {},
            _meta: toolCall.metadata,
          },
          undefined,
          {
            timeout: toolCall.timeoutMs ?? config?.timeout ?? this.timeoutMs,
          },
        );

        if (response.isError) {
          return {
            status: 'error',
            error: this.extractToolErrorMessage(response),
            requestId,
            durationMs: Date.now() - startedAt,
          };
        }

        return {
          status: 'success',
          output: response,
          requestId,
          durationMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        this.normalizeMcpError(error);
      }
    }

    return {
      status: 'error',
      error: 'MCP tools/call failed',
      requestId,
      durationMs: Date.now() - startedAt,
    };
  }

  async readResource(resourceRead: McpResourceRead, config?: InvokeToolConfig): Promise<McpResourceResult> {
    const startedAt = Date.now();
    const requestId = this.makeRequestId(resourceRead.requestId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.readResource(
          {
            uri: resourceRead.uri,
          },
          {
            timeout: resourceRead.timeoutMs ?? config?.timeout ?? this.timeoutMs,
          },
        );

        return {
          status: 'success',
          output: response,
          requestId,
          durationMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        if (error instanceof StreamableHTTPError && typeof error.code === 'number' && error.code >= 400 && error.code < 500) {
          return {
            status: 'error',
            error: this.extractResourceErrorMessage(error.message),
            requestId,
            durationMs: Date.now() - startedAt,
            code: error.code,
          };
        }

        this.normalizeMcpError(error);
      }
    }

    return {
      status: 'error',
      error: 'MCP resources/read failed',
      requestId,
      durationMs: Date.now() - startedAt,
    };
  }

  async getPrompt(promptGet: McpPromptGet, config?: InvokeToolConfig): Promise<McpPromptResult> {
    const startedAt = Date.now();
    const requestId = this.makeRequestId(promptGet.requestId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.ensureConnected();

      try {
        const response = await this.client!.getPrompt(
          {
            name: promptGet.name,
            arguments: promptGet.arguments,
          },
          {
            timeout: promptGet.timeoutMs ?? config?.timeout ?? this.timeoutMs,
          },
        );

        return {
          status: 'success',
          output: response,
          requestId,
          durationMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        if (attempt === 0 && this.isConnectionFailure(error)) {
          await this.resetConnection();
          continue;
        }

        if (error instanceof StreamableHTTPError && typeof error.code === 'number' && error.code >= 400 && error.code < 500) {
          return {
            status: 'error',
            error: this.extractPromptErrorMessage(error.message),
            requestId,
            durationMs: Date.now() - startedAt,
            code: error.code,
          };
        }

        this.normalizeMcpError(error);
      }
    }

    return {
      status: 'error',
      error: 'MCP prompts/get failed',
      requestId,
      durationMs: Date.now() - startedAt,
    };
  }

  async disconnect(): Promise<void> {
    const transport = this.transport;

    if (!this.client && !transport) {
      return;
    }

    try {
      if (transport) {
        await transport.terminateSession();
      }
    } catch (error: unknown) {
      if (!(error instanceof StreamableHTTPError && error.code === 405)) {
        // No-op on disconnect failures.
      }
    }

    await this.resetConnection();
  }

  async connect(): Promise<void> {
    return;
  }
}
