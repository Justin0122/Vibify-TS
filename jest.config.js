const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/tests/**/*.test.ts'],
  transformIgnorePatterns: [
    "node_modules/(?!(ioredis|chalk)/)"
  ]
};
export default config;