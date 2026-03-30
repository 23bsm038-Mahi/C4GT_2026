import { useCallback, useEffect, useState } from 'react';
import { fetchCourses, loginStudent, sendQueuedFeedback } from '../services/frappeApi';
import {
  cacheStudent,
  clearCachedStudent,
  flushQueuedSubmissions,
  getCachedCourses,
  getCachedStudent,
  isOnline,
  subscribeToNetworkStatus,
} from '../services/offlineService';

function sanitizeCourse(course, index) {
  const safeLessons = Array.isArray(course?.lessons) ? course.lessons : [];

  return {
    id: Number(course?.id || index + 1),
    title: course?.title || 'Untitled Course',
    category: course?.category || 'General',
    department: course?.department || 'Learning Team',
    description: course?.description || 'Course description is not available.',
    progress: Number.isFinite(Number(course?.progress)) ? Number(course.progress) : 0,
    lessons: safeLessons.map((lesson, lessonIndex) => ({
      id: lesson?.id || lessonIndex + 1,
      title: lesson?.title || 'Untitled Lesson',
      duration: lesson?.duration || '10 min',
    })),
  };
}

function sanitizeCourseList(courses) {
  if (!Array.isArray(courses)) {
    return [];
  }

  return courses.map(sanitizeCourse);
}

function useAppController() {
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      let online = false;

      try {
        online = await isOnline();
      } catch (error) {
        online = false;
      }

      if (isMounted) {
        setIsOfflineMode(!online);
      }

      let cachedStudent = null;
      let cachedCourses = [];

      try {
        [cachedStudent, cachedCourses] = await Promise.all([
          getCachedStudent(),
          getCachedCourses(),
        ]);
      } catch (error) {
        cachedStudent = null;
        cachedCourses = [];
      }

      const safeCachedCourses = sanitizeCourseList(cachedCourses);

      if (!isMounted || !cachedStudent || !safeCachedCourses.length) {
        return;
      }

      setStudent(cachedStudent);
      setCourses(safeCachedCourses);

      if (online) {
        try {
          const freshCourses = await fetchCourses(cachedStudent.id, cachedStudent.authToken);
          if (isMounted) {
            setCourses(sanitizeCourseList(freshCourses));
            setIsOfflineMode(false);
          }
        } catch (error) {
          if (isMounted) {
            setIsOfflineMode(true);
          }
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(async (online) => {
      setIsOfflineMode(!online);

      if (online) {
        try {
          await flushQueuedSubmissions(sendQueuedFeedback);
        } catch (error) {
          // Keep the app usable even if queued sync fails.
        }
      }
    });

    return unsubscribe;
  }, []);

  const loadCourses = useCallback(async (studentDetails) => {
    setIsLoading(true);
    setAppError('');

    try {
      const studentProfile = await loginStudent(studentDetails);
      setStudent(studentProfile);
      await cacheStudent(studentProfile);

      const cachedCourses = sanitizeCourseList(await getCachedCourses());
      if (cachedCourses.length) {
        setCourses(cachedCourses);
      }

      try {
        const fetchedCourses = await fetchCourses(studentProfile.id, studentProfile.authToken);
        setCourses(sanitizeCourseList(fetchedCourses));
        setIsOfflineMode(false);
      } catch (error) {
        if (cachedCourses.length) {
          setIsOfflineMode(true);
          setCourses(cachedCourses);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setStudent(null);
      setCourses([]);
      setAppError(error.message || 'Something went wrong while loading the app.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (formValues) => {
    await loadCourses(formValues);
  }, [loadCourses]);

  const handleLogout = useCallback(async () => {
    setStudent(null);
    setCourses([]);
    setAppError('');
    setIsLoading(false);
    await clearCachedStudent();
  }, []);

  const handleReloadCourses = useCallback(async () => {
    if (student) {
      await loadCourses(student);
    }
  }, [loadCourses, student]);

  return {
    student,
    courses,
    isLoading,
    appError,
    isOfflineMode,
    handleLogin,
    handleLogout,
    handleReloadCourses,
  };
}

export default useAppController;
