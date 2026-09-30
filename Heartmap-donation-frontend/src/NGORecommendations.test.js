import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DonationAssistantPage from './pages/DonationAssistantPage';
import api from './api';

jest.mock('./api', () => ({
  post: jest.fn()
}));

describe('Feature 19.2: AI-Powered NGO Recommendations UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders recommendation form with "Find My Matches ✨" button', () => {
    render(<DonationAssistantPage />);

    expect(screen.getByText(/HEARTMAP AI RECOMMENDATIONS/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Find the Right Verified NGO for Your Donation/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/I have 5 winter blankets and clothes to donate in Mandi/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeDisabled(); // Empty textarea disables button
  });

  test('clicking a sample prompt populates the textarea and enables button', () => {
    render(<DonationAssistantPage />);

    const sampleChip = screen.getByText(/I have 5 winter blankets/i, { selector: 'button' });
    fireEvent.click(sampleChip);

    const textarea = screen.getByPlaceholderText(/I have 5 winter blankets and clothes to donate in Mandi/i);
    expect(textarea.value).toContain('5 winter blankets');

    const submitBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    expect(submitBtn).not.toBeDisabled();
  });

  test('submitting request calls API and displays "Your Donation Match" with NGO details', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: {
          items: ['winter blankets', 'clothes'],
          category: 'Clothes',
          location: 'Mandi',
          quantity: '5 blankets'
        },
        recommendations: [
          {
            ngo: {
              id: 'ngo-mandi-1',
              name: 'Mandi Relief Trust',
              description: 'Providing winter essentials and warm relief.',
              city: 'Mandi',
              state: 'Himachal Pradesh',
              address: 'Main Bazar, Mandi',
              acceptedDonationTypes: ['Clothes'],
              urgentlyNeededItems: ['winter blankets'],
              pickupAvailable: true,
              dropOffAvailable: true,
              verificationStatus: 'verified',
              officialDonationUrl: 'https://example.org/mandi-donate',
              website: 'https://example.org'
            },
            matchReasons: [
              'Accepts Clothes donations',
              'Matches current urgent need: winter blankets',
              'Located in Mandi, Himachal Pradesh',
              'Pickup service available'
            ],
            urgent: true
          }
        ]
      }
    });

    render(<DonationAssistantPage />);

    const textarea = screen.getByPlaceholderText(/I have 5 winter blankets and clothes to donate in Mandi/i);
    fireEvent.change(textarea, {
      target: { value: 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.' }
    });

    const submitBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    fireEvent.click(submitBtn);

    expect(api.post).toHaveBeenCalledWith('/ai/recommendations', {
      message: 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.'
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Your Donation Match/i })).toBeInTheDocument();
    });

    // Verify Understood intent
    expect(screen.getByText(/Understood Donation Request/i)).toBeInTheDocument();
    expect(screen.getByText(/winter blankets, clothes/i)).toBeInTheDocument();

    // Verify NGO Card
    expect(screen.getByText('Mandi Relief Trust')).toBeInTheDocument();
    expect(screen.getByText('Verified NGO', { selector: '.verification-badge' })).toBeInTheDocument();
    expect(screen.getByText('Urgent Need', { selector: '.urgent-badge' })).toBeInTheDocument();
    expect(screen.getByText(/Main Bazar, Mandi/i)).toBeInTheDocument();
    expect(screen.getByText(/Accepts Clothes donations/i)).toBeInTheDocument();
    expect(screen.getByText(/Official Donation Channel →/i)).toBeInTheDocument();
  });

  test('displays no-match state when no verified NGOs match request', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: { items: ['electronics'], location: 'Solan' },
        recommendations: []
      }
    });

    render(<DonationAssistantPage />);

    const textarea = screen.getByPlaceholderText(/I have 5 winter blankets and clothes to donate in Mandi/i);
    fireEvent.change(textarea, { target: { value: 'I have laptops to donate in Solan.' } });

    fireEvent.click(screen.getByRole('button', { name: /Find My Matches ✨/i }));

    await waitFor(() => {
      expect(screen.getByText(/No verified NGOs matching your donation requirements were found/i)).toBeInTheDocument();
      expect(screen.getByText(/Suggestions to find a match:/i)).toBeInTheDocument();
    });
  });

  test('handles request errors gracefully with user-friendly message', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: { error: 'AI service temporarily unavailable. Please try again later.' }
      }
    });

    render(<DonationAssistantPage />);

    const textarea = screen.getByPlaceholderText(/I have 5 winter blankets and clothes to donate in Mandi/i);
    fireEvent.change(textarea, { target: { value: 'I have winter clothes in Mandi.' } });

    fireEvent.click(screen.getByRole('button', { name: /Find My Matches ✨/i }));

    await waitFor(() => {
      expect(screen.getByText(/AI service temporarily unavailable/i)).toBeInTheDocument();
    });
  });
});
