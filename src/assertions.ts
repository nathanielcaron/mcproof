import {McpPromptDescriptor, McpPromptResult, McpResourceDescriptor, McpResourceResult, McpToolResult} from './types';

type AsymmetricMatcher = {
  asymmetricMatch?: (value: unknown) => boolean;
};

type ToolLookupClient = {
  listAvailableTools: () => Promise<string[]>;
};

type ResourceLookupClient = {
  listResources: () => Promise<McpResourceDescriptor[]>;
};

type PromptLookupClient = {
  listPrompts: () => Promise<McpPromptDescriptor[]>;
};

type PromiseLikeToolResult = {
  then: (onfulfilled?: (value: McpToolResult) => unknown, onrejected?: (reason: unknown) => unknown) => unknown;
};

type PromiseLikeResourceResult = {
  then: (onfulfilled?: (value: McpResourceResult) => unknown, onrejected?: (reason: unknown) => unknown) => unknown;
};

type PromiseLikePromptResult = {
  then: (onfulfilled?: (value: McpPromptResult) => unknown, onrejected?: (reason: unknown) => unknown) => unknown;
};

// Tool assertions
export async function expectTool(client: ToolLookupClient, toolName: string): Promise<void> {
  const availableTools = await client.listAvailableTools();
  if (availableTools.includes(toolName)) {
    return;
  }

  const discovered = availableTools.length > 0 ? availableTools.join(', ') : '(none)';
  throw new Error(`Expected MCP server to expose tool '${toolName}', but discovered: ${discovered}`);
}

export function expectToolCallSuccess(result: McpToolResult): void {
  assertSuccess(result.status, result.error, 'tool call');
}

export function expectToolCallError(result: McpToolResult, expectedMessage?: string): void;
export function expectToolCallError(result: Promise<McpToolResult>, expectedMessage?: string): Promise<void>;
export function expectToolCallError(result: McpToolResult | Promise<McpToolResult>, expectedMessage?: string): void | Promise<void> {
  if (isPromiseLikeToolResult(result)) {
    return Promise.resolve(result).then(
      toolResult => {
        assertErrored(toolResult.status, toolResult.error, 'tool call', expectedMessage);
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

  assertErrored(result.status, result.error, 'tool call', expectedMessage);
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

// Resource assertions
export async function expectResource(
  client: ResourceLookupClient,
  resourceUri: string,
  expected?: Partial<McpResourceDescriptor> | AsymmetricMatcher,
): Promise<void> {
  const resources = await client.listResources();
  const resource = resources.find(entry => entry.uri === resourceUri);

  if (!resource) {
    const discovered = resources.length > 0 ? resources.map(entry => entry.uri).join(', ') : '(none)';
    throw new Error(`Expected MCP server to expose resource '${resourceUri}', but discovered: ${discovered}`);
  }

  if (expected !== undefined) {
    expect(resource).toEqual(normalizeExpectedDescriptor(expected));
  }
}

export function expectResourceReadSuccess(result: McpResourceResult): void {
  assertSuccess(result.status, result.error, 'resource read');
}

export function expectResourceReadError(result: McpResourceResult, expectedMessage?: string): void;
export function expectResourceReadError(result: Promise<McpResourceResult>, expectedMessage?: string): Promise<void>;
export function expectResourceReadError(
  result: McpResourceResult | Promise<McpResourceResult>,
  expectedMessage?: string,
): void | Promise<void> {
  if (isPromiseLikeResourceResult(result)) {
    return Promise.resolve(result).then(
      resourceResult => {
        assertErrored(resourceResult.status, resourceResult.error, 'resource read', expectedMessage);
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

  assertErrored(result.status, result.error, 'resource read', expectedMessage);
}

export function expectResourceReadContent(result: McpResourceResult, expected: unknown): void {
  const normalizedOutput = normalizeResourceOutput(result.output);

  if (isAsymmetricMatcher(expected)) {
    if (!expected.asymmetricMatch?.(normalizedOutput)) {
      expect(normalizedOutput).toEqual(expected);
    }

    return;
  }

  expect(normalizedOutput).toEqual(expected);
}

export function expectResourceReadMeta(result: McpResourceResult, expected?: unknown): void {
  const meta = extractToolMeta(result.output);

  if (expected === undefined) {
    if (meta === undefined) {
      throw new Error('Expected resource read output to contain a _meta field');
    }

    return;
  }

  expect(meta).toEqual(expected);
}

// Prompt assertions
export async function expectPrompt(
  client: PromptLookupClient,
  promptName: string,
  expected?: Partial<McpPromptDescriptor> | AsymmetricMatcher,
): Promise<void> {
  const prompts = await client.listPrompts();
  const prompt = prompts.find(entry => entry.name === promptName);

  if (!prompt) {
    const discovered = prompts.length > 0 ? prompts.map(entry => entry.name).join(', ') : '(none)';
    throw new Error(`Expected MCP server to expose prompt '${promptName}', but discovered: ${discovered}`);
  }

  if (expected !== undefined) {
    expect(prompt).toEqual(normalizeExpectedDescriptor(expected));
  }
}

export function expectPromptGetSuccess(result: McpPromptResult): void {
  assertSuccess(result.status, result.error, 'prompt get');
}

export function expectPromptGetError(result: McpPromptResult, expectedMessage?: string): void;
export function expectPromptGetError(result: Promise<McpPromptResult>, expectedMessage?: string): Promise<void>;
export function expectPromptGetError(
  result: McpPromptResult | Promise<McpPromptResult>,
  expectedMessage?: string,
): void | Promise<void> {
  if (isPromiseLikePromptResult(result)) {
    return Promise.resolve(result).then(
      promptResult => {
        assertErrored(promptResult.status, promptResult.error, 'prompt get', expectedMessage);
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

  assertErrored(result.status, result.error, 'prompt get', expectedMessage);
}

export function expectPromptGetContent(result: McpPromptResult, expected: unknown): void {
  const normalizedOutput = normalizePromptOutput(result.output);

  if (isAsymmetricMatcher(expected)) {
    if (!expected.asymmetricMatch?.(normalizedOutput)) {
      expect(normalizedOutput).toEqual(expected);
    }

    return;
  }

  expect(normalizedOutput).toEqual(expected);
}

export function expectPromptGetMeta(result: McpPromptResult, expected?: unknown): void {
  const meta = extractToolMeta(result.output);

  if (expected === undefined) {
    if (meta === undefined) {
      throw new Error('Expected prompt get output to contain a _meta field');
    }

    return;
  }

  expect(meta).toEqual(expected);
}

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

function normalizeResourceOutput(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const candidate = value as { contents?: unknown };
  if (candidate.contents !== undefined) {
    return candidate.contents;
  }

  return value;
}

function normalizePromptOutput(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const candidate = value as { messages?: unknown };
  if (candidate.messages !== undefined) {
    return candidate.messages;
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

function isPromiseLikeResourceResult(value: unknown): value is PromiseLikeResourceResult {
  return Boolean(value && typeof value === 'object' && typeof (value as PromiseLikeResourceResult).then === 'function');
}

function isPromiseLikePromptResult(value: unknown): value is PromiseLikePromptResult {
  return Boolean(value && typeof value === 'object' && typeof (value as PromiseLikePromptResult).then === 'function');
}

function formatUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertErrored(status: 'success' | 'error', error: string | undefined, label: string, expectedMessage?: string): void {
  if (status !== 'error') {
    throw new Error(`Expected ${label} to fail with error status`);
  }

  if (expectedMessage && !error?.includes(expectedMessage)) {
    throw new Error(`Expected error message to include '${expectedMessage}', got '${error}'`);
  }
}

function assertSuccess(status: 'success' | 'error', error: string | undefined, label: string): void {
  if (status !== 'success') {
    throw new Error(`Expected ${label} success status but got ${status}: ${error ?? 'no error info'}`);
  }
}

function normalizeExpectedDescriptor(expected: unknown): unknown {
  if (isAsymmetricMatcher(expected)) {
    return expected;
  }

  return expect.objectContaining((expected ?? {}) as Record<string, unknown>);
}
