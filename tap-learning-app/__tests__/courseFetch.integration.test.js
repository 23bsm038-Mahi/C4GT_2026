import React from 'react';
import { Text, View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import useAppController from '../src/hooks/useAppController';

jest.mock('../src/services/lmsRepository', () => ({
  getCourseCatalog: jest.fn(),
  isStudentSessionExpired: jest.fn(() => false),
  loginStudent: jest.fn(),
  restoreStudentSession: jest.fn(async (student) => student),
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
  getCachedStudent: jest.fn(async () => ({
    id: 'student-1',
    name: 'Asha',
    mobile: '9999999999',
    authToken: 'token-1',
  })),
  getQueuedSubmissions: jest.fn(async () => []),
  isOnline: jest.fn(async () => true),
  subscribeToNetworkStatus: jest.fn(() => jest.fn()),
}));

const { getCourseCatalog } = require('../src/services/lmsRepository');

function ControllerHarness() {
  const controller = useAppController();

  return (
    <View>
      <Text testID="student-name">{controller.student?.name || 'guest'}</Text>
      <Text testID="course-count">{String(controller.courses.length)}</Text>
      <Text testID="boot-state">{String(controller.isBootstrapping)}</Text>
    </View>
  );
}

describe('course fetch integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getCourseCatalog.mockResolvedValue({
      courses: [
        {
          id: 101,
          title: 'Citizen Services 101',
          lessons: [{ id: 1, title: 'Intro', duration: '10 min' }],
          progress: 55,
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

  it('restores the student session and fetches courses on startup', async () => {
    const { getByTestId } = render(<ControllerHarness />);

    await waitFor(() => {
      expect(getByTestId('student-name').props.children).toBe('Asha');
    });

    expect(getByTestId('course-count').props.children).toBe('1');
    expect(getByTestId('boot-state').props.children).toBe('false');
    expect(getCourseCatalog).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ id: 'student-1' }),
      { preferCache: true }
    );
  });
});
