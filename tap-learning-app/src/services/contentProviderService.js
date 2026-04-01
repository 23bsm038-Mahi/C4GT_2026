import appConfig from '../config/appConfig';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

export function normalizeDikshaItem(item, index) {
  return {
    id: item.identifier || `diksha-item-${index + 1}`,
    title: item.name || 'Untitled DIKSHA Content',
    contentType: item.contentType || 'Resource',
    subject: item.subject || 'General',
    board: item.board || 'National',
    medium: Array.isArray(item.medium) ? item.medium.join(', ') : item.medium || 'English',
    gradeLevel: Array.isArray(item.gradeLevel)
      ? item.gradeLevel.join(', ')
      : item.gradeLevel || 'Class 8',
    description: item.description || 'DIKSHA learning material',
    artifactUrl: item.artifactUrl || 'https://diksha.gov.in',
  };
}

export function normalizeDikshaResponse(responseData) {
  const contentItems = responseData?.result?.content || [];
  return contentItems.map(normalizeDikshaItem);
}

export function createDikshaProvider({
  baseUrl = appConfig.diksha.baseUrl,
  fetchImpl = fetch,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    async fetchContent() {
      if (!normalizedBaseUrl) {
        throw new Error('DIKSHA backend is not configured for this deployment.');
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request: {
            filters: {
              contentType: ['Course', 'Resource'],
            },
            limit: 6,
          },
        }),
      };
      let lastError = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetchImpl(`${normalizedBaseUrl}/api/content/search`, requestOptions);
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data?.params?.errmsg || 'Unable to load DIKSHA content right now.');
          }

          return normalizeDikshaResponse(data);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Unable to load DIKSHA content right now.');
    },
  };
}

export const dikshaProvider = createDikshaProvider();
