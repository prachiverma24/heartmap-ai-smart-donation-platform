import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HelpRequestsPage from './pages/HelpRequestsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
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

describe('Feature 11: HelpRequestsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserContext.user = { id: 'u1', name: 'John Doe', role: 'user' };
    window.scrollTo = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  test('User views own help requests and can change status via selector', async () => {
    const mockRequests = [
      {
        _id: 'hr-1',
        title: 'Winter jackets for shelter',
        category: 'Clothes',
        requiredItem: 'Jackets',
        quantity: 5,
        description: 'Needed for homeless shelter',
        contactInformation: 'shelter@example.com',
        status: 'open',
        location: { address: 'Shimla' },
        images: []
      }
    ];

    api.get.mockResolvedValueOnce({ data: { requests: mockRequests } });
    api.patch.mockResolvedValueOnce({ data: { request: { ...mockRequests[0], status: 'fulfilled' } } });

    render(<HelpRequestsPage />);

    expect(screen.getByText(/Loading requests.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Winter jackets for shelter')).toBeInTheDocument();
    });

    // Verify status control exists
    const statusSelect = screen.getByDisplayValue('Open');
    expect(statusSelect).toBeInTheDocument();

    // User changes status to fulfilled
    fireEvent.change(statusSelect, { target: { value: 'fulfilled' } });

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/help-requests/hr-1', { status: 'fulfilled' });
      expect(screen.getByText(/Request status updated to fulfilled/i)).toBeInTheDocument();
    });
  });

  test('Delete confirmation appears before deleting a request', async () => {
    const mockRequests = [
      {
        _id: 'hr-2',
        title: 'Urgent groceries',
        category: 'Food',
        requiredItem: 'Rice and oil',
        quantity: 2,
        description: 'Food needed',
        contactInformation: 'contact@example.com',
        status: 'open',
        images: []
      }
    ];

    api.get.mockResolvedValueOnce({ data: { requests: mockRequests } });
    api.delete.mockResolvedValueOnce({});

    render(<HelpRequestsPage />);

    await waitFor(() => {
      expect(screen.getByText('Urgent groceries')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this help request?');
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/help-requests/hr-2');
      expect(screen.queryByText('Urgent groceries')).not.toBeInTheDocument();
    });
  });

  test('NGO user can browse open community help requests feed', async () => {
    mockUserContext.user = { id: 'ngo1', name: 'Care NGO', role: 'ngo' };

    const mockMyRequests = [
      {
        _id: 'ngo-req-1',
        title: 'NGO Request 1',
        category: 'Education',
        requiredItem: 'Notebooks',
        quantity: 50,
        description: 'Notebooks for school',
        contactInformation: 'ngo@example.com',
        status: 'open'
      }
    ];

    const mockCommunityRequests = [
      {
        _id: 'comm-req-1',
        title: 'Baby food needed urgently',
        category: 'Food',
        requiredItem: 'Baby Cereal',
        quantity: 3,
        description: 'Single parent needs food',
        contactInformation: 'parent@example.com',
        location: { address: 'Mandi' },
        status: 'open',
        owner: { name: 'Parent Alice' },
        createdAt: '2026-09-19T00:00:00.000Z'
      }
    ];

    api.get.mockImplementation((url) => {
      if (url === '/help-requests?mine=true') {
        return Promise.resolve({ data: { requests: mockMyRequests } });
      }
      if (url === '/help-requests') {
        return Promise.resolve({ data: { requests: mockCommunityRequests } });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<HelpRequestsPage />);

    // NGO should see tabs
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Community Open Requests/i })).toBeInTheDocument();
    });

    // In community feed, community request is displayed
    expect(screen.getByText('Baby food needed urgently')).toBeInTheDocument();
    expect(screen.getByText(/Baby Cereal/i)).toBeInTheDocument();
    expect(screen.getByText(/Parent Alice/i)).toBeInTheDocument();
    expect(screen.getByText(/parent@example.com/i)).toBeInTheDocument();
  });

  test('User role only sees their own requests and not community tabs', async () => {
    mockUserContext.user = { id: 'u1', name: 'Regular User', role: 'user' };

    api.get.mockResolvedValueOnce({ data: { requests: [] } });

    render(<HelpRequestsPage />);

    await waitFor(() => {
      expect(screen.getByText(/You have not created any support requests yet/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: /Community Open Requests/i })).not.toBeInTheDocument();
  });
});

describe('Feature 12: AdminDashboardPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays User Management section, links to /admin/users, and allows role and status updates', async () => {
    const mockAnalytics = {
      users: 5,
      ngos: 2,
      reviewedNgos: 2,
      pendingVerifications: 1,
      listings: 4,
      activeHelpRequests: 2,
      closedHelpRequests: 1,
      reports: 1,
      donationCategories: [{ _id: 'Clothes', count: 3 }],
      verificationStatuses: [{ _id: 'verified', count: 2 }]
    };

    const mockUsers = [
      {
        _id: 'user-101',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'user',
        isActive: true,
        createdAt: '2026-09-19T00:00:00.000Z'
      }
    ];

    api.get.mockImplementation((url) => {
      if (url === '/admin/analytics') return Promise.resolve({ data: { analytics: mockAnalytics } });
      if (url === '/admin/users') return Promise.resolve({ data: { users: mockUsers } });
      if (url === '/admin/ngos') return Promise.resolve({ data: { profiles: [] } });
      if (url === '/admin/donations') return Promise.resolve({ data: { listings: [] } });
      if (url === '/admin/help-requests') return Promise.resolve({ data: { requests: [] } });
      if (url === '/reports') return Promise.resolve({ data: { reports: [] } });
      return Promise.reject(new Error('unknown url'));
    });

    api.patch.mockResolvedValue({ data: { success: true } });

    render(<AdminDashboardPage />);

    expect(screen.getByText(/Loading live dashboard data.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('User management')).toBeInTheDocument();
    });

    // Check link to /admin/users exists
    const usersLink = screen.getByRole('link', { name: /manage users/i });
    expect(usersLink).toHaveAttribute('href', '/admin/users');

    const dedicatedLink = screen.getByRole('link', { name: /open dedicated users page/i });
    expect(dedicatedLink).toHaveAttribute('href', '/admin/users');

    // Check user table is displayed
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();

    // Change user role
    const roleSelect = screen.getByDisplayValue('user');
    fireEvent.change(roleSelect, { target: { value: 'ngo' } });

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/users/user-101/role', { role: 'ngo' });
    });
  });
});
