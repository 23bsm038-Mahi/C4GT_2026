import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const COURSE_CACHE_KEY = 'tap-course-cache';
const SUBMISSION_QUEUE_KEY = 'tap-submission-queue';
const STUDENT_CACHE_KEY = 'tap-student-cache';
const DIKSHA_CACHE_KEY = 'tap-diksha-cache';

async function readJson(key, fallbackValue) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures in the prototype.
  }
}

export async function isOnline() {
  const state = await NetInfo.fetch();
  if (typeof state.isInternetReachable === 'boolean') {
    return Boolean(state.isConnected) && state.isInternetReachable;
  }

  return Boolean(state.isConnected);
}

export function subscribeToNetworkStatus(onChange) {
  return NetInfo.addEventListener((state) => {
    const online = typeof state.isInternetReachable === 'boolean'
      ? Boolean(state.isConnected) && state.isInternetReachable
      : Boolean(state.isConnected);

    onChange(online);
  });
}

export async function getCachedCourses() {
  return readJson(COURSE_CACHE_KEY, []);
}

export async function cacheCourses(courses) {
  await writeJson(COURSE_CACHE_KEY, courses);
}

export async function getCachedStudent() {
  return readJson(STUDENT_CACHE_KEY, null);
}

export async function cacheStudent(student) {
  await writeJson(STUDENT_CACHE_KEY, student);
}

export async function clearCachedStudent() {
  try {
    await AsyncStorage.removeItem(STUDENT_CACHE_KEY);
  } catch (error) {
    // Ignore remove failures in the prototype.
  }
}

export async function getCachedDikshaContent() {
  return readJson(DIKSHA_CACHE_KEY, []);
}

export async function cacheDikshaContent(items) {
  await writeJson(DIKSHA_CACHE_KEY, items);
}

export async function getQueuedSubmissions() {
  return readJson(SUBMISSION_QUEUE_KEY, []);
}

export async function queueSubmission(payload) {
  const currentQueue = await getQueuedSubmissions();
  const updatedQueue = [
    ...currentQueue,
    {
      ...payload,
      queuedAt: Date.now(),
    },
  ];

  await writeJson(SUBMISSION_QUEUE_KEY, updatedQueue);
  return updatedQueue.length;
}

export async function replaceSubmissionQueue(queue) {
  await writeJson(SUBMISSION_QUEUE_KEY, queue);
}

export async function flushQueuedSubmissions(sendSubmission) {
  const currentQueue = await getQueuedSubmissions();
  const online = await isOnline();

  if (!currentQueue.length || !online) {
    return {
      sentCount: 0,
      remainingCount: currentQueue.length,
    };
  }

  const remainingQueue = [];
  let sentCount = 0;

  for (const item of currentQueue) {
    try {
      await sendSubmission(item);
      sentCount += 1;
    } catch (error) {
      remainingQueue.push(item);
    }
  }

  await replaceSubmissionQueue(remainingQueue);

  return {
    sentCount,
    remainingCount: remainingQueue.length,
  };
}
