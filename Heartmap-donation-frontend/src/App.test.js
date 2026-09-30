import { render, screen } from '@testing-library/react';

jest.mock('axios', () => {
  const client = {
    get: jest.fn(() => Promise.reject(new Error('test network disabled'))),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn()
  };
  const axios = { ...client, create: jest.fn(() => client) };
  return { __esModule: true, default: axios };
});

jest.mock('@lottiefiles/react-lottie-player', () => ({
  Player: () => null
}));

jest.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => ({ children, whileHover, whileTap, initial, animate, exit, transition, ...props }) => {
      const Tag = tag === 'button' ? 'button' : 'div';
      return <Tag {...props}>{children}</Tag>;
    }
  }),
  AnimatePresence: ({ children }) => children
}));

import { BrowserRouter } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() })
}));

test('renders the HeartMap sign-in form', () => {
  render(<BrowserRouter><LoginPage /></BrowserRouter>);
  expect(screen.getByText(/Sign in to HeartMap/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
});
