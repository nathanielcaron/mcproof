import {McpPromptGet, McpPromptResult, McpResourceRead, McpResourceResult, McpToolCall, McpToolResult, McpProtocolValidationResult} from './types';

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

export function validateMcpResourceRead(read: unknown): McpProtocolValidationResult {
  const invalidFields: string[] = [];

  if (typeof read !== 'object' || read === null) {
    return { isValid: false, message: 'Resource read must be an object' };
  }

  const resourceRead = read as McpResourceRead;

  if (typeof resourceRead.uri !== 'string' || resourceRead.uri.trim().length === 0) {
    invalidFields.push('uri');
  }

  if (resourceRead.requestId !== undefined && typeof resourceRead.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  if (resourceRead.timeoutMs !== undefined && (!Number.isFinite(resourceRead.timeoutMs) || resourceRead.timeoutMs < 0)) {
    invalidFields.push('timeoutMs');
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message: invalidFields.length > 0 ? `Invalid MCP resource read: ${invalidFields.join(', ')}` : 'Valid MCP resource read',
  };
}

export function validateMcpResourceResult(result: unknown): McpProtocolValidationResult {
  if (typeof result !== 'object' || result === null) {
    return { isValid: false, message: 'Resource result must be an object' };
  }

  const resourceResult = result as McpResourceResult;
  const invalidFields: string[] = [];

  if (resourceResult.status !== 'success' && resourceResult.status !== 'error') {
    invalidFields.push('status');
  }

  if (resourceResult.requestId !== undefined && typeof resourceResult.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message: invalidFields.length > 0 ? `Invalid MCP resource result: ${invalidFields.join(', ')}` : 'Valid MCP resource result',
  };
}

export function validateMcpPromptGet(get: unknown): McpProtocolValidationResult {
  const invalidFields: string[] = [];

  if (typeof get !== 'object' || get === null) {
    return { isValid: false, message: 'Prompt get must be an object' };
  }

  const promptGet = get as McpPromptGet;

  if (typeof promptGet.name !== 'string' || promptGet.name.trim().length === 0) {
    invalidFields.push('name');
  }

  if (promptGet.requestId !== undefined && typeof promptGet.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  if (promptGet.arguments !== undefined && (typeof promptGet.arguments !== 'object' || promptGet.arguments === null)) {
    invalidFields.push('arguments');
  }

  if (promptGet.timeoutMs !== undefined && (!Number.isFinite(promptGet.timeoutMs) || promptGet.timeoutMs < 0)) {
    invalidFields.push('timeoutMs');
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message: invalidFields.length > 0 ? `Invalid MCP prompt get: ${invalidFields.join(', ')}` : 'Valid MCP prompt get',
  };
}

export function validateMcpPromptResult(result: unknown): McpProtocolValidationResult {
  if (typeof result !== 'object' || result === null) {
    return { isValid: false, message: 'Prompt result must be an object' };
  }

  const promptResult = result as McpPromptResult;
  const invalidFields: string[] = [];

  if (promptResult.status !== 'success' && promptResult.status !== 'error') {
    invalidFields.push('status');
  }

  if (promptResult.requestId !== undefined && typeof promptResult.requestId !== 'string') {
    invalidFields.push('requestId');
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
    message: invalidFields.length > 0 ? `Invalid MCP prompt result: ${invalidFields.join(', ')}` : 'Valid MCP prompt result',
  };
}
