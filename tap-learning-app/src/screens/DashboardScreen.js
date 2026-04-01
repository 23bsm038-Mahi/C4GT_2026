import React, { Suspense, lazy, memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import StatusCard from '../components/StatusCard';
import { runBackendConnectivityTest } from '../services/frappeApi';
import { getFriendlyErrorMessage } from '../services/core/errorService';
import { isModuleEnabled } from '../services/moduleRegistry';
const DikshaContentSection = lazy(() => import('../components/DikshaContentSection'));

const CourseCard = memo(function CourseCard({ course, onOpenCourse }) {
  return (
    <View style={styles.courseCard}>
      <Text style={styles.courseTag}>{course.category}</Text>
      <Text style={styles.courseTitle}>{course.title}</Text>
      <Text style={styles.courseDescription}>{course.description}</Text>

      <View style={styles.courseMetaRow}>
        <Text style={styles.metaText}>{course.lessons.length} lessons</Text>
        <Text style={styles.metaText}>{course.progress}% complete</Text>
      </View>

      <Text style={styles.departmentText}>Department: {course.department}</Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => onOpenCourse(course.id)}
      >
        <Text style={styles.primaryButtonText}>View Course</Text>
      </Pressable>
    </View>
  );
});

function formatSyncTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return 'Last synced just now';
  }

  if (elapsedMinutes === 1) {
    return 'Last synced 1 minute ago';
  }

  if (elapsedMinutes < 60) {
    return `Last synced ${elapsedMinutes} minutes ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours === 1) {
    return 'Last synced 1 hour ago';
  }

  return `Last synced ${elapsedHours} hours ago`;
}

function DashboardScreen({
  navigation,
  student,
  courses,
  onLogout,
  onReloadCourses,
  isOfflineMode,
  isCacheStale,
  isRefreshing,
  appError,
  syncStatus,
  lastSyncedAt,
  isFallbackMode,
}) {
  const [debugState, setDebugState] = useState({
    isLoading: false,
    result: null,
    error: '',
  });
  const inProgressCount = useMemo(
    () => courses.filter((course) => course.progress > 0).length,
    [courses]
  );
  const showCourses = isModuleEnabled('localCourses');
  const showDikshaContent = isModuleEnabled('dikshaContent');
  const hasSyncBacklog = Number(syncStatus?.queueLength || 0) > 0;
  const hasSyncConflicts = Number(syncStatus?.conflictCount || 0) > 0;
  const hasSyncFailures = Number(syncStatus?.failedCount || 0) > 0;
  const handleOpenCourse = useCallback((courseId) => {
    navigation.navigate('Course', { courseId });
  }, [navigation]);
  const handleTestBackend = useCallback(async () => {
    setDebugState({
      isLoading: true,
      result: null,
      error: '',
    });

    try {
      const result = await runBackendConnectivityTest({
        name: 'Administrator',
        mobile: 'admin',
      });

      console.log('[Backend debug result]', result);
      Alert.alert(
        'Backend Test Result',
        JSON.stringify({
          backendStatus: result.backendStatus || 'unknown',
          reason: result.reason || 'connected',
          coursesCount: result.courses?.count ?? 0,
        }, null, 2)
      );

      setDebugState({
        isLoading: false,
        result,
        error: '',
      });
    } catch (error) {
      console.log('[Backend debug error]', error);
      Alert.alert(
        'Backend Test Failed',
        getFriendlyErrorMessage(error, 'app')
      );
      setDebugState({
        isLoading: false,
        result: null,
        error: getFriendlyErrorMessage(error, 'app'),
      });
    }
  }, []);

  const renderCourseCard = useCallback(({ item }) => (
    <CourseCard course={item} onOpenCourse={handleOpenCourse} />
  ), [handleOpenCourse]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const listHeader = useMemo(() => (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.heading}>Welcome, {student.name}</Text>
          <Text style={styles.subheading}>
            Your GovTech learning plan is ready for this week.
            {isOfflineMode ? ' You are currently using cached data.' : ''}
          </Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Student Overview</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Mobile</Text>
            <Text style={styles.summaryValue}>{student.mobile}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Courses</Text>
            <Text style={styles.summaryValue}>{courses.length} active courses</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>In Progress</Text>
            <Text style={styles.summaryValue}>{inProgressCount} courses started</Text>
          </View>
        </View>

        {isRefreshing ? (
          <View style={styles.refreshRow}>
            <ActivityIndicator size="small" color="#1f6fb2" />
            <Text style={styles.refreshText}>Refreshing learning content...</Text>
          </View>
        ) : null}

        {!isRefreshing && lastSyncedAt ? (
          <Text style={styles.syncText}>{formatSyncTime(lastSyncedAt)}</Text>
        ) : null}

        {isCacheStale ? (
          <Text style={styles.warningText}>
            Cached learning data may be outdated. Refresh when connectivity improves.
          </Text>
        ) : null}

        {hasSyncBacklog ? (
          <Text style={styles.infoText}>
            {syncStatus.queueLength} submission{syncStatus.queueLength > 1 ? 's' : ''} waiting to sync.
          </Text>
        ) : null}

        {hasSyncConflicts ? (
          <Text style={styles.warningText}>
            Some offline submissions need review before they can sync cleanly.
          </Text>
        ) : null}

        {hasSyncFailures ? (
          <Text style={styles.warningText}>
            Some sync attempts failed and will retry automatically.
          </Text>
        ) : null}

        {appError ? (
          <StatusCard
            title="Unable to refresh learning data"
            message={appError}
            actionLabel="Retry"
            onAction={onReloadCourses}
            tone="error"
          />
        ) : null}

        {__DEV__ ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Backend Debug</Text>
            <View style={styles.debugResults}>
              <Text style={styles.debugItem}>
                Mode: {isFallbackMode ? 'DEMO' : 'LIVE'}
              </Text>
              <Text style={styles.debugItem}>
                Last Sync: {lastSyncedAt ? formatSyncTime(lastSyncedAt) : 'Not synced yet'}
              </Text>
              <Text style={styles.debugItem}>
                Backend: {debugState.result?.backendStatus || 'not tested'}
              </Text>
            </View>

            <View style={debugState.isLoading ? styles.buttonDisabled : null}>
              <Button
                title={debugState.isLoading ? 'Testing Backend...' : 'Test Backend'}
                onPress={handleTestBackend}
                disabled={debugState.isLoading}
                color="#1f6fb2"
              />
            </View>

            {debugState.isLoading ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="small" color="#1f6fb2" />
                <Text style={styles.refreshText}>Running backend connectivity test...</Text>
              </View>
            ) : null}

            {debugState.error ? (
              <Text style={styles.debugError}>{debugState.error}</Text>
            ) : null}

            {debugState.result ? (
              <View style={styles.debugResults}>
                <Text style={styles.debugItem}>
                  Reason: {debugState.result.reason || 'connected'}
                </Text>
                <Text style={styles.debugItem}>
                  Courses: {String(debugState.result.courses?.count ?? 0)}
                </Text>
              </View>
            ) : null}

            <View style={styles.debugRetryRow}>
              <Button
                title="Retry Live Sync"
                onPress={onReloadCourses}
                disabled={isRefreshing}
                color="#1f6fb2"
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Your Courses</Text>
          <Text style={styles.sectionText}>Pick a course to continue learning.</Text>
        </View>
      </View>
    </>
  ), [
    appError,
    courses.length,
    debugState.error,
    debugState.isLoading,
    debugState.result,
    handleTestBackend,
    hasSyncBacklog,
    hasSyncConflicts,
    hasSyncFailures,
    inProgressCount,
    isCacheStale,
    isFallbackMode,
    isOfflineMode,
    isRefreshing,
    lastSyncedAt,
    onLogout,
    onReloadCourses,
    student.mobile,
    student.name,
    syncStatus.queueLength,
  ]);

  const listFooter = useMemo(() => (
    showDikshaContent ? (
      <Suspense fallback={null}>
        <DikshaContentSection />
      </Suspense>
    ) : null
  ), [showDikshaContent]);

  const emptyState = useMemo(() => {
    if (!showCourses) {
      return (
        <StatusCard
          title="Course module is disabled"
          message="This learning module is currently not available for this deployment."
        />
      );
    }

    return (
      <StatusCard
        title="No courses available right now"
        message="Try refreshing the dashboard to fetch the latest course list."
        actionLabel="Refresh Courses"
        onAction={onReloadCourses}
      />
    );
  }, [onReloadCourses, showCourses]);

  return (
    <FlatList
      data={showCourses ? courses : []}
      keyExtractor={keyExtractor}
      renderItem={renderCourseCard}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyState}
      ListFooterComponent={listFooter}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  heroCard: {
    marginBottom: 18,
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  heroText: {
    marginBottom: 14,
  },
  heading: {
    marginBottom: 6,
    fontSize: 30,
    fontWeight: '800',
    color: '#1f2937',
  },
  subheading: {
    color: '#5f6b7a',
    lineHeight: 22,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e7edf5',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontWeight: '700',
  },
  summaryCard: {
    marginBottom: 20,
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  summaryTitle: {
    marginBottom: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  summaryRow: {
    gap: 12,
  },
  summaryItem: {
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#5f6b7a',
    fontSize: 13,
  },
  summaryValue: {
    marginTop: 4,
    fontWeight: '700',
    color: '#1f2937',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  refreshText: {
    marginLeft: 8,
    color: '#1f6fb2',
    fontWeight: '600',
  },
  syncText: {
    marginTop: 10,
    color: '#516071',
    fontSize: 13,
  },
  infoText: {
    marginTop: 10,
    color: '#1f6fb2',
    fontSize: 13,
    fontWeight: '600',
  },
  warningText: {
    marginTop: 10,
    color: '#9a5b00',
    fontSize: 13,
    lineHeight: 18,
  },
  debugCard: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5edf5',
  },
  debugTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  debugResults: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  debugItem: {
    marginBottom: 6,
    color: '#334155',
  },
  debugError: {
    marginTop: 10,
    color: '#b42318',
  },
  debugRetryRow: {
    marginTop: 12,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 4,
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  sectionText: {
    color: '#5f6b7a',
  },
  courseCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  courseTag: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#eef7ec',
    color: '#25603d',
    fontWeight: '700',
    fontSize: 12,
  },
  courseTitle: {
    marginBottom: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  courseDescription: {
    marginBottom: 14,
    color: '#5f6b7a',
    lineHeight: 22,
  },
  courseMetaRow: {
    marginBottom: 12,
  },
  metaText: {
    marginBottom: 4,
    color: '#4a5565',
  },
  departmentText: {
    marginBottom: 16,
    color: '#516071',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#1f6fb2',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default DashboardScreen;
