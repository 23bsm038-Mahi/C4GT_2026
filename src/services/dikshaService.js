import {
  cacheDikshaContent,
  getCachedDikshaContent,
} from './offlineService';

const mockDikshaContent = [
  {
    identifier: 'do_113987601',
    name: 'Foundations of Problem Solving',
    contentType: 'Course',
    subject: 'Life Skills',
    board: 'NCERT',
    medium: ['English'],
    gradeLevel: ['Class 8'],
    description: 'A beginner-friendly course that introduces structured thinking and classroom problem solving.',
    artifactUrl: 'https://diksha.gov.in',
  },
  {
    identifier: 'do_113987602',
    name: 'Creative Thinking Activity Pack',
    contentType: 'Resource',
    subject: 'Creativity',
    board: 'CBSE',
    medium: ['English', 'Hindi'],
    gradeLevel: ['Class 7', 'Class 8'],
    description: 'Short guided activities that help students practice imagination, reflection, and idea building.',
    artifactUrl: 'https://diksha.gov.in',
  },
  {
    identifier: 'do_113987603',
    name: 'Digital Safety for Students',
    contentType: 'Resource',
    subject: 'Digital Literacy',
    board: 'State Board',
    medium: ['English'],
    gradeLevel: ['Class 9'],
    description: 'Simple learning material on safe device use, passwords, and responsible online behaviour.',
    artifactUrl: 'https://diksha.gov.in',
  },
];

function getBaseUrl() {
  return process.env.EXPO_PUBLIC_DIKSHA_BASE_URL || '';
}

function hasDikshaBackend() {
  return Boolean(getBaseUrl());
}

function normalizeDikshaItem(item, index) {
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

function normalizeDikshaResponse(responseData) {
  const contentItems = responseData?.result?.content || [];
  return contentItems.map(normalizeDikshaItem);
}

function buildMockResponse() {
  return {
    id: 'api.content.search',
    ver: '1.0',
    params: {
      status: 'successful',
    },
    responseCode: 'OK',
    result: {
      count: mockDikshaContent.length,
      content: mockDikshaContent,
    },
  };
}

async function fetchFromDikshaApi() {
  const response = await fetch(`${getBaseUrl()}/api/content/search`, {
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
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.params?.errmsg || 'Unable to load DIKSHA content right now.');
  }

  return data;
}

async function fetchMockDikshaApi() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(buildMockResponse());
    }, 500);
  });
}

export async function fetchDikshaContent() {
  const cachedItems = await getCachedDikshaContent();

  try {
    const responseData = hasDikshaBackend()
      ? await fetchFromDikshaApi()
      : await fetchMockDikshaApi();

    const items = normalizeDikshaResponse(responseData);
    await cacheDikshaContent(items);

    return {
      items,
      source: 'live',
    };
  } catch (error) {
    if (cachedItems.length) {
      return {
        items: cachedItems,
        source: 'cache',
      };
    }

    throw error;
  }
}
