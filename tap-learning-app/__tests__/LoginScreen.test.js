import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LoginScreen from '../src/screens/LoginScreen';

describe('LoginScreen', () => {
  it('shows validation errors and submits valid values', async () => {
    const onLogin = jest.fn(async () => undefined);
    const { getByText, getByLabelText } = render(
      <LoginScreen onLogin={onLogin} isLoading={false} loginError="" />
    );

    fireEvent.press(getByText('Login to Dashboard'));
    expect(getByText('Please enter your name and mobile number.')).toBeTruthy();

    fireEvent.changeText(getByLabelText('Student name'), 'Administrator');
    fireEvent.changeText(getByLabelText('Mobile number'), 'admin');
    fireEvent.press(getByText('Login to Dashboard'));
    await Promise.resolve();

    expect(onLogin).toHaveBeenCalledWith({
      name: 'Administrator',
      mobile: 'admin',
    });
  });
});
