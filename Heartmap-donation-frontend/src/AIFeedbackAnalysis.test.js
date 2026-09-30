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

describe('Feature 6: AI-Powered Feedback Analysis UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserContext.user = { id: 'u1', name: 'Test Donor', role: 'user' };
    api.get.mockImplementation((url) => {
      if (url.includes('/ngo/')) {
        return Promise.resolve({ data: { profile: mockNgoProfile } });
      }
      if (url.includes('/feedback/ngo/')) {
        return Promise.resolve({ data: { success: true, feedback: [] } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  test('1. renders Community Feedback section and "✨ Analyze with AI" button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    expect(screen.getByText(/Community Feedback & Reviews/i)).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /Analyze with AI/i });
    expect(analyzeBtn).toBeInTheDocument();
    // Button is disabled when textarea is empty
    expect(analyzeBtn).toBeDisabled();

    // Verify original NGO description is present
    expect(
      screen.getByText('Statutory humanitarian body providing emergency relief and medical assistance in Mandi.')
    ).toBeInTheDocument();
  });

  test('2. typing feedback and clicking "✨ Analyze with AI" calls /api/ai/analyze-feedback and displays analysis card', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        analysis: {
          sentiment: 'mixed',
          positivePoints: ['Staff was helpful and polite.'],
          concerns: ['Donation drop-off process was confusing.'],
          suggestions: ['Provide clearer drop-off instructions.']
        }
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe your experience donating/i);
    fireEvent.change(textarea, {
      target: { value: 'The staff was helpful and polite, but the drop-off process was confusing.' }
    });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze with AI/i });
    expect(analyzeBtn).not.toBeDisabled();
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/analyze-feedback', {
        feedback: 'The staff was helpful and polite, but the drop-off process was confusing.'
      });
    });

    // AI Feedback card is rendered
    await waitFor(() => {
      const card = screen.getByTestId('ngo-ai-feedback-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('MIXED');
      expect(card).toHaveTextContent('Staff was helpful and polite.');
      expect(card).toHaveTextContent('Donation drop-off process was confusing.');
      expect(card).toHaveTextContent('Provide clearer drop-off instructions.');
      expect(card).toHaveTextContent('AI-Generated Analysis');
    });

    // Disclaimer is visible
    expect(
      screen.getByText(/Based only on the submitted feedback. Informational only; does not determine NGO legitimacy or trustworthiness./i)
    ).toBeInTheDocument();
  });

  test('3. displays error banner when AI feedback analysis API fails', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'AI feedback analysis service temporarily unavailable. Please try again later.'
        }
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe your experience donating/i);
    fireEvent.change(textarea, { target: { value: 'The donation process was very smooth.' } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze with AI/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /AI feedback analysis service temporarily unavailable/i
      );
    });

    // Analysis card is not displayed
    expect(screen.queryByTestId('ngo-ai-feedback-card')).not.toBeInTheDocument();
  });

  test('4. submitting feedback calls /feedback/ngo/:id and adds feedback to list', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        feedback: {
          _id: 'fb-123',
          user: { name: 'Test Donor' },
          feedback: 'Great organization doing authentic relief work in Mandi.',
          createdAt: new Date().toISOString()
        }
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe your experience donating/i);
    fireEvent.change(textarea, {
      target: { value: 'Great organization doing authentic relief work in Mandi.' }
    });

    const submitBtn = screen.getByRole('button', { name: /Post Feedback/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/feedback/ngo/6aaff55bdf4f91823d9e8e52', {
        feedback: 'Great organization doing authentic relief work in Mandi.'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Great organization doing authentic relief work in Mandi.')).toBeInTheDocument();
    });
  });
});
