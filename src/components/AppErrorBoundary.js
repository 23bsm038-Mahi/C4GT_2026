import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Something unexpected happened in the app.',
    };
  }

  componentDidCatch() {
    // Keep the fallback quiet in production. The boundary prevents a hard crash.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      message: '',
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrapper}>
          <View style={styles.card}>
            <Text style={styles.title}>App Error</Text>
            <Text style={styles.message}>
              {this.state.message}
            </Text>
            <Pressable style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#eef4fb',
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  title: {
    marginBottom: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  message: {
    marginBottom: 14,
    color: '#5f6b7a',
    lineHeight: 22,
  },
  button: {
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

export default AppErrorBoundary;
