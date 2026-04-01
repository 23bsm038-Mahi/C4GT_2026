import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ChatMessage from '../components/ChatMessage';
import FeedbackForm from '../components/FeedbackForm';
import StatusCard from '../components/StatusCard';
import useTutorChat from '../hooks/useTutorChat';
import { isModuleEnabled } from '../services/moduleRegistry';

function CourseScreen({ navigation, route, student, courses }) {
  const courseId = route.params?.courseId;
  const course = useMemo(
    () => courses.find((item) => item.id === courseId),
    [courseId, courses]
  );
  const safeLessons = useMemo(
    () => (Array.isArray(course?.lessons) ? course.lessons : []),
    [course]
  );
  const completedLessons = useMemo(
    () => (course ? Math.round((course.progress / 100) * safeLessons.length) : 0),
    [course, safeLessons.length]
  );

  const [question, setQuestion] = useState('');
  const chatScrollRef = useRef(null);
  const showAiTutor = isModuleEnabled('aiTutor');
  const showFeedbackForm = isModuleEnabled('feedbackForm');
  const {
    messages,
    connectionState,
    chatError,
    isSendingMessage,
    isTutorTyping,
    queuedMessageCount,
    sendMessage,
    notifyTyping,
    retryConnection,
  } = useTutorChat({
    studentName: student.name,
    course,
    enabled: showAiTutor,
  });

  const suggestions = useMemo(
    () => ['Explain this course', 'Show my progress', 'What lesson should I do next?'],
    []
  );

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, isSendingMessage]);

  if (!course) {
    return (
      <View style={styles.missingWrapper}>
        <StatusCard
          title="Course not available"
          message="The selected course could not be found. Please go back to the dashboard."
          actionLabel="Back to Dashboard"
          onAction={() => navigation.goBack()}
          tone="error"
        />
      </View>
    );
  }

  const handleAskTutor = useCallback(() => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      return;
    }

    const didSend = sendMessage(cleanQuestion);

    if (didSend) {
      setQuestion('');
      notifyTyping(false);
    }
  }, [notifyTyping, question, sendMessage]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heading}>{course.title}</Text>
        <Text style={styles.subheading}>
          Student: {student.name} | Course owner: {course.department}
        </Text>

        <Pressable style={styles.secondaryButton} onPress={handleGoBack}>
          <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Course Lessons</Text>
        {safeLessons.length === 0 ? (
          <Text style={styles.listItem}>No lessons are available for this course yet.</Text>
        ) : safeLessons.map((lesson, index) => (
          <View key={lesson.id} style={styles.lessonItem}>
            <Text style={styles.lessonTitle}>Lesson {index + 1}: {lesson.title}</Text>
            <Text style={styles.lessonTime}>{lesson.duration}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{course.progress}% of the course completed</Text>

        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>Learning Status</Text>
          <Text style={styles.noteText}>
            {completedLessons} of {safeLessons.length} lessons covered
          </Text>
          <Text style={styles.noteText}>Recommended next step: finish the next lesson today.</Text>
        </View>

        {showAiTutor ? (
          <View style={styles.noteCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.noteLabel}>AI Tutor Mode</Text>
              <View
                style={[
                  styles.chatStatus,
                  connectionState === 'connected' && !isSendingMessage
                    ? styles.chatStatusOpen
                    : connectionState === 'disconnected'
                      ? styles.chatStatusDisconnected
                      : styles.chatStatusConnecting,
                ]}
              >
                <Text style={styles.chatStatusText}>
                  {connectionState === 'connected'
                    ? (isSendingMessage ? 'thinking' : 'connected')
                    : connectionState}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionRow}
            >
              {suggestions.map((item) => (
                <Pressable
                  key={item}
                  style={styles.suggestionButton}
                  onPress={() => setQuestion(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tutor suggestion ${item}`}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView ref={chatScrollRef} style={styles.chatBox}>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isSendingMessage || isTutorTyping ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color="#1f6fb2" />
                  <Text style={styles.typingText}>AI Tutor is typing...</Text>
                </View>
              ) : null}
            </ScrollView>

            {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}

            <TextInput
              style={styles.input}
              value={question}
              onChangeText={(value) => {
                setQuestion(value);
                notifyTyping(Boolean(value.trim()));
              }}
              placeholder="Ask the AI tutor a question"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Ask the AI tutor"
            />

            {queuedMessageCount > 0 ? (
              <Text style={styles.queueText}>
                {queuedMessageCount} message{queuedMessageCount > 1 ? 's' : ''} waiting to send.
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                isSendingMessage || connectionState === 'connecting' ? styles.buttonDisabled : null,
              ]}
              onPress={handleAskTutor}
              disabled={isSendingMessage || connectionState === 'connecting'}
              accessibilityRole="button"
              accessibilityLabel="Send question to AI tutor"
            >
              <Text style={styles.primaryButtonText}>Ask AI</Text>
            </Pressable>

            {connectionState === 'disconnected' ? (
              <StatusCard
                title="Tutor temporarily unavailable"
                message={chatError || 'The live tutor connection is unavailable right now.'}
                actionLabel="Retry Connection"
                onAction={retryConnection}
                tone="error"
              />
            ) : null}
          </View>
        ) : null}

        {showFeedbackForm ? (
          <FeedbackForm
            courseId={course.id}
            defaultName={student.name}
            studentSession={student}
          />
        ) : null}

        <Text style={styles.sectionTitle}>Quick Notes</Text>
        <Text style={styles.listItem}>- This course is suitable for beginners.</Text>
        <Text style={styles.listItem}>- The content is designed for civic and public service learning.</Text>
        <Text style={styles.listItem}>- Use the dashboard to switch between different courses.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  missingWrapper: {
    flex: 1,
    padding: 20,
  },
  heroCard: {
    marginBottom: 18,
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  heading: {
    marginBottom: 6,
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  subheading: {
    marginBottom: 14,
    color: '#5f6b7a',
    lineHeight: 21,
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
  sectionCard: {
    marginBottom: 18,
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  sectionTitle: {
    marginBottom: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  lessonItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf3',
  },
  lessonTitle: {
    marginBottom: 4,
    fontWeight: '700',
    color: '#1f2937',
  },
  lessonTime: {
    color: '#5f6b7a',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e7edf5',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1f6fb2',
  },
  progressText: {
    marginTop: 8,
    marginBottom: 18,
    color: '#4a5565',
  },
  noteCard: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#5f6b7a',
  },
  noteText: {
    marginTop: 4,
    color: '#334155',
    lineHeight: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chatStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chatStatusConnecting: {
    backgroundColor: '#fff3cd',
  },
  chatStatusOpen: {
    backgroundColor: '#e9f7ef',
  },
  chatStatusDisconnected: {
    backgroundColor: '#eef2f7',
  },
  chatStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#526172',
  },
  suggestionRow: {
    paddingBottom: 10,
  },
  suggestionButton: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#cfe0f4',
  },
  suggestionText: {
    color: '#1f4f82',
    fontSize: 13,
  },
  chatBox: {
    maxHeight: 240,
    marginBottom: 12,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  typingText: {
    marginLeft: 8,
    color: '#5f6b7a',
  },
  chatError: {
    marginBottom: 10,
    color: '#b42318',
    lineHeight: 20,
  },
  queueText: {
    marginBottom: 10,
    color: '#5f6b7a',
    lineHeight: 20,
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
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#1f6fb2',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listItem: {
    marginBottom: 8,
    color: '#4a5565',
    lineHeight: 21,
  },
});

export default memo(CourseScreen);
