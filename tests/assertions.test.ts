import {expectTool, expectToolCallError, expectToolCallSuccess} from '../src/assertions';
import {McpToolResult} from '../src/types';

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
    expect(() => expectToolCallSuccess(errorResult)).toThrow('Expected success status but got error');
  });

  test('expectToolCallError accepts an error-status result', () => {
    const errorResult: McpToolResult = {
      status: 'error',
      error: 'timezone is required',
    };

    expect(() => expectToolCallError(errorResult, 'timezone')).not.toThrow();
  });

  test('expectToolCallError supports rejected tool invocation promises', async () => {
    const invocation = Promise.reject(new Error('MCP error -32602: timezone is required')) as Promise<McpToolResult>;

    await expect(expectToolCallError(invocation, 'timezone')).resolves.toBeUndefined();
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

    await expect(expectToolCallError(invocation, 'timezone')).rejects.toThrow("Expected invocation failure message to include 'timezone'");
  });
});
