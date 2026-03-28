import path from 'path';

const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  setupFilesAfterEnv: [path.join(__dirname, 'autoSetup.js')],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          types: ['node', 'jest'],
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  rootDir: process.cwd(),
};

export = config;