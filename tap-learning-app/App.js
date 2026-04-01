import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import StartupStatusScreen from './src/components/StartupStatusScreen';
import AppNavigator from './src/navigation/AppNavigator';
import useAppController from './src/hooks/useAppController';
import appConfig from './src/config/appConfig';
import {
  validateBackendConnection,
  validateEnvironmentConfig,
} from './src/services/core/envValidationService';

function App() {
  const environmentState = validateEnvironmentConfig();
  const appController = useAppController();
  const [backendState, setBackendState] = useState({
    status: 'checking',
    message: '',
    issues: [],
  });
  const showDemoFallbackBanner =
    appController.isFallbackMode
    || (backendState.status === 'invalid' && appConfig.fallback.useOnFailure);

  useEffect(() => {
    let isMounted = true;

    async function runStartupValidation() {
      if (!environmentState.isValid) {
        if (isMounted) {
          setBackendState({
            status: 'invalid',
            message: 'Invalid Frappe backend URL',
            issues: environmentState.issues,
          });
        }
        return;
      }

      const validationResult = await validateBackendConnection();

      if (!isMounted) {
        return;
      }

      setBackendState({
        status: validationResult.isValid ? 'valid' : 'invalid',
        message: validationResult.message,
        issues: validationResult.issues,
      });
    }

    runStartupValidation();

    return () => {
      isMounted = false;
    };
  }, [environmentState.isValid, environmentState.issues]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#eef4fb" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.appShell}>
            {showDemoFallbackBanner ? (
              <View style={styles.demoBanner}>
                <Text style={styles.demoText}>Demo Mode (Offline)</Text>
              </View>
            ) : null}

            {appController.isOfflineMode && !showDemoFallbackBanner ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>Offline Mode</Text>
              </View>
            ) : null}

            <AppErrorBoundary>
              {!environmentState.isValid && !appConfig.fallback.useOnFailure ? (
                <StartupStatusScreen
                  title="Configuration Required"
                  message={environmentState.message}
                  details={environmentState.issues}
                />
              ) : backendState.status === 'checking' ? (
                <StartupStatusScreen
                  title="Validating Backend"
                  message="Checking the configured Frappe API connection."
                  isLoading
                />
              ) : backendState.status === 'invalid' && !appConfig.fallback.useOnFailure ? (
                <StartupStatusScreen
                  title="Invalid Backend"
                  message={backendState.message || 'Invalid Frappe backend URL'}
                  details={backendState.issues}
                />
              ) : appController.isBootstrapping && !appController.student ? (
                <StartupStatusScreen
                  title="Starting TAP Buddy"
                  message="Loading student session and learning content."
                  isLoading
                />
              ) : (
                <AppNavigator {...appController} />
              )}
            </AppErrorBoundary>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#eef4fb',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#eef4fb',
  },
  offlineBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff1c2',
    borderBottomWidth: 1,
    borderBottomColor: '#ead58a',
  },
  offlineText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#7a5b00',
  },
  demoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#d8f0ff',
    borderBottomWidth: 1,
    borderBottomColor: '#9bc7ea',
  },
  demoText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#0f4c81',
  },
});

export default App;
