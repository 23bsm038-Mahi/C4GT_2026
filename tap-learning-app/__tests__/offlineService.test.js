jest.mock('../src/services/core/storageService', () => ({
  readJson: jest.fn(),
  removeItem: jest.fn(async () => undefined),
  writeJson: jest.fn(async () => undefined),
}));

jest.mock('../src/services/core/secureStorageService', () => ({
  readSecureJson: jest.fn(),
  removeSecureItem: jest.fn(async () => undefined),
  writeSecureJson: jest.fn(async () => undefined),
}));

describe('offlineService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('persists fallback session flags when caching a student', async () => {
    const { cacheStudent } = require('../src/services/offlineService');
    const { writeJson } = require('../src/services/core/storageService');
    const secureStorage = require('../src/services/core/secureStorageService');

    await cacheStudent({
      id: 'STU-DEMO-001',
      name: 'Demo Student',
      mobile: '9999999999',
      authMode: 'mock',
      fallbackMode: true,
      authToken: 'mock-token',
    });

    expect(writeJson).toHaveBeenCalledWith(
      'tap-student-cache',
      expect.objectContaining({
        data: expect.objectContaining({
          authMode: 'mock',
          fallbackMode: true,
        }),
      })
    );
    expect(secureStorage.writeSecureJson).toHaveBeenCalledWith(
      'tap-student-session',
      expect.objectContaining({
        authToken: 'mock-token',
      })
    );
  });
});
