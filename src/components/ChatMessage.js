import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function ChatMessage({ message }) {
  const isStudent = message.sender === 'student';
  const label = isStudent ? 'You' : 'AI Tutor';

  return (
    <View style={[styles.message, isStudent ? styles.studentMessage : styles.aiMessage]}>
      <Text style={[styles.text, isStudent ? styles.studentText : styles.aiText]}>
        <Text style={styles.label}>{label}: </Text>
        {message.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    maxWidth: '88%',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef6ff',
  },
  studentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f3f4f6',
  },
  text: {
    lineHeight: 20,
  },
  label: {
    fontWeight: '700',
  },
  aiText: {
    color: '#1e3a5f',
  },
  studentText: {
    color: '#1f2937',
  },
});

export default ChatMessage;
