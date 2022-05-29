/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  globals: {
    "ts-jest": {
      useESM: true,
      diagnostics: {
        warnOnly: true
      }
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'js'],
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: ["<rootDir>/src/jest.setup.ts"],
  testRegex: '/tests/.+\\.test\\.ts$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts'
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  coverageProvider: "v8",
};