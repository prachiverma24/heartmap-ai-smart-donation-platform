import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MapComponent from './components/MapComponent';
import HomePage from './pages/HomePage';
import api from './api';

jest.mock('axios', () => {
  const client = {
    get: jest.fn(() => Promise.reject(new Error('test network disabled'))),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn()
  };
  return { __esModule: true, default: { ...client, create: () => client } };
});

jest.mock('./api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

jest.mock('@lottiefiles/react-lottie-player', () => ({
  Player: () => null
}));

jest.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => ({ children, whileHover, whileTap, whileInView, viewport, initial, animate, exit, transition, ...props }) => {
      const Tag = tag === 'button' ? 'button' : tag === 'article' ? 'article' : 'div';
      return <Tag {...props}>{children}</Tag>;
    }
  }),
  AnimatePresence: ({ children }) => children
}));

describe('Feature 14: Maps and Real MongoDB NGO Coordinates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('MapComponent renders markers only for NGOs with real valid coordinates', () => {
    const realNgos = [
      {
        _id: 'ngo-pune',
        name: 'Pune Relief Foundation',
        latitude: 18.5204,
        longitude: 73.8567,
        city: 'Pune',
        state: 'Maharashtra',
        acceptedDonationTypes: ['Food', 'Clothes']
      },
      {
        _id: 'ngo-no-coords',
        name: 'NGO Without Coordinates',
        city: 'Nowhere',
        state: 'Unknown'
      }
    ];

    const { container } = render(
      <MapComponent ngos={realNgos} stories={[]} />
    );

    // Filter pill should show 1 NGO Hub (only the one with valid coordinates)
    expect(screen.getByText(/NGO Hubs \(1\)/i)).toBeInTheDocument();

    // Exactly 1 NGO pin rendered in markers layer
    const ngoPins = container.querySelectorAll('.ngo-pin');
    expect(ngoPins).toHaveLength(1);
    expect(screen.getByTitle('Pune Relief Foundation')).toBeInTheDocument();
    expect(screen.queryByTitle('NGO Without Coordinates')).not.toBeInTheDocument();
  });

  test('MapComponent shows proper empty state when 0 NGOs exist', () => {
    render(<MapComponent ngos={[]} stories={[]} />);

    expect(screen.getByText(/NGO Hubs \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No active map points yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No verified NGO hubs currently listed with location data/i)).toBeInTheDocument();

    // Switch to NGO Hubs tab
    fireEvent.click(screen.getByText(/NGO Hubs \(0\)/i));
    expect(screen.getByText(/No verified NGO locations found/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no verified NGO hubs with coordinates published right now/i)).toBeInTheDocument();
  });

  test('HomePage loads real NGOs from backend and does NOT fall back to demo Delhi NGOs when empty', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/stories') return Promise.resolve({ data: [] });
      if (url === '/ngo/public') return Promise.resolve({ data: { profiles: [] } });
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/ngo/public');
    });

    // Should display empty state in featured section, NOT demo Delhi NGOs like Asha Community Shelter
    await waitFor(() => {
      expect(screen.getByText(/No verified organizations currently listed/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Asha Community Shelter & Care')).not.toBeInTheDocument();
    expect(screen.queryByText('Bright Horizons Youth & Literacy')).not.toBeInTheDocument();
    expect(screen.queryByText('Green Fork Food Rescue Network')).not.toBeInTheDocument();

    // In MapComponent, NGO Hubs should be 0
    expect(screen.getByText(/NGO Hubs \(0\)/i)).toBeInTheDocument();
  });

  test('MapComponent nearby search and location filter filters correctly and shows empty notice if none match', () => {
    const realNgos = [
      {
        _id: 'ngo-pune',
        name: 'Pune Relief Foundation',
        latitude: 18.5204,
        longitude: 73.8567,
        city: 'Pune',
        state: 'Maharashtra'
      }
    ];

    render(<MapComponent ngos={realNgos} stories={[]} />);

    const searchInput = screen.getByLabelText(/Filter map by city or name/i);
    fireEvent.change(searchInput, { target: { value: 'Kolkata' } });

    // Should filter out Pune and show 0 results
    expect(screen.getByText(/NGO Hubs \(0\)/i)).toBeInTheDocument();

    // Click NGO Hubs tab
    fireEvent.click(screen.getByText(/NGO Hubs \(0\)/i));
    expect(screen.getByText(/No verified NGO hubs match "Kolkata"/i)).toBeInTheDocument();

    // Reset filter
    fireEvent.click(screen.getByRole('button', { name: /Reset Filter/i }));
    expect(screen.getByText(/NGO Hubs \(1\)/i)).toBeInTheDocument();
    expect(screen.getByTitle('Pune Relief Foundation')).toBeInTheDocument();
  });
});

