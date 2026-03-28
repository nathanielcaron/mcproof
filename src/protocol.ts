import {McpToolCall, McpToolResult, McpProtocolValidationResult} from './types';

export function validateMcpToolCall(call: unknown): McpProtocolValidationResult {
  const missing: string[] = [];
  const invalidFields: string[] = [];

  if (typeof call !== 'object' || call === null) {
    return { isValid: false, message: 'Tool call must be an object' };
  }

  const toolCall = call as McpToolCall;

  if (typeof toolCall.name !== 'string' || toolCall.name.trim().length === 0) {
    invalidFields.push('name');
  }

  if (toolCall.requestId !== undefined && typeof toolCall.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  if (toolCall.input !== undefined && typeof toolCall.input !== 'object') {
    invalidFields.push('input');
  }

  return {
    isValid: missing.length === 0 && invalidFields.length === 0,
    missing: missing.length > 0 ? missing : undefined,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message:
      missing.length || invalidFields.length
        ? `Invalid MCP call: ${[...missing, ...invalidFields].join(', ')}`
        : 'Valid MCP tool call',
  };
}

export function validateMcpToolResult(result: unknown): McpProtocolValidationResult {
  if (typeof result !== 'object' || result === null) {
    return { isValid: false, message: 'Tool result must be an object' };
  }

  const toolResult = result as McpToolResult;
  const invalidFields: string[] = [];

  if (toolResult.status !== 'success' && toolResult.status !== 'error') {
    invalidFields.push('status');
  }

  if (toolResult.requestId !== undefined && typeof toolResult.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message: invalidFields.length > 0 ? `Invalid MCP result: ${invalidFields.join(', ')}` : 'Valid MCP tool result',
  };
}
