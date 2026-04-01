jest.mock('../src/config/appConfig', () => ({
  __esModule: true,
  default: {
    frappe: {
      enabled: true,
      loginPath: '/login',
      coursesPath: '/courses',
      progressPath: '/progress',
      refreshPath: '/refresh',
      feedbackResource: 'TAP Feedback',
      tokenExpiryMs: 1000,
    },
    cache: {
      courseTtlMs: 1000,
      dikshaTtlMs: 1000,
      studentTtlMs: 1000,
    },
    sync: {
      maxAttempts: 5,
      baseRetryDelayMs: 100,
    },
  },
}));

jest.mock('../src/services/core/networkService', () => ({
  isOnline: jest.fn(async () => true),
}));

jest.mock('../src/services/offlineService', () => ({
  cacheCourses: jest.fn(async () => undefined),
  cacheStudent: jest.fn(async () => undefined),
  clearCachedStudent: jest.fn(async () => undefined),
  getCourseCacheStatus: jest.fn(async () => ({
    hasData: false,
    isExpired: true,
    savedAt: 0,
  })),
  getCachedCourses: jest.fn(async () => []),
  queueSubmission: jest.fn(async () => 1),
}));

jest.mock('../src/services/core/apiClient', () => {
  class MockApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = options.status || 0;
      this.isAuthError = Boolean(options.isAuthError);
      this.details = options.details;
    }
  }

  return {
    ApiError: MockApiError,
    requestJson: jest.fn(),
  };
});

describe('lmsRepository', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('refreshes expired tokens before loading courses', async () => {
    const { requestJson } = require('../src/services/core/apiClient');
    const { fetchCourses } = require('../src/services/lmsRepository');

    requestJson
      .mockResolvedValueOnce({
        message: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      })
      .mockResolvedValueOnce({
        message: {
          courses: [
            { id: 1, title: 'Course', description: 'Desc', category: 'Cat', department: 'Dept' },
          ],
        },
      })
      .mockResolvedValueOnce({
        message: [{ course_id: 1, progress: 50 }],
      });

    const response = await fetchCourses('student-1', {
      id: 'student-1',
      authToken: 'expired-token',
      refreshToken: 'refresh-token',
      authTokenExpiresAt: Date.now() - 1000,
      refreshTokenExpiresAt: Date.now() + 10000,
    });

    expect(requestJson).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/refresh',
        method: 'POST',
      })
    );
    expect(response.courses[0].progress).toBe(50);
    expect(response.student.authToken).toBe('new-access-token');
  });
});
