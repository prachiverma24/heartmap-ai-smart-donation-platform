import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import NGODonationsPage from './pages/NGODonationsPage';
import api from './api';

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

describe('NGODonationsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads and displays available donation listings for NGOs', async () => {
    const mockListings = [
      {
        _id: 'ngo-list-1',
        type: 'Food',
        item: 'Rice Sacks',
        quantity: 10,
        condition: 'new',
        title: 'Fresh Rice Bags',
        description: 'High quality grain bags ready for donation',
        location: { address: 'Sector 5, Chandigarh' },
        pickupAvailable: true,
        status: 'available',
        images: ['https://example.com/rice.jpg'],
        owner: { name: 'Donor John' },
        createdAt: '2026-09-19T00:00:00.000Z'
      }
    ];

    api.get.mockResolvedValueOnce({ data: { listings: mockListings } });

    render(<NGODonationsPage />);

    expect(screen.getByText(/Loading available donation listings.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Fresh Rice Bags')).toBeInTheDocument();
    });

    expect(screen.getByText(/Rice Sacks/i)).toBeInTheDocument();
    expect(screen.getByText(/High quality grain bags ready for donation/i)).toBeInTheDocument();
    expect(screen.getByText(/Sector 5, Chandigarh/i)).toBeInTheDocument();
    expect(screen.getByText(/Donor John/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pickup Available/i).length).toBeGreaterThanOrEqual(1);
  });

  test('shows empty state when no listings available', async () => {
    api.get.mockResolvedValueOnce({ data: { listings: [] } });

    render(<NGODonationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No donation listings found/i)).toBeInTheDocument();
    });
  });
});
