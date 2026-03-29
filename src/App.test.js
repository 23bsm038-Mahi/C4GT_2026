import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

function finishLoginLoading() {
  act(() => {
    jest.runAllTimers();
  });
}

test('login form renders on first screen', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /student login/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/student name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
});

test('clicking login button moves to dashboard', () => {
  jest.useFakeTimers();
  render(<App />);

  fireEvent.change(screen.getByLabelText(/student name/i), {
    target: { value: 'Asha' },
  });
  fireEvent.change(screen.getByLabelText(/mobile number/i), {
    target: { value: '9876543210' },
  });
  fireEvent.click(screen.getByRole('button', { name: /login to dashboard/i }));

  expect(screen.getByText(/loading your learning dashboard/i)).toBeInTheDocument();

  finishLoginLoading();
  expect(screen.getByRole('heading', { name: /welcome, asha/i })).toBeInTheDocument();
  jest.useRealTimers();
});

test('dashboard shows course cards after login', () => {
  jest.useFakeTimers();
  render(<App />);

  fireEvent.change(screen.getByLabelText(/student name/i), {
    target: { value: 'Rahul' },
  });
  fireEvent.change(screen.getByLabelText(/mobile number/i), {
    target: { value: '9123456780' },
  });
  fireEvent.click(screen.getByRole('button', { name: /login to dashboard/i }));

  finishLoginLoading();
  expect(screen.getByText(/digital governance basics/i)).toBeInTheDocument();
  expect(screen.getByText(/public service design/i)).toBeInTheDocument();
  expect(screen.getByText(/data for local administration/i)).toBeInTheDocument();
  jest.useRealTimers();
});

test('shows a validation message for invalid mobile number', () => {
  render(<App />);

  fireEvent.change(screen.getByLabelText(/student name/i), {
    target: { value: 'Riya' },
  });
  fireEvent.change(screen.getByLabelText(/mobile number/i), {
    target: { value: '1234' },
  });
  fireEvent.click(screen.getByRole('button', { name: /login to dashboard/i }));

  expect(screen.getByText(/valid 10-digit mobile number/i)).toBeInTheDocument();
});

test('opens a course and shows its lessons', () => {
  jest.useFakeTimers();
  render(<App />);

  fireEvent.change(screen.getByLabelText(/student name/i), {
    target: { value: 'Rahul' },
  });
  fireEvent.change(screen.getByLabelText(/mobile number/i), {
    target: { value: '9123456780' },
  });
  fireEvent.click(screen.getByRole('button', { name: /login to dashboard/i }));

  finishLoginLoading();
  fireEvent.click(screen.getAllByRole('button', { name: /view course/i })[0]);

  expect(screen.getByRole('heading', { name: /digital governance basics/i })).toBeInTheDocument();
  expect(screen.getByText(/lesson 1: introduction to govtech/i)).toBeInTheDocument();
  expect(screen.getByText(/35% of the course completed/i)).toBeInTheDocument();
  jest.useRealTimers();
});
