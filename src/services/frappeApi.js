import { courseList } from '../courseData';
import {
  cacheCourses,
  isOnline,
  queueSubmission,
} from './offlineService';

function cloneCourses() {
  return courseList.map((course) => ({
    ...course,
    lessons: [...course.lessons],
  }));
}

function getBaseUrl() {
  return process.env.EXPO_PUBLIC_FRAPPE_BASE_URL || '';
}

function hasFrappeBackend() {
  return Boolean(getBaseUrl());
}

function buildUrl(path) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Frappe request failed.');
  }

  return data;
}

function mapCourseRecord(course, index) {
  return {
    name: `COURSE-${index + 1}`,
    title: course.title,
    description: course.description,
    category: course.category,
    department: course.department,
    progress: course.progress,
    lessons: course.lessons,
  };
}

function buildMockCourseResponse(studentId) {
  const courses = cloneCourses().map(mapCourseRecord);

  return {
    message: {
      student_id: studentId,
      courses,
    },
  };
}

function buildMockProgressResponse(studentId) {
  return {
    message: cloneCourses().map((course, index) => ({
      name: `PROGRESS-${index + 1}`,
      student: studentId,
      course: `COURSE-${index + 1}`,
      progress: course.progress,
    })),
  };
}

function normalizeCourseList(responseData) {
  const rawCourses =
    responseData?.message?.courses ||
    responseData?.message ||
    responseData?.data ||
    [];

  return rawCourses.map((course, index) => ({
    id: Number(course.id || course.name?.replace('COURSE-', '') || index + 1),
    title: course.title || course.course_title || 'Untitled Course',
    description: course.description || 'Course description is not available.',
    category: course.category || course.course_category || 'General',
    department: course.department || course.owner_department || 'Learning Team',
    progress: Number(course.progress || 0),
    lessons: Array.isArray(course.lessons) ? course.lessons : [],
  }));
}

function normalizeProgressMap(responseData) {
  const progressItems = responseData?.message || responseData?.data || [];

  return progressItems.reduce((result, item) => {
    const courseId = Number(item.course?.replace('COURSE-', '') || item.course_id || item.id);
    if (courseId) {
      result[courseId] = Number(item.progress || 0);
    }
    return result;
  }, {});
}

async function requestFrappeLogin(student) {
  const response = await fetch(buildUrl('/api/method/tap_lms.api.student_login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      full_name: student.name,
      mobile_number: student.mobile,
    }),
  });

  const data = await parseJsonResponse(response);

  return {
    ...student,
    id: data?.message?.student_id || data?.message?.name || `student-${student.mobile.slice(-4)}`,
    authToken: data?.message?.api_key || '',
  };
}

function requestMockLogin(student) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (student.mobile === '0000000000') {
        reject(new Error('Unable to connect to the learning service right now.'));
        return;
      }

      resolve({
        ...student,
        id: `student-${student.mobile.slice(-4)}`,
        authToken: 'mock-token',
      });
    }, 500);
  });
}

async function requestFrappeCourses(studentId, authToken = '') {
  const response = await fetch(
    buildUrl(`/api/method/tap_lms.api.get_student_courses?student=${encodeURIComponent(studentId)}`),
    {
      headers: authToken
        ? {
            Authorization: `token ${authToken}`,
          }
        : {},
    }
  );

  return parseJsonResponse(response);
}

function requestMockCourses(studentId) {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      if (!(await isOnline())) {
        reject(new Error('Unable to reach the learning service right now.'));
        return;
      }

      resolve(buildMockCourseResponse(studentId));
    }, 800);
  });
}

async function requestFrappeProgress(studentId, authToken = '') {
  const response = await fetch(
    buildUrl(`/api/method/tap_lms.api.get_student_progress?student=${encodeURIComponent(studentId)}`),
    {
      headers: authToken
        ? {
            Authorization: `token ${authToken}`,
          }
        : {},
    }
  );

  return parseJsonResponse(response);
}

function requestMockProgress(studentId) {
  return Promise.resolve(buildMockProgressResponse(studentId));
}

function mergeCoursesWithProgress(courses, progressMap) {
  return courses.map((course) => ({
    ...course,
    progress: progressMap[course.id] ?? course.progress,
  }));
}

function normalizeSubmissionMessage(data) {
  return {
    success: true,
    message: data?.message || 'Feedback submitted successfully.',
  };
}

export async function loginStudent(student) {
  const online = await isOnline();

  if (!online && !hasFrappeBackend()) {
    return requestMockLogin(student);
  }

  if (hasFrappeBackend()) {
    return requestFrappeLogin(student);
  }

  return requestMockLogin(student);
}

export async function fetchStudentProgress(studentId, authToken = '') {
  const responseData = hasFrappeBackend()
    ? await requestFrappeProgress(studentId, authToken)
    : await requestMockProgress(studentId);

  return normalizeProgressMap(responseData);
}

export async function fetchCourses(studentId, authToken = '') {
  if (!(await isOnline())) {
    throw new Error('Unable to reach the learning service right now.');
  }

  const courseResponse = hasFrappeBackend()
    ? await requestFrappeCourses(studentId, authToken)
    : await requestMockCourses(studentId);

  const progressMap = await fetchStudentProgress(studentId, authToken);
  const normalizedCourses = mergeCoursesWithProgress(
    normalizeCourseList(courseResponse),
    progressMap
  );

  await cacheCourses(normalizedCourses);
  return normalizedCourses;
}

export async function sendQueuedFeedback(payload) {
  if (!(await isOnline())) {
    throw new Error('Still offline');
  }

  if (hasFrappeBackend()) {
    const response = await fetch(buildUrl('/api/resource/TAP Feedback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          student_name: payload.studentName,
          course_id: payload.courseId,
          feedback: payload.feedback,
        },
      }),
    });

    const data = await parseJsonResponse(response);
    return normalizeSubmissionMessage(data);
  }

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!payload.studentName.trim()) {
        reject(new Error('Name is required before submitting feedback.'));
        return;
      }

      if (payload.feedback.trim().length < 5) {
        reject(new Error('Feedback is too short. Please write a little more.'));
        return;
      }

      resolve({
        success: true,
        message: 'Feedback submitted successfully. Your mentor can review it later.',
      });
    }, 700);
  });
}

export async function submitCourseFeedback(payload) {
  if (!payload.studentName.trim()) {
    throw new Error('Name is required before submitting feedback.');
  }

  if (payload.feedback.trim().length < 5) {
    throw new Error('Feedback is too short. Please write a little more.');
  }

  if (!(await isOnline())) {
    await queueSubmission(payload);
    return {
      success: true,
      queued: true,
      message: 'Offline Mode: feedback saved locally and will be sent when internet is back.',
    };
  }

  return sendQueuedFeedback(payload);
}
