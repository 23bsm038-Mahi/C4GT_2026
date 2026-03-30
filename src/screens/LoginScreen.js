import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function LoginScreen({ onLogin, isLoading, loginError }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  const handleStart = async () => {
    const cleanName = name.trim();
    const cleanMobile = mobile.trim();

    if (!cleanName || !cleanMobile) {
      setError('Please enter your name and mobile number.');
      return;
    }

    if (!/^\d{10}$/.test(cleanMobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError('');
    await onLogin({
      name: cleanName,
      mobile: cleanMobile,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.infoColumn}>
            <Text style={styles.badge}>GovTech Learning App</Text>
            <Text style={styles.title}>Student Login</Text>
            <Text style={styles.subtitle}>Enter your details to continue learning.</Text>

            <View style={styles.pointCard}>
              <Text style={styles.pointTitle}>Learn with guided lessons</Text>
              <Text style={styles.pointText}>
                Browse courses, track progress, and get help from the AI tutor.
              </Text>
            </View>

            <View style={styles.pointCard}>
              <Text style={styles.pointTitle}>Practice real-world skills</Text>
              <Text style={styles.pointText}>
                Explore public service topics in a simple mobile-first learning flow.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Student Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={setMobile}
              placeholder="Enter your mobile number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

            <Pressable
              style={[styles.button, isLoading ? styles.buttonDisabled : null]}
              onPress={handleStart}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Login to Dashboard</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
    padding: 20,
  },
  infoColumn: {
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e8f1ff',
    color: '#0f4c81',
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    marginBottom: 8,
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
  },
  subtitle: {
    marginBottom: 22,
    color: '#5f6b7a',
    lineHeight: 22,
  },
  pointCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#d7e7f7',
  },
  pointTitle: {
    marginBottom: 6,
    fontWeight: '700',
    color: '#1f2937',
  },
  pointText: {
    color: '#5f6b7a',
    lineHeight: 20,
  },
  formCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#d7e7f7',
  },
  label: {
    marginBottom: 8,
    fontWeight: '700',
    color: '#1f2937',
  },
  input: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2e1',
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  errorText: {
    marginBottom: 10,
    color: '#b42318',
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1f6fb2',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default LoginScreen;
