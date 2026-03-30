import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import StatusCard from '../components/StatusCard';
import DikshaContentSection from '../components/DikshaContentSection';
import { isModuleEnabled } from '../services/moduleRegistry';

function DashboardScreen({
  navigation,
  student,
  courses,
  onLogout,
  onReloadCourses,
  isOfflineMode,
  isRefreshing,
}) {
  const inProgressCount = courses.filter((course) => course.progress > 0).length;
  const showCourses = isModuleEnabled('localCourses');
  const showDikshaContent = isModuleEnabled('dikshaContent');

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
      </View>

      {showCourses ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Courses</Text>
              <Text style={styles.sectionText}>Pick a course to continue learning.</Text>
            </View>
          </View>

          {courses.length === 0 ? (
            <StatusCard
              title="No courses available right now"
              message="Try refreshing the dashboard to fetch the latest course list."
              actionLabel="Refresh Courses"
              onAction={onReloadCourses}
            />
          ) : (
            courses.map((course) => (
              <View key={course.id} style={styles.courseCard}>
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
                  onPress={() => navigation.navigate('Course', { courseId: course.id })}
                >
                  <Text style={styles.primaryButtonText}>View Course</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : (
        <StatusCard
          title="Course module is disabled"
          message="This learning module is currently not available for this deployment."
        />
      )}

      {showDikshaContent ? <DikshaContentSection /> : null}
    </ScrollView>
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
});

export default DashboardScreen;
