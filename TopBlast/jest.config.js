/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@solana/web3.js$': '<rootDir>/__mocks__/@solana/web3.js.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      }
    }]
  },
  modulePathIgnorePatterns: ['<rootDir>/whitepaper/'],
  transformIgnorePatterns: [
    'node_modules/(?!(@solana|bs58|@noble|uuid)/)',
  ],
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
}

module.exports = config

