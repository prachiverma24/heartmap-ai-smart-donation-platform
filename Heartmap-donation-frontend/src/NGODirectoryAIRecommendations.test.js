import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NGODirectoryPage from './pages/NGODirectoryPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

describe('Feature 2: AI Recommendations on /ngos Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { profiles: [] } });
  });

  test('renders AI recommendations section ABOVE existing search filters on /ngos', () => {
    render(
      <BrowserRouter>
        <NGODirectoryPage />
      </BrowserRouter>
    );

    // AI section header and subtitle
    expect(screen.getByText(/FIND THE RIGHT NGO WITH AI/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tell us what you want to donate, where you are, and we'll find relevant verified organizations/i)
    ).toBeInTheDocument();

    // Textarea with exact requested placeholder
    const textarea = screen.getByPlaceholderText(/Example: I have 5 winter blankets and clothes to donate in Mandi\.\.\./i);
    expect(textarea).toBeInTheDocument();

    // Action button
    const matchBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    expect(matchBtn).toBeInTheDocument();
    expect(matchBtn).toBeDisabled(); // Initially disabled when textarea empty

    // Existing search filters are still present BELOW
    expect(screen.getByPlaceholderText(/Search by NGO name or cause/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Category/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/City/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Accepted donation type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Find nearby NGOs/i })).toBeInTheDocument();
  });

  test('clicking an example chip populates the textarea and enables "Find My Matches ✨"', () => {
    render(
      <BrowserRouter>
        <NGODirectoryPage />
      </BrowserRouter>
    );

    const chip = screen.getByText(/5 winter blankets and clothes to donate in Mandi/i, { selector: 'button' });
    fireEvent.click(chip);

    const textarea = screen.getByPlaceholderText(/Example: I have 5 winter blankets and clothes to donate in Mandi\.\.\./i);
    expect(textarea.value).toContain('5 winter blankets and clothes to donate in Mandi');

    const matchBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    expect(matchBtn).not.toBeDisabled();
  });

  test('submitting query calls /ai/recommendations and renders "Your Donation Match" cards with verified badge', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: {
          items: ['winter blankets', 'clothes'],
          category: 'Clothes',
          location: 'Mandi',
          quantity: '5 winter blankets'
        },
        recommendations: [
          {
            ngo: {
              _id: 'mandi-redcross-123',
              name: 'Indian Red Cross Society, District Branch Mandi',
              description: 'Humanitarian body providing seasonal clothing and blanket support in Mandi.',
              city: 'Mandi',
              state: 'Himachal Pradesh',
              acceptedDonationTypes: ['Clothes', 'Blankets'],
              urgentlyNeededItems: ['Winter blankets'],
              pickupAvailable: false,
              verificationStatus: 'verified'
            },
            matchReasons: [
              'Accepts Clothes',
              'Your item matches a current urgent need',
              'Located in Mandi, Himachal Pradesh'
            ],
            urgent: true,
            score: 105
          }
        ]
      }
    });

    render(
      <BrowserRouter>
        <NGODirectoryPage />
      </BrowserRouter>
    );

    const textarea = screen.getByPlaceholderText(/Example: I have 5 winter blankets and clothes to donate in Mandi\.\.\./i);
    fireEvent.change(textarea, {
      target: { value: 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.' }
    });

    const matchBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    fireEvent.click(matchBtn);

    expect(api.post).toHaveBeenCalledWith('/ai/recommendations', {
      message: 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.'
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Your Donation Match/i })).toBeInTheDocument();
    });

    // NGO card details
    expect(screen.getByText('Indian Red Cross Society, District Branch Mandi')).toBeInTheDocument();
    expect(screen.getByText(/Verified NGO/i, { selector: '.ai-verified-badge' })).toBeInTheDocument();
    expect(screen.getByText(/URGENT NEED/i, { selector: '.ai-urgent-badge' })).toBeInTheDocument();
    expect(screen.getByText(/Accepts Clothes/i, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Match Score: 105/i)).toBeInTheDocument();

    // Intent tags
    expect(screen.getByText(/Category:/i)).toBeInTheDocument();
    expect(screen.getByText(/Location:/i)).toBeInTheDocument();
  });

  test('handles no-match response with friendly guidance', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: { items: ['servers'], category: 'Electronics', location: 'Timbuktu' },
        recommendations: []
      }
    });

    render(
      <BrowserRouter>
        <NGODirectoryPage />
      </BrowserRouter>
    );

    const textarea = screen.getByPlaceholderText(/Example: I have 5 winter blankets and clothes to donate in Mandi\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'I have old servers to donate in Timbuktu.' } });

    const matchBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    fireEvent.click(matchBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/No verified NGOs matching your donation requirements were found\./i)
      ).toBeInTheDocument();
    });
  });

  test('handles 401 authentication required error with sign in link', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: 'Authentication required' } }
    });

    render(
      <BrowserRouter>
        <NGODirectoryPage />
      </BrowserRouter>
    );

    const textarea = screen.getByPlaceholderText(/Example: I have 5 winter blankets and clothes to donate in Mandi\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'I have winter clothes to donate in Mandi.' } });

    const matchBtn = screen.getByRole('button', { name: /Find My Matches ✨/i });
    fireEvent.click(matchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please sign in to find AI recommendations\./i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Sign in here →/i })).toBeInTheDocument();
  });
});
