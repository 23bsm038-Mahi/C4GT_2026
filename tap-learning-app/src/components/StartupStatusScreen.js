import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function StartupStatusScreen({
  title,
  message,
  details = [],
  actionLabel,
  onAction,
  isLoading = false,
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {details.map((item) => (
          <Text key={item} style={styles.detailItem}>
            - {item}
          </Text>
        ))}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#1f6fb2" />
            <Text style={styles.loadingText}>Preparing the learning app...</Text>
          </View>
        ) : null}

        {actionLabel && onAction ? (
          <Pressable style={styles.button} onPress={onAction}>
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#eef4fb',
  },
  card: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  title: {
    marginBottom: 10,
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  message: {
    marginBottom: 14,
    color: '#5f6b7a',
    lineHeight: 22,
  },
  detailItem: {
    marginBottom: 8,
    color: '#9a3412',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#1f6fb2',
    fontWeight: '600',
  },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1f6fb2',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default memo(StartupStatusScreen);
