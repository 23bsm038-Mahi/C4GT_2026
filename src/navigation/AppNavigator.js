import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CourseScreen from '../screens/CourseScreen';

const Stack = createNativeStackNavigator();

function AppNavigator({
  student,
  courses,
  isLoading,
  appError,
  isOfflineMode,
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
              <LoginScreen
                {...screenProps}
                onLogin={handleLogin}
                isLoading={isLoading}
                loginError={appError}
              />
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
              <DashboardScreen
                {...screenProps}
                student={student}
                courses={courses}
                onLogout={handleLogout}
                onReloadCourses={handleReloadCourses}
                isOfflineMode={isOfflineMode}
                isRefreshing={isLoading}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Course" options={{ title: 'Course Details' }}>
            {(screenProps) => (
              <CourseScreen
                {...screenProps}
                student={student}
                courses={courses}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      )}

      {student && isLoading && courses.length === 0 ? (
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

export default AppNavigator;
