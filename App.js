import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import useAppController from './src/hooks/useAppController';

function App() {
  const appController = useAppController();

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#eef4fb" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.appShell}>
            {appController.isOfflineMode ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>Offline Mode</Text>
              </View>
            ) : null}

            <AppErrorBoundary>
              <AppNavigator {...appController} />
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
});

export default App;
