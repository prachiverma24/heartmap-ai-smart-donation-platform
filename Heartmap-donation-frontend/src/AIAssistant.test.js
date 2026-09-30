import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AIAssistantPage from './pages/AIAssistantPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/ai-assistant']}>
      <Routes>
        <Route path="/ai-assistant" element={<AIAssistantPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('Feature 7: AI Assistant UI (AIAssistantPage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. renders AI Assistant page with title, subtitle, welcome card, and quick action chips', () => {
    renderPage();

    expect(screen.getByText(/🤖 HeartMap AI Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Tell me what you want to donate, what help you need/i)).toBeInTheDocument();
    expect(screen.getByTestId('assistant-welcome-card')).toBeInTheDocument();
    expect(screen.getByText('🎁 I want to donate')).toBeInTheDocument();
    expect(screen.getByText('🆘 I need help')).toBeInTheDocument();
    expect(screen.getByText('🔎 Find an NGO')).toBeInTheDocument();
    expect(screen.getByText('✅ Understand verification')).toBeInTheDocument();
  });

  test('2. sending a donation query calls /api/ai/assistant and displays assistant response with NGO cards', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        response: 'Found 1 verified organization in Mandi matching your donation for winter clothes.',
        intent: 'donate',
        entities: {
          item: 'winter clothes',
          category: 'Clothes',
          location: 'Mandi',
          quantity: null
        },
        missingInformation: [],
        nextAction: 'find_ngo',
        results: [
          {
            id: 'ngo-mandi-1',
            name: 'Indian Red Cross Society, District Branch Mandi',
            city: 'Mandi',
            state: 'Himachal Pradesh',
            category: 'Disaster Relief',
            acceptedDonationTypes: ['Clothes', 'Medical Aid'],
            verificationStatus: 'verified',
            officialWebsite: 'https://mandi.hp.gov.in'
          }
        ]
      }
    });

    renderPage();

    const input = screen.getByPlaceholderText(/Type your question or request/i);
    const sendBtn = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: 'I have winter clothes to donate in Mandi' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/assistant', {
        message: 'I have winter clothes to donate in Mandi'
      });
    });

    expect(await screen.findByTestId('assistant-response-bubble')).toBeInTheDocument();
    expect(screen.getByText(/Found 1 verified organization in Mandi/i)).toBeInTheDocument();
    expect(screen.getByText(/Intent: DONATE/i)).toBeInTheDocument();
    expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    expect(screen.getByText('✓ Verified')).toBeInTheDocument();
    expect(screen.getByText('View NGO Profile')).toBeInTheDocument();
  });

  test('3. help_request intent renders actionable card directing to /help-requests', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        response: 'You can create a community help request on HeartMap to connect with local donors.',
        intent: 'help_request',
        entities: {
          item: 'clothes',
          category: 'Clothes',
          location: 'Mandi',
          quantity: null
        },
        missingInformation: [],
        nextAction: 'create_help_request',
        results: []
      }
    });

    renderPage();

    const helpQuickBtn = screen.getByText('🆘 I need help');
    fireEvent.click(helpQuickBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/assistant', {
        message: 'I need clothes for a family in Mandi'
      });
    });

    expect(await screen.findByTestId('action-help-request-card')).toBeInTheDocument();
    expect(screen.getByText('Submit a Community Help Request')).toBeInTheDocument();
    expect(screen.getByText('Create a Help Request →')).toBeInTheDocument();
  });

  test('4. displays error message cleanly when API fails without breaking layout', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'AI Assistant service temporarily unavailable. Please try again later.'
        }
      }
    });

    renderPage();

    const input = screen.getByPlaceholderText(/Type your question or request/i);
    const sendBtn = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: 'Where can I donate in Mandi?' } });
    fireEvent.click(sendBtn);

    expect(
      await screen.findByText(/AI Assistant service temporarily unavailable/i)
    ).toBeInTheDocument();
  });
});

