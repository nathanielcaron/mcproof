import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {McpEnvConfigOptions, McpSharedClientConfig} from './types';

const DEFAULT_ENV_FILE = '.env.mcproof';
const HEADER_PREFIX = 'MCPROOF_HEADER_';

function resolveEnvFilePath(options?: McpEnvConfigOptions): { envFilePath: string; isOverride: boolean } {
  const overridePath = options?.envFilePath ?? process.env.MCPROOF_ENV_FILE;

  return {
    envFilePath: path.resolve(process.cwd(), overridePath ?? DEFAULT_ENV_FILE),
    isOverride: Boolean(overridePath),
  };
}

function loadEnvFile(options?: McpEnvConfigOptions): void {
  const { envFilePath, isOverride } = resolveEnvFilePath(options);

  if (!fs.existsSync(envFilePath)) {
    if (isOverride) {
      throw new Error(`MCPROOF_ENV_FILE points to a missing file: ${envFilePath}`);
    }

    return;
  }

  dotenv.config({
    path: envFilePath,
    override: false,
  });
}

function parseTimeout(rawTimeout: string | undefined): number | undefined {
  if (!rawTimeout) {
    return undefined;
  }

  const parsedTimeout = Number.parseInt(rawTimeout, 10);

  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    throw new Error(`MCPROOF_TIMEOUT_MS must be a positive integer. Received: ${rawTimeout}`);
  }

  return parsedTimeout;
}

function parseHeaderName(rawName: string): string {
  const normalized = rawName.toLowerCase().replace(/_/g, '-');

  if (normalized === 'authorization') {
    return 'Authorization';
  }

  return normalized;
}

function parseHeadersFromJson(rawHeaders: string | undefined): Record<string, string> {
  if (!rawHeaders) {
    return {};
  }

  let parsedHeaders: unknown;

  try {
    parsedHeaders = JSON.parse(rawHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`MCPROOF_HEADERS must be valid JSON. ${message}`);
  }

  if (!parsedHeaders || typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders)) {
    throw new Error('MCPROOF_HEADERS must resolve to an object map of header names to values.');
  }

  return Object.entries(parsedHeaders).reduce<Record<string, string>>((result, [key, value]) => {
    result[key] = String(value);
    return result;
  }, {});
}

function parseHeadersFromPrefixedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.entries(env).reduce<Record<string, string>>((result, [key, value]) => {
    if (!key.startsWith(HEADER_PREFIX) || value === undefined) {
      return result;
    }

    const rawHeaderName = key.slice(HEADER_PREFIX.length);

    if (!rawHeaderName) {
      return result;
    }

    result[parseHeaderName(rawHeaderName)] = value;
    return result;
  }, {});
}

export function loadSharedMcpTestClientConfigFromEnv(options?: McpEnvConfigOptions): McpSharedClientConfig {
  loadEnvFile(options);

  const baseUrl = process.env.MCPROOF_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      'MCPROOF_BASE_URL is required. Create a .env.mcproof file or set MCPROOF_ENV_FILE to a valid env file.',
    );
  }

  const headers = {
    ...parseHeadersFromJson(process.env.MCPROOF_HEADERS),
    ...parseHeadersFromPrefixedEnv(process.env),
  };

  return {
    baseUrl,
    timeoutMs: parseTimeout(process.env.MCPROOF_TIMEOUT_MS),
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
}