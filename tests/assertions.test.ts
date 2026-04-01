import {
  expectPrompt,
  expectPromptGetContent,
  expectPromptGetError,
  expectPromptGetMeta,
  expectPromptGetSuccess,
  expectResource,
  expectResourceReadContent,
  expectResourceReadError,
  expectResourceReadMeta,
  expectResourceReadSuccess,
  expectTool,
  expectToolCallError,
  expectToolCallSuccess,
} from '../src/assertions';
import {McpPromptResult, McpResourceResult, McpToolResult} from '../src/types';

describe('assertions helper behavior', () => {
  test('expectTool succeeds for an exact tool name', async () => {
    const client = {
      listAvailableTools: jest.fn().mockResolvedValue(['weather.current', 'time.current']),
    };

    await expect(expectTool(client, 'weather.current')).resolves.toBeUndefined();
    expect(client.listAvailableTools).toHaveBeenCalledTimes(1);
  });

  test('expectTool fails when tool is not present', async () => {
    const client = {
      listAvailableTools: jest.fn().mockResolvedValue(['weather.current', 'time.current']),
    };

    await expect(expectTool(client, 'weather.forecast')).rejects.toThrow("Expected MCP server to expose tool 'weather.forecast'");
  });

  test('expectTool does not pass for partial or similar names', async () => {
    const client = {
      listAvailableTools: jest.fn().mockResolvedValue(['weather.current']),
    };

    await expect(expectTool(client, 'weather')).rejects.toThrow("Expected MCP server to expose tool 'weather'");
  });

  test('missing tool check fails before a success assertion would fail on error result', async () => {
    const client = {
      listAvailableTools: jest.fn().mockResolvedValue(['weather.current']),
    };

    const errorResult: McpToolResult = {
      status: 'error',
      error: 'unknown tool',
    };

    await expect(expectTool(client, 'weather.forecast')).rejects.toThrow("Expected MCP server to expose tool 'weather.forecast'");
    expect(() => expectToolCallSuccess(errorResult)).toThrow('Expected tool call success status but got error');
  });

  test('expectToolCallError accepts an error-status result', () => {
    const errorResult: McpToolResult = {
      status: 'error',
      error: 'timezone is required',
    };

    expect(() => expectToolCallError(errorResult, 'timezone is required')).not.toThrow();
  });

  test('expectToolCallError supports rejected tool invocation promises', async () => {
    const invocation = Promise.reject(new Error('MCP error -32602: timezone is required')) as Promise<McpToolResult>;

    await expect(expectToolCallError(invocation, 'MCP error -32602: timezone is required')).resolves.toBeUndefined();
  });

  test('expectToolCallError rejects when invocation resolves with success', async () => {
    const invocation = Promise.resolve({
      status: 'success',
      output: {ok: true},
    } as McpToolResult);

    await expect(expectToolCallError(invocation)).rejects.toThrow('Expected tool call to fail with error status');
  });

  test('expectToolCallError rejects when thrown error message does not match expected text', async () => {
    const invocation = Promise.reject(new Error('MCP error -32602: invalid input')) as Promise<McpToolResult>;

    await expect(expectToolCallError(invocation, 'MCP error -32602: timezone is required')).rejects.toThrow();
  });

  test('expectResource succeeds for an exact resource uri', async () => {
    const client = {
      listResources: jest.fn().mockResolvedValue([
        { name: 'Weather Data', uri: 'resource://weather/current', mimeType: 'application/json' },
      ]),
    };

    await expect(expectResource(client, 'resource://weather/current')).resolves.toBeUndefined();
    expect(client.listResources).toHaveBeenCalledTimes(1);
  });

  test('expectResource supports subset descriptor matching', async () => {
    const client = {
      listResources: jest.fn().mockResolvedValue([
        { name: 'Weather Data', uri: 'resource://weather/current', mimeType: 'application/json', description: 'Current weather' },
      ]),
    };

    await expect(
      expectResource(client, 'resource://weather/current', {
        name: 'Weather Data',
        mimeType: 'application/json',
      }),
    ).resolves.toBeUndefined();
  });

  test('expectResource fails when resource uri is not present', async () => {
    const client = {
      listResources: jest.fn().mockResolvedValue([
        { name: 'Weather Data', uri: 'resource://weather/current' },
      ]),
    };

    await expect(expectResource(client, 'resource://weather/forecast')).rejects.toThrow(
      "Expected MCP server to expose resource 'resource://weather/forecast'",
    );
  });

  test('expectPrompt succeeds for an exact prompt name', async () => {
    const client = {
      listPrompts: jest.fn().mockResolvedValue([
        { name: 'summarize.weather', argumentCount: 1, description: 'Summarize weather output' },
      ]),
    };

    await expect(expectPrompt(client, 'summarize.weather')).resolves.toBeUndefined();
    expect(client.listPrompts).toHaveBeenCalledTimes(1);
  });

  test('expectPrompt supports subset descriptor matching', async () => {
    const client = {
      listPrompts: jest.fn().mockResolvedValue([
        { name: 'summarize.weather', argumentCount: 1, description: 'Summarize weather output' },
      ]),
    };

    await expect(
      expectPrompt(client, 'summarize.weather', {
        argumentCount: 1,
      }),
    ).resolves.toBeUndefined();
  });

  test('expectPrompt fails when prompt name is not present', async () => {
    const client = {
      listPrompts: jest.fn().mockResolvedValue([
        { name: 'summarize.weather', argumentCount: 1 },
      ]),
    };

    await expect(expectPrompt(client, 'summarize.time')).rejects.toThrow("Expected MCP server to expose prompt 'summarize.time'");
  });

  test('expectResourceReadSuccess and expectPromptGetSuccess validate success status', () => {
    const resourceResult: McpResourceResult = {
      status: 'success',
      output: { contents: [{ uri: 'resource://weather/current', text: '{"forecast":"sunny"}' }] },
    };
    const promptResult: McpPromptResult = {
      status: 'success',
      output: { messages: [{ role: 'assistant', content: { type: 'text', text: 'Sunny today.' } }] },
    };

    expect(() => expectResourceReadSuccess(resourceResult)).not.toThrow();
    expect(() => expectPromptGetSuccess(promptResult)).not.toThrow();
  });

  test('expectResourceReadError supports rejected read promises', async () => {
    const invocation = Promise.reject(new Error('resource not found')) as Promise<McpResourceResult>;

    await expect(expectResourceReadError(invocation, 'resource not found')).resolves.toBeUndefined();
  });

  test('expectPromptGetError supports rejected prompt promises', async () => {
    const invocation = Promise.reject(new Error('prompt not found')) as Promise<McpPromptResult>;

    await expect(expectPromptGetError(invocation, 'prompt not found')).resolves.toBeUndefined();
  });

  test('expectResourceReadContent and expectPromptGetContent normalize expected payloads', () => {
    const resourceResult: McpResourceResult = {
      status: 'success',
      output: {
        contents: [
          {
            uri: 'resource://weather/current',
            mimeType: 'application/json',
            text: '{"city":"Montreal"}',
          },
        ],
      },
    };

    const promptResult: McpPromptResult = {
      status: 'success',
      output: {
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'Hello',
            },
          },
        ],
      },
    };

    expect(() =>
      expectResourceReadContent(resourceResult, [
        {
          uri: 'resource://weather/current',
          mimeType: 'application/json',
          text: '{"city":"Montreal"}',
        },
      ]),
    ).not.toThrow();

    expect(() =>
      expectPromptGetContent(promptResult, [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'Hello',
          },
        },
      ]),
    ).not.toThrow();
  });

  test('expectResourceReadMeta and expectPromptGetMeta validate _meta presence and content', () => {
    const resourceResult: McpResourceResult = {
      status: 'success',
      output: {
        _meta: { source: 'mock-server' },
        contents: [],
      },
    };

    const promptResult: McpPromptResult = {
      status: 'success',
      output: {
        _meta: { source: 'mock-server' },
        messages: [],
      },
    };

    expect(() => expectResourceReadMeta(resourceResult)).not.toThrow();
    expect(() => expectResourceReadMeta(resourceResult, { source: 'mock-server' })).not.toThrow();
    expect(() => expectPromptGetMeta(promptResult)).not.toThrow();
    expect(() => expectPromptGetMeta(promptResult, { source: 'mock-server' })).not.toThrow();
  });
});
