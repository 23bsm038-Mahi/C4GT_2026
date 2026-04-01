import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import useAppController from '../src/hooks/useAppController';

jest.mock('../src/services/lmsRepository', () => ({
  getCourseCatalog: jest.fn(),
  isStudentSessionExpired: jest.fn(() => false),
  loginStudent: jest.fn(),
  restoreStudentSession: jest.fn(),
  sendFeedbackSubmission: jest.fn(),
}));

jest.mock('../src/services/offlineService', () => ({
  cacheStudent: jest.fn(async () => undefined),
  clearCachedStudent: jest.fn(async () => undefined),
  flushQueuedSubmissions: jest.fn(async () => ({
    sentCount: 0,
    failedCount: 0,
    conflictCount: 0,
  })),
  getCourseCacheStatus: jest.fn(async () => ({
    hasData: false,
    isExpired: false,
    savedAt: 0,
  })),
  getCachedCourses: jest.fn(async () => []),
  getCachedStudent: jest.fn(async () => null),
  getQueuedSubmissions: jest.fn(async () => []),
  isOnline: jest.fn(async () => true),
  subscribeToNetworkStatus: jest.fn(() => jest.fn()),
}));

const { getCourseCatalog, loginStudent } = require('../src/services/lmsRepository');

function ControllerHarness() {
  const controller = useAppController();

  return (
    <View>
      <Text testID="student-name">{controller.student?.name || 'guest'}</Text>
      <Text testID="course-count">{String(controller.courses.length)}</Text>
      <Pressable onPress={() => controller.handleLogin({ name: 'Asha', mobile: '9999999999' })}>
        <Text>Run Login</Text>
      </Pressable>
    </View>
  );
}

describe('login flow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    loginStudent.mockResolvedValue({
      id: 'student-1',
      name: 'Asha',
      mobile: '9999999999',
      authToken: 'token-1',
    });

    getCourseCatalog.mockResolvedValue({
      courses: [
        {
          id: 1,
          title: 'Digital Foundations',
          lessons: [],
          progress: 15,
        },
      ],
      source: 'live',
      cacheStatus: {
        isExpired: false,
      },
      student: {
        id: 'student-1',
        name: 'Asha',
        mobile: '9999999999',
        authToken: 'token-1',
      },
    });
  });

  it('logs in and loads courses through the app controller', async () => {
    const { getByText, getByTestId } = render(<ControllerHarness />);

    fireEvent.press(getByText('Run Login'));

    await waitFor(() => {
      expect(getByTestId('student-name').props.children).toBe('Asha');
    });

    expect(getByTestId('course-count').props.children).toBe('1');
    expect(loginStudent).toHaveBeenCalledWith({
      name: 'Asha',
      mobile: '9999999999',
    });
    expect(getCourseCatalog).toHaveBeenCalled();
  });
});
