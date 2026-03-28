import {loadSharedMcpTestClientConfigFromEnv} from '../src/env';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MCPROOF_BASE_URL;
  delete process.env.MCPROOF_TIMEOUT_MS;
  delete process.env.MCPROOF_HEADERS;
  delete process.env.MCPROOF_HEADER_AUTHORIZATION;
  delete process.env.MCPROOF_ENV_FILE;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

test('loadSharedMcpTestClientConfigFromEnv throws when base url is missing', () => {
  expect(() => loadSharedMcpTestClientConfigFromEnv({ envFilePath: './does-not-exist.env' })).toThrow(
    'MCPROOF_ENV_FILE points to a missing file:',
  );
});

test('loadSharedMcpTestClientConfigFromEnv merges JSON headers and explicit header overrides', () => {
  process.env.MCPROOF_BASE_URL = 'http://localhost:4000';
  process.env.MCPROOF_TIMEOUT_MS = '1500';
  process.env.MCPROOF_HEADERS = '{"Authorization":"Bearer from-json","x-api-key":"json-key"}';
  process.env.MCPROOF_HEADER_AUTHORIZATION = 'Bearer override';

  expect(loadSharedMcpTestClientConfigFromEnv()).toEqual({
    baseUrl: 'http://localhost:4000',
    timeoutMs: 1500,
    headers: {
      Authorization: 'Bearer override',
      'x-api-key': 'json-key',
    },
  });
});