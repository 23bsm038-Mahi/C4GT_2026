import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCourseCatalog,
  isStudentSessionExpired,
  loginStudent,
  restoreStudentSession,
  sendFeedbackSubmission,
} from '../services/lmsRepository';
import {
  cacheStudent,
  clearCachedStudent,
  flushQueuedSubmissions,
  getCourseCacheStatus,
  getCachedCourses,
  getCachedStudent,
  getQueuedSubmissions,
  isOnline,
  subscribeToNetworkStatus,
} from '../services/offlineService';
import { captureAppError, getFriendlyErrorMessage } from '../services/core/errorService';

const FALLBACK_RECOVERY_INTERVAL_MS = 30000;

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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [appError, setAppError] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    queueLength: 0,
    sentCount: 0,
    failedCount: 0,
    conflictCount: 0,
  });
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const [isCacheStale, setIsCacheStale] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const studentRef = useRef(null);
  const recoveryInFlightRef = useRef(false);

  useEffect(() => {
    studentRef.current = student;
  }, [student]);

  const refreshSyncStatus = useCallback(async (lastFlushResult = null) => {
    const queue = await getQueuedSubmissions();
    setSyncStatus({
      queueLength: queue.length,
      sentCount: Number(lastFlushResult?.sentCount || 0),
      failedCount: Number(lastFlushResult?.failedCount || 0),
      conflictCount: Number(lastFlushResult?.conflictCount || 0),
    });
  }, []);

  const syncLiveCoursesIfPossible = useCallback(async (activeStudent, options = {}) => {
    if (!activeStudent) {
      return;
    }

    const catalogOptions = {
      preferCache: Boolean(options.preferCache),
    };

    if (options.forceRefresh) {
      catalogOptions.forceRefresh = true;
    }

    const courseCatalog = await getCourseCatalog(
      activeStudent.id,
      activeStudent,
      catalogOptions
    );

    if (courseCatalog.student) {
      setStudent(courseCatalog.student);
    }
    setIsFallbackMode(
      courseCatalog.source === 'fallback'
      || Boolean(courseCatalog.student?.authMode === 'mock')
    );
    setCourses(sanitizeCourseList(courseCatalog.courses));
    setIsOfflineMode(courseCatalog.source !== 'live');
    setIsCacheStale(Boolean(courseCatalog.cacheStatus?.isExpired));
    if (courseCatalog.source === 'live') {
      setLastSyncedAt(Date.now());
    }
  }, []);

  const attemptAutomaticRecovery = useCallback(async ({ suppressErrors = true } = {}) => {
    const activeStudent = studentRef.current;

    if (!activeStudent || recoveryInFlightRef.current) {
      return false;
    }

    recoveryInFlightRef.current = true;

    try {
      const result = await flushQueuedSubmissions((payload) =>
        sendFeedbackSubmission(payload, payload.authContext || payload.authToken || activeStudent || '')
      );
      await refreshSyncStatus(result);
      await syncLiveCoursesIfPossible(activeStudent, { forceRefresh: true });
      setAppError('');
      return true;
    } catch (error) {
      captureAppError(error, { label: 'Automatic recovery' });

      if (!suppressErrors) {
        setAppError(getFriendlyErrorMessage(error, 'courses'));
      }

      return false;
    } finally {
      recoveryInFlightRef.current = false;
    }
  }, [refreshSyncStatus, syncLiveCoursesIfPossible]);

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
      const cacheStatus = await getCourseCacheStatus().catch(() => ({
        hasData: safeCachedCourses.length > 0,
        isExpired: false,
        savedAt: 0,
      }));

      if (isMounted) {
        setIsCacheStale(cacheStatus.isExpired);
      }

      if (!isMounted || !cachedStudent) {
        if (isMounted) {
          setIsFallbackMode(false);
          setIsBootstrapping(false);
        }
        return;
      }

      if (isStudentSessionExpired(cachedStudent)) {
        try {
          const restoredStudent = await restoreStudentSession(cachedStudent);

          if (restoredStudent) {
            cachedStudent = restoredStudent;
          } else {
            await clearCachedStudent();
            if (isMounted) {
              setSessionExpired(true);
              setStudent(null);
              setCourses([]);
              setIsBootstrapping(false);
            }
            return;
          }
        } catch (error) {
          await clearCachedStudent();
          captureAppError(error, { label: 'Session restore' });
          if (isMounted) {
            setSessionExpired(true);
            setAppError(getFriendlyErrorMessage(error, 'auth'));
            setStudent(null);
            setCourses([]);
            setIsBootstrapping(false);
          }
          return;
        }
      }

      setStudent(cachedStudent);
      setIsFallbackMode(Boolean(cachedStudent?.authMode === 'mock' || cachedStudent?.fallbackMode));
      if (safeCachedCourses.length) {
        setCourses(safeCachedCourses);
      }

      if (online) {
        try {
          await syncLiveCoursesIfPossible(cachedStudent, {
            preferCache: !cacheStatus.isExpired,
          });
        } catch (error) {
          captureAppError(error, { label: 'Course bootstrap' });
          if (isMounted) {
            setIsOfflineMode(true);
            setAppError(getFriendlyErrorMessage(error, 'courses'));
            setSessionExpired(Boolean(error?.isAuthError));
          }
        }
      }

      if (isMounted) {
        setIsBootstrapping(false);
      }
    }

    restoreSession();
    refreshSyncStatus();

    return () => {
      isMounted = false;
    };
  }, [refreshSyncStatus, syncLiveCoursesIfPossible]);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(async (online) => {
      setIsOfflineMode(!online);

      if (online) {
        try {
          const didRecover = await attemptAutomaticRecovery();
          if (!didRecover) {
            if (studentRef.current) {
              await syncLiveCoursesIfPossible(studentRef.current);
            } else {
              setLastSyncedAt(Date.now());
            }
          } else {
            setLastSyncedAt(Date.now());
          }
        } catch (error) {
          captureAppError(error, { label: 'Queued submission sync' });
          await refreshSyncStatus({
            sentCount: 0,
            failedCount: 1,
            conflictCount: 0,
          });
          // Don't turn a bad sync pass into a broken session.
        }
      } else {
        await refreshSyncStatus();
      }
    });

    return unsubscribe;
  }, [attemptAutomaticRecovery, refreshSyncStatus, syncLiveCoursesIfPossible]);

  useEffect(() => {
    if (!student || (!isFallbackMode && !isOfflineMode)) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      attemptAutomaticRecovery();
    }, FALLBACK_RECOVERY_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [attemptAutomaticRecovery, isFallbackMode, isOfflineMode, student]);

  const loadCourses = useCallback(async (studentDetails, options = {}) => {
    setIsLoading(true);
    setAppError('');
    setSessionExpired(false);

    try {
      const studentProfile = await loginStudent(studentDetails);
      setStudent(studentProfile);
      setIsFallbackMode(Boolean(studentProfile?.authMode === 'mock' || studentProfile?.fallbackMode));
      await cacheStudent(studentProfile);

      const cachedCourses = sanitizeCourseList(await getCachedCourses());
      if (cachedCourses.length) {
        setCourses(cachedCourses);
      }

      try {
        await syncLiveCoursesIfPossible(studentProfile, {
          forceRefresh: Boolean(options.forceRefresh),
        });
      } catch (error) {
        if (cachedCourses.length) {
          setIsOfflineMode(true);
          setCourses(cachedCourses);
        } else {
          captureAppError(error, { label: 'Course fetch' });
          throw error;
        }
      }
    } catch (error) {
      captureAppError(error, { label: 'App load' });
      setStudent(null);
      setCourses([]);
      setIsFallbackMode(false);
      setAppError(getFriendlyErrorMessage(error, student ? 'courses' : 'auth'));
      setSessionExpired(Boolean(error?.isAuthError));
    } finally {
      await refreshSyncStatus();
      setIsBootstrapping(false);
      setIsLoading(false);
    }
  }, [refreshSyncStatus, syncLiveCoursesIfPossible]);

  const handleLogin = useCallback(async (formValues) => {
    await loadCourses(formValues, { forceRefresh: true });
  }, [loadCourses]);

  const handleLogout = useCallback(async () => {
    setStudent(null);
    setCourses([]);
    setAppError('');
    setIsLoading(false);
    setSessionExpired(false);
    setIsFallbackMode(false);
    await clearCachedStudent();
  }, []);

  const handleReloadCourses = useCallback(async () => {
    if (student) {
      await loadCourses(student, { forceRefresh: true });
    }
  }, [loadCourses, student]);

  return {
    student,
    courses,
    isLoading,
    isBootstrapping,
    appError,
    isOfflineMode,
    isCacheStale,
    syncStatus,
    lastSyncedAt,
    sessionExpired,
    isFallbackMode,
    handleLogin,
    handleLogout,
    handleReloadCourses,
  };
}

export default useAppController;
