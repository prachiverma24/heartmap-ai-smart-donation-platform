import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HelpRequestsPage from './pages/HelpRequestsPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

jest.mock('./components/FileUploadField', () => () => <div data-testid="file-upload">FileUpload</div>);

const mockUserContext = {
  user: { id: 'u1', name: 'John Doe', role: 'user' }
};

jest.mock('./context/AuthContext', () => ({
  useAuth: () => mockUserContext
}));

describe('Feature 4: AI Content Generation for Help Requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserContext.user = { id: 'u1', name: 'John Doe', role: 'user' };
    window.scrollTo = jest.fn();
    window.confirm = jest.fn(() => true);
    api.get.mockResolvedValue({ data: { requests: [] } });
  });

  test('1. renders "✨ Improve with AI" button, disabled when description is empty or < 3 chars', async () => {
    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    expect(improveBtn).toBeInTheDocument();
    expect(improveBtn).toBeDisabled();

    // Type 2 characters
    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'ab' } });

    expect(improveBtn).toBeDisabled();
  });

  test('2. enables "✨ Improve with AI" button when description has at least 3 characters', async () => {
    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);

    fireEvent.change(textarea, { target: { name: 'description', value: 'I need winter clothes and blankets for a family in Mandi' } });

    expect(improveBtn).not.toBeDisabled();
  });

  test('3. clicking "✨ Improve with AI" calls /api/ai/generate-content and displays preview box with suggestion', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        contentType: 'help_request',
        generatedText: 'I am seeking winter clothes and blankets to support a family in Mandi.'
      }
    });

    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'I need winter clothes and blankets for a family in Mandi' } });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    fireEvent.click(improveBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/generate-content', {
        contentType: 'help_request',
        text: 'I need winter clothes and blankets for a family in Mandi'
      });
    });

    // Preview box appears
    await waitFor(() => {
      expect(screen.getByText(/✨ AI-Generated Suggestion/i)).toBeInTheDocument();
      expect(screen.getByText(/Review before using/i)).toBeInTheDocument();
      expect(screen.getByTestId('ai-suggestion-text')).toHaveTextContent(
        'I am seeking winter clothes and blankets to support a family in Mandi.'
      );
      expect(screen.getByRole('button', { name: /Use This Suggestion/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
    });

    // Original textarea is untouched until user explicitly accepts
    expect(textarea.value).toBe('I need winter clothes and blankets for a family in Mandi');
  });

  test('4. clicking "✓ Use This Suggestion" replaces description and allows further editing without auto-submitting', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        contentType: 'help_request',
        generatedText: 'I am seeking winter clothes and blankets to support a family in Mandi.'
      }
    });

    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'rough note' } });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    fireEvent.click(improveBtn);

    const useBtn = await screen.findByRole('button', { name: /Use This Suggestion/i });
    fireEvent.click(useBtn);

    // Verify textarea has the improved text
    expect(textarea.value).toBe('I am seeking winter clothes and blankets to support a family in Mandi.');

    // Verify preview box is closed
    expect(screen.queryByTestId('ai-suggestion-text')).not.toBeInTheDocument();

    // Verify user can continue manually editing the description
    fireEvent.change(textarea, {
      target: { name: 'description', value: 'I am seeking winter clothes and blankets to support a family in Mandi. Warm socks also needed.' }
    });
    expect(textarea.value).toBe(
      'I am seeking winter clothes and blankets to support a family in Mandi. Warm socks also needed.'
    );

    // Verify form was NOT submitted automatically
    // The only POST was to /ai/generate-content, NOT to /help-requests
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalledWith('/help-requests', expect.anything());
  });

  test('5. clicking "✕ Dismiss" clears suggestion without modifying description', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        contentType: 'help_request',
        generatedText: 'Suggested text from AI.'
      }
    });

    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'My original notes' } });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    fireEvent.click(improveBtn);

    const dismissBtn = await screen.findByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);

    // Suggestion box is dismissed
    expect(screen.queryByTestId('ai-suggestion-text')).not.toBeInTheDocument();
    // Textarea keeps user's original notes
    expect(textarea.value).toBe('My original notes');
  });

  test('6. displays error message when API call fails and allows user to continue manually', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: { error: 'AI content generation service temporarily unavailable. Please try again later.' }
      }
    });

    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'Need help urgently' } });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    fireEvent.click(improveBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /AI content generation service temporarily unavailable/i
      );
    });

    // Suggestion box does not appear
    expect(screen.queryByTestId('ai-suggestion-text')).not.toBeInTheDocument();
    // User can still edit manually
    fireEvent.change(textarea, { target: { name: 'description', value: 'Need help urgently with winter items' } });
    expect(textarea.value).toBe('Need help urgently with winter items');
  });

  test('7. clicking "🔄 Regenerate" calls AI generation API again', async () => {
    api.post
      .mockResolvedValueOnce({
        data: {
          success: true,
          contentType: 'help_request',
          generatedText: 'First suggestion.'
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          contentType: 'help_request',
          generatedText: 'Second suggestion after regenerate.'
        }
      });

    render(<HelpRequestsPage />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/help-requests?mine=true');
    });

    const textarea = screen.getByPlaceholderText(/Add details about who needs this and the circumstances/i);
    fireEvent.change(textarea, { target: { name: 'description', value: 'Need blankets' } });

    const improveBtn = screen.getByRole('button', { name: /Improve with AI/i });
    fireEvent.click(improveBtn);

    await screen.findByText('First suggestion.');

    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    await screen.findByText('Second suggestion after regenerate.');
    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
