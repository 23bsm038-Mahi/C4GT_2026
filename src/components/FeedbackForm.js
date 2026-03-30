import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { submitCourseFeedback } from '../services/frappeApi';

function FeedbackForm({ courseId, defaultName }) {
  const [feedbackName, setFeedbackName] = useState(defaultName || '');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFeedbackName(defaultName || '');
  }, [defaultName]);

  const handleSubmit = async () => {
    const cleanName = feedbackName.trim();
    const cleanFeedback = feedback.trim();

    if (!cleanName || !cleanFeedback) {
      setStatus('error');
      setMessage('Please enter your name and feedback before submitting.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await submitCourseFeedback({
        courseId,
        studentName: cleanName,
        feedback: cleanFeedback,
      });

      setStatus('success');
      setMessage(response.message);
      setFeedback('');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Unable to send feedback right now.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Submit Feedback</Text>

      <TextInput
        style={styles.input}
        value={feedbackName}
        onChangeText={setFeedbackName}
        placeholder="Enter your name"
        placeholderTextColor="#94a3b8"
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Share what you learned or ask for help"
        placeholderTextColor="#94a3b8"
        multiline={true}
      />

      <Pressable
        style={[styles.button, status === 'loading' ? styles.buttonDisabled : null]}
        onPress={handleSubmit}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Submit Feedback</Text>
        )}
      </Pressable>

      {message ? (
        <Text style={status === 'error' ? styles.errorText : styles.successText}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    marginBottom: 12,
    fontSize: 13,
    color: '#5f6b7a',
    fontWeight: '700',
  },
  input: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#c7d2e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#1f6fb2',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    color: '#b42318',
  },
  successText: {
    marginTop: 10,
    color: '#25603d',
  },
});

export default FeedbackForm;
