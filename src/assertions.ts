import {McpToolResult} from './types';

type AsymmetricMatcher = {
  asymmetricMatch?: (value: unknown) => boolean;
};

type ToolLookupClient = {
  listAvailableTools: () => Promise<string[]>;
};

type PromiseLikeToolResult = {
  then: (onfulfilled?: (value: McpToolResult) => unknown, onrejected?: (reason: unknown) => unknown) => unknown;
};

function safeParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractSseDataPayload(raw: string): unknown {
  const payloads = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s?/, ''))
    .filter(line => line.length > 0)
    .map(line => safeParseJson(line))
    .filter((value: unknown | undefined): value is unknown => value !== undefined);

  if (payloads.length === 0) {
    return raw;
  }

  return payloads[payloads.length - 1];
}

function normalizeToolOutput(value: unknown): unknown {
  if (typeof value === 'string') {
    const ssePayload = extractSseDataPayload(value);
    if (ssePayload !== value) {
      return normalizeToolOutput(ssePayload);
    }

    const parsedJson = safeParseJson(value);
    if (parsedJson !== undefined) {
      return normalizeToolOutput(parsedJson);
    }

    return value;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const candidate = value as {
    result?: unknown;
    output?: unknown;
    structuredContent?: unknown;
    content?: Array<{ type?: unknown; text?: unknown }>;
  };

  if (candidate.result !== undefined) {
    return normalizeToolOutput(candidate.result);
  }

  if (candidate.output !== undefined) {
    return normalizeToolOutput(candidate.output);
  }

  if (candidate.structuredContent !== undefined) {
    return candidate.structuredContent;
  }

  if (Array.isArray(candidate.content)) {
    const texts = candidate.content
      .map(item => (typeof item?.text === 'string' ? item.text : undefined))
      .filter((text: string | undefined): text is string => text !== undefined);

    if (texts.length === 1) {
      const parsed = safeParseJson(texts[0]);
      return parsed !== undefined ? parsed : texts[0];
    }

    if (texts.length > 1) {
      return texts.join('\n');
    }

    return candidate.content;
  }

  return value;
}

function isAsymmetricMatcher(value: unknown): value is AsymmetricMatcher {
  return Boolean(value && typeof value === 'object' && typeof (value as AsymmetricMatcher).asymmetricMatch === 'function');
}

function extractToolMeta(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as {
    _meta?: unknown;
    result?: unknown;
    output?: unknown;
  };

  if (candidate._meta !== undefined) {
    return candidate._meta;
  }

  if (candidate.result !== undefined) {
    return extractToolMeta(candidate.result);
  }

  if (candidate.output !== undefined) {
    return extractToolMeta(candidate.output);
  }

  return undefined;
}

function isPromiseLikeToolResult(value: unknown): value is PromiseLikeToolResult {
  return Boolean(value && typeof value === 'object' && typeof (value as PromiseLikeToolResult).then === 'function');
}

function formatUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertToolCallErrored(result: McpToolResult, expectedMessage?: string): void {
  if (result.status !== 'error') {
    throw new Error('Expected tool call to fail with error status');
  }

  if (expectedMessage && !result.error?.includes(expectedMessage)) {
    throw new Error(`Expected error message to include '${expectedMessage}', got '${result.error}'`);
  }
}

export async function expectTool(client: ToolLookupClient, toolName: string): Promise<void> {
  const availableTools = await client.listAvailableTools();
  if (availableTools.includes(toolName)) {
    return;
  }

  const discovered = availableTools.length > 0 ? availableTools.join(', ') : '(none)';
  throw new Error(`Expected MCP server to expose tool '${toolName}', but discovered: ${discovered}`);
}

export function expectToolCallSuccess(result: McpToolResult): void {
  if (result.status !== 'success') {
    throw new Error(`Expected success status but got ${result.status}: ${result.error ?? 'no error info'}`);
  }
}

export function expectToolCallError(result: McpToolResult, expectedMessage?: string): void;
export function expectToolCallError(result: Promise<McpToolResult>, expectedMessage?: string): Promise<void>;
export function expectToolCallError(result: McpToolResult | Promise<McpToolResult>, expectedMessage?: string): void | Promise<void> {
  if (isPromiseLikeToolResult(result)) {
    return Promise.resolve(result).then(
      toolResult => {
        assertToolCallErrored(toolResult, expectedMessage);
      },
      (error: unknown) => {
        if (!expectedMessage) {
          return;
        }

        const message = formatUnknownErrorMessage(error);
        if (!message.includes(expectedMessage)) {
          throw new Error(`Expected invocation failure message to include '${expectedMessage}', got '${message}'`);
        }
      },
    );
  }

  assertToolCallErrored(result, expectedMessage);
}

export function expectToolCallContent(result: McpToolResult, expected: unknown): void {
  const normalizedOutput = normalizeToolOutput(result.output);

  if (isAsymmetricMatcher(expected)) {
    if (!expected.asymmetricMatch?.(normalizedOutput)) {
      expect(normalizedOutput).toEqual(expected);
    }

    return;
  }

  expect(normalizedOutput).toEqual(expected);
}

export function expectToolCallMeta(result: McpToolResult, expected?: unknown): void {
  const meta = extractToolMeta(result.output);

  if (expected === undefined) {
    if (meta === undefined) {
      throw new Error('Expected tool call result output to contain a _meta field');
    }

    return;
  }

  expect(meta).toEqual(expected);
}
