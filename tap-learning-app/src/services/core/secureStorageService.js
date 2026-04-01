import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

async function isSecureStoreReady() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch (error) {
    return false;
  }
}

export async function readSecureJson(key, fallbackValue) {
  try {
    const canUseSecureStore = await isSecureStoreReady();
    const rawValue = canUseSecureStore
      ? await SecureStore.getItemAsync(key)
      : await AsyncStorage.getItem(`secure-fallback:${key}`);

    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

export async function writeSecureJson(key, value) {
  try {
    const serializedValue = JSON.stringify(value);
    const canUseSecureStore = await isSecureStoreReady();

    if (canUseSecureStore) {
      await SecureStore.setItemAsync(key, serializedValue);
      return;
    }

    await AsyncStorage.setItem(`secure-fallback:${key}`, serializedValue);
  } catch (error) {
    // SecureStore is flaky on some targets. Fall through quietly.
  }
}

export async function removeSecureItem(key) {
  try {
    const canUseSecureStore = await isSecureStoreReady();

    if (canUseSecureStore) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await AsyncStorage.removeItem(`secure-fallback:${key}`);
  } catch (error) {
    // Cleanup can fail without hurting the rest of the app.
  }
}
