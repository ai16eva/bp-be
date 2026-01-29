module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.js', 
    '**/?(*.)+(spec|test).js',
    '**/src/tests/**/*.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/backup/boomplay-api-master/',
    // Legacy EVM tests - removed after migration to Solana/SVM
    '/src/tests/dao/questDaoController.test.js',
    '/src/tests/member/controller/memberControllerContract.test.js',
    '/src/tests/daily_reward/dailyRewardController.test.js'
  ],
  modulePathIgnorePatterns: [
    '/src/sdk/',
    '/src/solana-sdk/'
  ],
};
