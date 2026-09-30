import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBox from './components/ChatBox';
import api from './api';

jest.mock('./api', () => ({
  post: jest.fn()
}));

jest.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => ({ children, whileHover, whileTap, initial, animate, exit, transition, ...props }) => {
      const Tag = tag === 'button' ? 'button' : tag === 'section' ? 'section' : 'div';
      return <Tag {...props}>{children}</Tag>;
    }
  }),
  AnimatePresence: ({ children }) => children
}));

describe('Feature 19.1: HeartMap AI Chatbot UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders floating toggle button with HeartMap AI label', () => {
    render(<ChatBox />);
    expect(screen.getByRole('button', { name: /Open HeartMap AI chat/i })).toBeInTheDocument();
    expect(screen.getByText(/HeartMap AI/i)).toBeInTheDocument();
  });

  test('opens chat panel and displays welcome message and suggestions', () => {
    render(<ChatBox />);
    const toggleBtn = screen.getByRole('button', { name: /Open HeartMap AI chat/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/HeartMap AI/i, { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText(/Hi! I'm HeartMap AI ❤️/i)).toBeInTheDocument();
    expect(screen.getByText(/What is HeartMap\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How are NGOs verified\?/i)).toBeInTheDocument();
  });

  test('send button is disabled when input is empty', () => {
    render(<ChatBox />);
    fireEvent.click(screen.getByRole('button', { name: /Open HeartMap AI chat/i }));

    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    expect(sendBtn).toBeDisabled();
  });

  test('submitting a user message calls /ai/chat and displays response', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        reply: 'NGOs are verified through administrative review of NGO Darpan ID and 80G certificates.'
      }
    });

    render(<ChatBox />);
    fireEvent.click(screen.getByRole('button', { name: /Open HeartMap AI chat/i }));

    const input = screen.getByPlaceholderText(/Ask about NGOs, donating items, help.../i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'How are NGOs verified?' } });
    const updatedSendBtn = screen.getByRole('button', { name: /Send message/i });
    expect(updatedSendBtn).not.toBeDisabled();
    fireEvent.click(updatedSendBtn);

    // User message should appear in chat
    expect(screen.getByText('How are NGOs verified?')).toBeInTheDocument();

    // API should be called with message
    expect(api.post).toHaveBeenCalledWith('/ai/chat', { message: 'How are NGOs verified?' });

    // AI reply should appear
    await waitFor(() => {
      expect(
        screen.getByText(/NGOs are verified through administrative review of NGO Darpan ID/i)
      ).toBeInTheDocument();
    });
  });

  test('displays error message if backend AI service fails', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          error: 'AI service temporarily unavailable. Please try again later.'
        }
      }
    });

    render(<ChatBox />);
    fireEvent.click(screen.getByRole('button', { name: /Open HeartMap AI chat/i }));

    const input = screen.getByPlaceholderText(/Ask about NGOs, donating items, help.../i);
    fireEvent.change(input, { target: { value: 'What is HeartMap?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/AI service temporarily unavailable\. Please try again later\./i)
      ).toBeInTheDocument();
    });
  });

  test('suggestion chip triggers automated query to AI', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        reply: 'HeartMap is a donation discovery and community support platform.'
      }
    });

    render(<ChatBox />);
    fireEvent.click(screen.getByRole('button', { name: /Open HeartMap AI chat/i }));

    const chip = screen.getByRole('button', { name: 'What is HeartMap?' });
    fireEvent.click(chip);

    expect(api.post).toHaveBeenCalledWith('/ai/chat', { message: 'What is HeartMap?' });

    await waitFor(() => {
      expect(
        screen.getByText('HeartMap is a donation discovery and community support platform.')
      ).toBeInTheDocument();
    });
  });
});
