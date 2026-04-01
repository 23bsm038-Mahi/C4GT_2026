import appConfig from '../config/appConfig';

const fallbackCoursesResponse = {
  message: [
    {
      id: 101,
      course_title: 'Digital Skills',
      description: 'Intro course',
      course_category: 'Foundation',
      lessons: [
        { title: 'Lesson 1', duration: '10 min' },
      ],
    },
  ],
};

const fallbackProgressResponse = {
  message: [
    { course_id: 101, progress: 45 },
  ],
};

export function buildFallbackStudent(student = {}) {
  return {
    id: 'STU-DEMO-001',
    name: student.name || 'Demo Student',
    mobile: student.mobile || '',
    authMode: 'mock',
    authToken: 'mock-token',
    refreshToken: '',
    authTokenExpiresAt: Date.now() + appConfig.frappe.tokenExpiryMs,
    refreshTokenExpiresAt: 0,
    sessionCookie: '',
    fallbackMode: true,
  };
}

export function getFallbackCoursesResponse() {
  return fallbackCoursesResponse;
}

export function getFallbackProgressResponse() {
  return fallbackProgressResponse;
}
