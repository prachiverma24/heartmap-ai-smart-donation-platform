import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NGODetailPage from './pages/NGODetailPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

const mockUserContext = {
  user: { id: 'u1', name: 'Test Donor', role: 'user' }
};

jest.mock('./context/AuthContext', () => ({
  useAuth: () => mockUserContext
}));

const mockNgoProfile = {
  _id: '6aaff55bdf4f91823d9e8e52',
  name: 'Indian Red Cross Society, District Branch Mandi',
  organizationName: 'Indian Red Cross Society, District Branch Mandi',
  city: 'Mandi',
  state: 'Himachal Pradesh',
  category: 'Disaster Relief',
  description: 'Statutory humanitarian body providing emergency relief and medical assistance in Mandi.',
  acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
  urgentlyNeededItems: [],
  pickupAvailable: false,
  verificationStatus: 'verified',
  verificationInformation: 'Verified via District Administration Mandi Portal',
  website: 'https://mandi.hp.gov.in',
  phone: '01905-225220',
  isPublished: true
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/ngos/6aaff55bdf4f91823d9e8e52']}>
      <Routes>
        <Route path="/ngos/:id" element={<NGODetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('Feature 5: AI-Powered NGO Summarization UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserContext.user = { id: 'u1', name: 'Test Donor', role: 'user' };
    api.get.mockResolvedValue({ data: { profile: mockNgoProfile } });
  });

  test('1. renders "✨ Summarize with AI" button under the About section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const summarizeBtn = screen.getByRole('button', { name: /Summarize with AI/i });
    expect(summarizeBtn).toBeInTheDocument();

    // Verify original description is present and visible
    expect(
      screen.getByText('Statutory humanitarian body providing emergency relief and medical assistance in Mandi.')
    ).toBeInTheDocument();
  });

  test('2. clicking "✨ Summarize with AI" calls /api/ai/summarize-ngo and displays summary card', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        summary:
          'Indian Red Cross Society, District Branch Mandi is a verified organization based in Mandi, Himachal Pradesh. Its listed support areas include Disaster Relief, Medical Aid.'
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const summarizeBtn = screen.getByRole('button', { name: /Summarize with AI/i });
    fireEvent.click(summarizeBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/summarize-ngo', {
        ngoId: '6aaff55bdf4f91823d9e8e52'
      });
    });

    // Summary box is displayed
    await waitFor(() => {
      expect(screen.getByText(/✨ AI Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/AI-Generated/i)).toBeInTheDocument();
      expect(screen.getByTestId('ngo-ai-summary-text')).toHaveTextContent(
        'Indian Red Cross Society, District Branch Mandi is a verified organization based in Mandi, Himachal Pradesh.'
      );
      expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
    });

    // Verify original description remains completely untouched
    expect(
      screen.getByText('Statutory humanitarian body providing emergency relief and medical assistance in Mandi.')
    ).toBeInTheDocument();
  });

  test('3. clicking "🔄 Regenerate" re-invokes the summarization API endpoint', async () => {
    api.post
      .mockResolvedValueOnce({
        data: {
          success: true,
          summary: 'First AI summary.'
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          summary: 'Second refreshed AI summary.'
        }
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const summarizeBtn = screen.getByRole('button', { name: /Summarize with AI/i });
    fireEvent.click(summarizeBtn);

    await screen.findByText('First AI summary.');

    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    await screen.findByText('Second refreshed AI summary.');
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  test('4. displays safe error message when API call fails and leaves profile intact', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'AI NGO summarization service temporarily unavailable. Please try again later.'
        }
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const summarizeBtn = screen.getByRole('button', { name: /Summarize with AI/i });
    fireEvent.click(summarizeBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /AI NGO summarization service temporarily unavailable/i
      );
    });

    // Summary card is not shown
    expect(screen.queryByTestId('ngo-ai-summary-card')).not.toBeInTheDocument();

    // Original profile remains intact
    expect(
      screen.getByText('Statutory humanitarian body providing emergency relief and medical assistance in Mandi.')
    ).toBeInTheDocument();
  });
});

