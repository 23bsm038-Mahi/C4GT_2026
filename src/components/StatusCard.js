import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function StatusCard({ title, message, actionLabel, onAction, tone = 'default' }) {
  return (
    <View style={[styles.card, tone === 'error' ? styles.errorCard : null]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
    borderRadius: 16,
  },
  errorCard: {
    backgroundColor: '#fff8f8',
    borderColor: '#f0c6c6',
  },
  title: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  message: {
    marginBottom: 14,
    color: '#5f6b7a',
    lineHeight: 21,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e7edf5',
  },
  buttonText: {
    fontWeight: '700',
    color: '#1f2937',
  },
});

export default StatusCard;
