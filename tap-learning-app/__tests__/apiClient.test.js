import { ApiError, requestJson } from '../src/services/core/apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retries transient failures and returns parsed json', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: 'https://example.gov.in/health',
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : ''),
        },
        json: async () => ({ message: { ok: true } }),
      });

    const response = await requestJson({
      baseUrl: 'https://example.gov.in',
      path: '/health',
      retryCount: 1,
      retryDelayMs: 1,
    });

    expect(response).toEqual({ message: { ok: true } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws typed auth errors for unauthorized responses', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      redirected: false,
      url: 'https://example.gov.in/protected',
      headers: {
        get: (name) => (name === 'content-type' ? 'application/json' : ''),
      },
      json: async () => ({ message: 'Unauthorized' }),
    });

    await expect(
      requestJson({
        baseUrl: 'https://example.gov.in',
        path: '/protected',
        retryCount: 0,
      })
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      isAuthError: true,
    });
  });

  it('rejects redirected html responses from misconfigured backends', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      redirected: true,
      url: 'https://cloud.frappe.io/dashboard',
      headers: {
        get: (name) => (name === 'content-type' ? 'text/html; charset=utf-8' : ''),
      },
      json: async () => ({}),
    });

    await expect(
      requestJson({
        baseUrl: 'https://demo.frappe.cloud',
        path: '/api/method/ping',
        retryCount: 0,
      })
    ).rejects.toMatchObject({
      message: 'Invalid Frappe backend URL.',
      isInvalidBackend: true,
    });
  });
});
