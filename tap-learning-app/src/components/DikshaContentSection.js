import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import StatusCard from './StatusCard';
import { fetchDikshaContent } from '../services/dikshaService';

function DikshaContentSection() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('live');

  const handleOpenResource = useCallback(async (artifactUrl) => {
    try {
      const canOpen = await Linking.canOpenURL(artifactUrl);

      if (!canOpen) {
        setError('Unable to open this DIKSHA resource right now.');
        return;
      }

      await Linking.openURL(artifactUrl);
    } catch (openError) {
      setError('Unable to open this DIKSHA resource right now.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDikshaContent() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchDikshaContent();

        if (!isMounted) {
          return;
        }

        setItems(response.items);
        setDataSource(response.source);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.message || 'Unable to load DIKSHA content right now.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDikshaContent();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>DIKSHA Content</Text>
          <Text style={styles.subheading}>
            Suggested national learning resources shown separately from the TAP LMS.
            {dataSource === 'cache' ? ' Showing cached DIKSHA content.' : ''}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color="#1f6fb2" />
          <Text style={styles.loaderText}>Loading DIKSHA resources...</Text>
        </View>
      ) : null}

      {!isLoading && error ? (
        <StatusCard
          title="DIKSHA content is not available"
          message={error}
          tone="error"
        />
      ) : null}

      {!isLoading && !error ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.type}>{item.contentType}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>

              <Text style={styles.meta}>{item.subject} | {item.gradeLevel}</Text>
              <Text style={styles.meta}>Board: {item.board}</Text>
              <Text style={styles.meta}>Medium: {item.medium}</Text>

              <Pressable style={styles.button} onPress={() => handleOpenResource(item.artifactUrl)}>
                <Text style={styles.buttonText}>Open Resource</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  header: {
    marginBottom: 14,
  },
  heading: {
    marginBottom: 4,
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  subheading: {
    color: '#5f6b7a',
    lineHeight: 21,
  },
  loaderCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  loaderText: {
    marginTop: 10,
    color: '#5f6b7a',
  },
  list: {
    paddingRight: 12,
  },
  card: {
    width: 280,
    marginRight: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  type: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#fff4e5',
    color: '#9a5b00',
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  description: {
    marginBottom: 12,
    color: '#5f6b7a',
    lineHeight: 20,
  },
  meta: {
    marginBottom: 6,
    color: '#4a5565',
    fontSize: 13,
  },
  button: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e7edf5',
  },
  buttonText: {
    fontWeight: '700',
    color: '#1f2937',
  },
});

export default memo(DikshaContentSection);
