import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AISearchSection from './components/AISearchSection';
import NGODirectoryPage from './pages/NGODirectoryPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Feature 3: AI-Powered NGO Search UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. renders AI Search banner, input, sample queries, and "Search with AI ✨" button', () => {
    renderWithRouter(<AISearchSection />);

    expect(screen.getByText(/SEARCH NGOs WITH AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Describe what you're looking for in your own words/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Find verified NGOs in Mandi that accept clothes/i);
    expect(input).toBeInTheDocument();

    const searchBtn = screen.getByRole('button', { name: /Search with AI/i });
    expect(searchBtn).toBeInTheDocument();
    expect(searchBtn).toBeDisabled(); // Disabled when input is under 3 characters

    expect(screen.getByText(/Find verified NGOs in Mandi that accept clothes/i, { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText(/Where can I donate food in Himachal Pradesh\?/i, { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText(/Show verified NGOs near Mandi for blankets/i, { selector: 'button' })).toBeInTheDocument();
  });

  test('2. clicking a sample search triggers AI search request with that query', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: {
          location: 'Mandi',
          category: 'Clothes',
          donationType: 'Clothes',
          item: 'clothes',
          keywords: ['mandi', 'clothes']
        },
        results: [
          {
            ngo: {
              id: 'ngo-mandi-redcross',
              name: 'Indian Red Cross Society, District Branch Mandi',
              description: 'Statutory humanitarian body providing relief in Mandi.',
              city: 'Mandi',
              state: 'Himachal Pradesh',
              acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
              verificationStatus: 'verified',
              pickupAvailable: false,
              contact: '01905-225220'
            },
            matchReasons: [
              'Located in Mandi, Himachal Pradesh',
              'Verified accepted donation type: Disaster Relief'
            ],
            explanation: 'Verified organization located in Mandi based on official portal.'
          }
        ],
        totalResults: 1
      }
    });

    renderWithRouter(<AISearchSection />);

    const sampleChip = screen.getByText('Find verified NGOs in Mandi that accept clothes', { selector: 'button' });
    fireEvent.click(sampleChip);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/search', {
        query: 'Find verified NGOs in Mandi that accept clothes'
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Indian Red Cross Society, District Branch Mandi/i)).toBeInTheDocument();
      expect(screen.getByTitle('Verified against official records')).toBeInTheDocument();
      expect(screen.getByText(/Located in Mandi, Himachal Pradesh/i)).toBeInTheDocument();
      expect(screen.getByText(/01905-225220/i)).toBeInTheDocument();
      expect(screen.getByText(/Drop-off at center \(pickup not verified\)/i)).toBeInTheDocument();
    });
  });

  test('3. displays parsed search intent pills above matching results', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: {
          purpose: 'education for children',
          donationType: 'Educational Supplies',
          keywords: ['education', 'children']
        },
        results: [
          {
            ngo: {
              id: 'ngo-sahyog-1',
              name: 'Sahyog Bal Shrawan and Viklang Kalyan Samiti',
              city: 'Mandi',
              acceptedDonationTypes: ['Educational Supplies', 'Books'],
              verificationStatus: 'verified'
            },
            matchReasons: ['Mission directly supports education for children']
          }
        ],
        totalResults: 1
      }
    });

    renderWithRouter(<AISearchSection />);

    const input = screen.getByPlaceholderText(/Find verified NGOs in Mandi that accept clothes/i);
    fireEvent.change(input, { target: { value: 'I want to support education for children' } });

    const searchBtn = screen.getByRole('button', { name: /Search with AI/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Parsed Search Intent:/i)).toBeInTheDocument();
      expect(screen.getByText(/Mission directly supports education for children/i)).toBeInTheDocument();
      expect(screen.getByText(/Sahyog Bal Shrawan/i)).toBeInTheDocument();
    });
  });

  test('4. renders empty state with suggestions when 0 matches found', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        intent: {
          location: 'Antarctica'
        },
        results: [],
        totalResults: 0,
        message: 'No verified NGOs matching your search were found.',
        suggestions: [
          'Try broadening your location.',
          'Try searching for broader donation categories.'
        ]
      }
    });

    renderWithRouter(<AISearchSection />);

    const input = screen.getByPlaceholderText(/Find verified NGOs in Mandi that accept clothes/i);
    fireEvent.change(input, { target: { value: 'NGOs in Antarctica' } });

    const searchBtn = screen.getByRole('button', { name: /Search with AI/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/No verified NGOs matching your search were found/i)).toBeInTheDocument();
      expect(screen.getByText(/Try broadening your location/i)).toBeInTheDocument();
    });
  });

  test('5. renders error state gracefully when API fails', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        status: 502,
        data: { error: 'AI service temporarily unavailable. Please try again later.' }
      }
    });

    renderWithRouter(<AISearchSection />);

    const input = screen.getByPlaceholderText(/Find verified NGOs in Mandi that accept clothes/i);
    fireEvent.change(input, { target: { value: 'Find clothes in Mandi' } });

    const searchBtn = screen.getByRole('button', { name: /Search with AI/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/AI service temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  test('6. NGODirectoryPage renders AISearchSection alongside existing features', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        profiles: [
          {
            _id: 'ngo-dir-1',
            name: 'Mandi Care NGO',
            city: 'Mandi',
            verificationStatus: 'verified'
          }
        ]
      }
    });

    renderWithRouter(<NGODirectoryPage />);

    // Feature 3: AI Search Section is present
    expect(screen.getByText(/SEARCH NGOs WITH AI/i)).toBeInTheDocument();

    // Feature 2: AI Recommendations Section is present
    expect(screen.getByText(/FIND THE RIGHT NGO WITH AI/i)).toBeInTheDocument();

    // Traditional filters are present
    expect(screen.getByPlaceholderText(/Search by NGO name or cause/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Category/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/City/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Mandi Care NGO')).toBeInTheDocument();
    });
  });
});
