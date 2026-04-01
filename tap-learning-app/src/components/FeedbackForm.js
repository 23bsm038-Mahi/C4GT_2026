import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchCourseFeedback, submitCourseFeedback } from '../services/lmsRepository';
import { captureAppError, getFriendlyErrorMessage } from '../services/core/errorService';

function buildSessionSignature(studentSession) {
  if (!studentSession) {
    return '';
  }

  if (typeof studentSession === 'string') {
    return studentSession;
  }

  return JSON.stringify({
    id: studentSession.id || '',
    authToken: studentSession.authToken || '',
    sessionCookie: studentSession.sessionCookie || '',
    authMode: studentSession.authMode || '',
  });
}

function FeedbackForm({ courseId, defaultName, studentSession = null }) {
  const [feedbackName, setFeedbackName] = useState(defaultName || '');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [listStatus, setListStatus] = useState('idle');
  const [listMessage, setListMessage] = useState('');
  const studentSessionRef = useRef(studentSession);
  const sessionSignature = useMemo(() => buildSessionSignature(studentSession), [studentSession]);

  useEffect(() => {
    setFeedbackName(defaultName || '');
  }, [defaultName]);

  useEffect(() => {
    studentSessionRef.current = studentSession;
  }, [sessionSignature, studentSession]);

  const loadFeedback = useCallback(async () => {
    setListStatus('loading');
    setListMessage('');

    try {
      const entries = await fetchCourseFeedback(courseId, studentSessionRef.current);
      setFeedbackEntries(entries);
      setListStatus('success');
    } catch (error) {
      captureAppError(error, { label: 'Feedback list' });
      setListStatus('error');
      setListMessage(getFriendlyErrorMessage(error, 'feedback'));
    }
  }, [courseId, sessionSignature]);

  useEffect(() => {
    loadFeedback();
  }, [courseId, loadFeedback, sessionSignature]);

  const handleSubmit = useCallback(async () => {
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
      }, studentSessionRef.current);

      setStatus('success');
      setMessage(response.message);
      setFeedback('');
      await loadFeedback();
    } catch (error) {
      captureAppError(error, { label: 'Feedback submit' });
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'feedback'));
    }
  }, [courseId, feedback, feedbackName, loadFeedback, sessionSignature]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Submit Feedback</Text>

      <TextInput
        style={styles.input}
        value={feedbackName}
        onChangeText={setFeedbackName}
        placeholder="Enter your name"
        placeholderTextColor="#94a3b8"
        accessibilityLabel="Feedback name"
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Share what you learned or ask for help"
        placeholderTextColor="#94a3b8"
        multiline={true}
        accessibilityLabel="Feedback message"
        testID="feedback-message-input"
      />

      <Pressable
        style={[styles.button, status === 'loading' ? styles.buttonDisabled : null]}
        onPress={handleSubmit}
        disabled={status === 'loading'}
        accessibilityRole="button"
        accessibilityLabel="Submit feedback"
        testID="feedback-submit-button"
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

      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Recent Feedback</Text>
          <Pressable onPress={loadFeedback} accessibilityRole="button" accessibilityLabel="Refresh feedback list">
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {listStatus === 'loading' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#1f6fb2" />
            <Text style={styles.loadingText}>Loading feedback...</Text>
          </View>
        ) : null}

        {listStatus === 'error' && listMessage ? (
          <Text style={styles.errorText}>{listMessage}</Text>
        ) : null}

        {listStatus !== 'loading' && !feedbackEntries.length ? (
          <Text style={styles.emptyText}>No feedback responses yet for this course.</Text>
        ) : null}

        {feedbackEntries.map((entry) => (
          <View key={entry.id || `${entry.studentName}-${entry.createdAt}`} style={styles.feedbackItem}>
            <View style={styles.feedbackMetaRow}>
              <Text style={styles.feedbackName}>{entry.studentName || 'Anonymous learner'}</Text>
              {entry.createdAt ? <Text style={styles.feedbackTime}>{entry.createdAt}</Text> : null}
            </View>
            <Text style={styles.feedbackBody}>{entry.feedback}</Text>
          </View>
        ))}
      </View>
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
  listSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  refreshText: {
    color: '#1f6fb2',
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#5f6b7a',
  },
  emptyText: {
    color: '#5f6b7a',
    lineHeight: 20,
  },
  feedbackItem: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  feedbackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feedbackName: {
    flex: 1,
    marginRight: 10,
    fontWeight: '700',
    color: '#1f2937',
  },
  feedbackTime: {
    color: '#64748b',
    fontSize: 12,
  },
  feedbackBody: {
    color: '#334155',
    lineHeight: 20,
  },
});

export default memo(FeedbackForm);
