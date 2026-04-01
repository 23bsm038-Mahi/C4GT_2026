import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FeedbackForm from '../src/components/FeedbackForm';

jest.mock('../src/services/lmsRepository', () => ({
  fetchCourseFeedback: jest.fn(),
  submitCourseFeedback: jest.fn(),
}));

const { fetchCourseFeedback } = require('../src/services/lmsRepository');
const { submitCourseFeedback } = require('../src/services/lmsRepository');

describe('feedback submission integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCourseFeedback.mockResolvedValue([]);
    submitCourseFeedback.mockResolvedValue({
      success: true,
      message: 'Feedback submitted successfully.',
    });
  });

  it('submits feedback and shows the success message', async () => {
    const { getByLabelText, getByTestId, getByText } = render(
      <FeedbackForm
        courseId={101}
        defaultName="Asha"
        studentSession={{ id: 'student-1', authToken: 'token-1' }}
      />
    );

    fireEvent.changeText(
      getByTestId('feedback-message-input'),
      'This lesson was clear and helpful.'
    );
    fireEvent.press(getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(getByText('Feedback submitted successfully.')).toBeTruthy();
    });

    expect(submitCourseFeedback).toHaveBeenCalledWith(
      {
        courseId: 101,
        studentName: 'Asha',
        feedback: 'This lesson was clear and helpful.',
      },
      { id: 'student-1', authToken: 'token-1' }
    );
    expect(getByLabelText('Feedback name').props.value).toBe('Asha');
  });

  it('loads and displays existing feedback responses', async () => {
    fetchCourseFeedback.mockResolvedValue([
      {
        id: 'FDBK-0001',
        studentName: 'Rani',
        courseId: 101,
        feedback: 'Please add more examples.',
        createdAt: '2026-04-01T10:00:00.000Z',
      },
    ]);

    const { getByText } = render(
      <FeedbackForm
        courseId={101}
        defaultName="Asha"
        studentSession={{ id: 'student-1', authToken: 'token-1' }}
      />
    );

    await waitFor(() => {
      expect(getByText('Recent Feedback')).toBeTruthy();
      expect(getByText('Rani')).toBeTruthy();
      expect(getByText('Please add more examples.')).toBeTruthy();
    });
  });
});
