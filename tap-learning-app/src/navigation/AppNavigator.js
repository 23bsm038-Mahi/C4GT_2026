import React, { Suspense, lazy, memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
const LoginScreen = lazy(() => import('../screens/LoginScreen'));
const DashboardScreen = lazy(() => import('../screens/DashboardScreen'));
const CourseScreen = lazy(() => import('../screens/CourseScreen'));

const Stack = createNativeStackNavigator();

function ScreenFallback() {
  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color="#1f6fb2" />
    </View>
  );
}

function AppNavigator({
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
}) {
  return (
    <NavigationContainer>
      {!student ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {(screenProps) => (
              <Suspense fallback={<ScreenFallback />}>
                <LoginScreen
                  {...screenProps}
                  onLogin={handleLogin}
                  isLoading={isLoading || isBootstrapping}
                  loginError={sessionExpired ? 'Your session expired. Please log in again.' : appError}
                />
              </Suspense>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#eef4fb',
            },
            headerTitleStyle: {
              fontWeight: '700',
              color: '#1f2937',
            },
          }}
        >
          <Stack.Screen name="Dashboard" options={{ title: 'GovTech Learning' }}>
            {(screenProps) => (
              <Suspense fallback={<ScreenFallback />}>
                <DashboardScreen
                  {...screenProps}
                  student={student}
                  courses={courses}
                  onLogout={handleLogout}
                  onReloadCourses={handleReloadCourses}
                isOfflineMode={isOfflineMode}
                isCacheStale={isCacheStale}
                isRefreshing={isLoading}
                appError={appError}
                syncStatus={syncStatus}
                lastSyncedAt={lastSyncedAt}
                isFallbackMode={isFallbackMode}
              />
              </Suspense>
            )}
          </Stack.Screen>
          <Stack.Screen name="Course" options={{ title: 'Course Details' }}>
            {(screenProps) => (
              <Suspense fallback={<ScreenFallback />}>
                <CourseScreen
                  {...screenProps}
                  student={student}
                  courses={courses}
                />
              </Suspense>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      )}

      {student && (isLoading || isBootstrapping) && courses.length === 0 ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1f6fb2" />
        </View>
      ) : null}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
});

export default memo(AppNavigator);
