/**
 * Phase 8 Frontend Tests: Project Collaboration, Markdown Notes, File Upload & Preview
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// ======================================================
// MOCK API
// ======================================================
jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

// Mock AuthContext so we control the user value
jest.mock('./context/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => children
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ projectId: 'proj123' })
}));

import api from './api';
import { useAuth } from './context/AuthContext';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

// ======================================================
// HELPERS
// ======================================================
const mockUser = { _id: 'user1', name: 'Alice', email: 'alice@example.com', role: 'user' };

const withAuth = (component) => (
  <BrowserRouter>
    {component}
  </BrowserRouter>
);

const setupAuth = (user = mockUser) => {
  useAuth.mockReturnValue({ user, isLoading: false, login: jest.fn(), logout: jest.fn(), register: jest.fn() });
};

const mockProject = {
  id: 'proj123',
  name: 'HeartMap Phase 8',
  description: 'Full stack + AI project',
  owner: { id: 'user1', name: 'Alice', email: 'alice@example.com' },
  memberCount: 3,
  userRole: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const mockNote = {
  id: 'note1',
  title: 'Setup Guide',
  content: '## Setup\n\nInstall dependencies.',
  createdBy: { id: 'user1', name: 'Alice' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const mockFile = {
  id: 'file1',
  originalName: 'app.js',
  filename: 'abc123.js',
  mimeType: 'application/javascript',
  size: 1024,
  uploadedBy: { id: 'user1', name: 'Alice' },
  createdAt: '2026-01-01T00:00:00.000Z'
};

// ======================================================
// PROJECTS PAGE TESTS
// ======================================================

describe('ProjectsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
    api.get.mockResolvedValue({ data: { projects: [mockProject] } });
  });

  test('renders Projects page with title', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('Project Hub')).toBeInTheDocument();
      expect(screen.getByText(/Project Hub/i)).toBeInTheDocument();
    });
  });

  test('loads and displays project list', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('HeartMap Phase 8')).toBeInTheDocument();
    });
  });

  test('shows project owner name in card', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  test('shows member count in project card', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  test('shows Create Project button', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByTestId('create-project-btn')).toBeInTheDocument();
    });
  });

  test('opens Create Project modal when button is clicked', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => screen.getByTestId('create-project-btn'));
    fireEvent.click(screen.getByTestId('create-project-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('create-project-modal')).toBeInTheDocument();
    });
  });

  test('shows project name input in create modal', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => screen.getByTestId('create-project-btn'));
    fireEvent.click(screen.getByTestId('create-project-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('project-name-input')).toBeInTheDocument();
    });
  });

  test('submits create project form and calls API', async () => {
    api.post.mockResolvedValue({ data: { project: { ...mockProject, id: 'newproj' } } });
    render(withAuth(<ProjectsPage />));
    await waitFor(() => screen.getByTestId('create-project-btn'));
    fireEvent.click(screen.getByTestId('create-project-btn'));
    await waitFor(() => screen.getByTestId('project-name-input'));
    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'New Project' } });
    fireEvent.click(screen.getByText('Create Project'));
    fireEvent.click(screen.getByText(/Create (Project|Drive)/i));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects', expect.objectContaining({ name: 'New Project' }));
    });
  });

  test('shows empty state when no projects', async () => {
    api.get.mockResolvedValue({ data: { projects: [] } });
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
      expect(screen.getByText(/No (projects|donation drives) yet/i)).toBeInTheDocument();
    });
  });

  test('shows error state on API failure', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });

  test('shows Open Project button on project card', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('Open Project →')).toBeInTheDocument();
      expect(screen.getByText(/Open (Project|Donation Drive) →/i)).toBeInTheDocument();
    });
  });

  test('role badge shows "owner" for owner projects', async () => {
    render(withAuth(<ProjectsPage />));
    await waitFor(() => {
      expect(screen.getByText('owner')).toBeInTheDocument();
    });
  });
});

// ======================================================
// PROJECT DETAIL PAGE TESTS
// ======================================================

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
    api.get.mockImplementation((url) => {
      if (url.includes('/notes')) return Promise.resolve({ data: { notes: [mockNote] } });
      if (url.includes('/files')) return Promise.resolve({ data: { files: [mockFile] } });
      if (url.includes('/members')) return Promise.resolve({ data: { members: [{ id: 'm1', user: { id: 'user1', name: 'Alice', email: 'alice@example.com' }, role: 'owner', joinedAt: '2026-01-01' }] } });
      return Promise.resolve({ data: { project: { ...mockProject } } });
    });
  });

  test('renders project name', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText('HeartMap Phase 8')).toBeInTheDocument();
    });
  });

  test('shows overview tab with stats', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText('📊 Overview')).toBeInTheDocument();
    });
  });

  test('shows Members tab', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText(/👥 Members/)).toBeInTheDocument();
    });
  });

  test('shows Notes tab', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText(/📝 Notes/)).toBeInTheDocument();
    });
  });

  test('shows Files tab', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText(/📁 Files/)).toBeInTheDocument();
    });
  });

  test('clicking Notes tab shows New Note button', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => {
      expect(screen.getByTestId('new-note-btn')).toBeInTheDocument();
    });
  });

  test('clicking New Note opens note editor', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => screen.getByTestId('new-note-btn'));
    fireEvent.click(screen.getByTestId('new-note-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('note-title-input')).toBeInTheDocument();
    });
  });

  test('note editor shows Explain with Gemini button', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => screen.getByTestId('new-note-btn'));
    fireEvent.click(screen.getByTestId('new-note-btn'));
    await waitFor(() => {
      expect(screen.getByText(/✨ Explain/i)).toBeInTheDocument();
    });
  });

  test('note editor shows Improve with Gemini button', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => screen.getByTestId('new-note-btn'));
    fireEvent.click(screen.getByTestId('new-note-btn'));
    await waitFor(() => {
      expect(screen.getByText(/✨ Improve/i)).toBeInTheDocument();
    });
  });

  test('Gemini Improve shows suggestion and apply button', async () => {
    api.post.mockResolvedValue({ data: { improved: '## Improved Note\n\nBetter content.', warning: 'Review before applying' } });
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => screen.getByTestId('new-note-btn'));
    fireEvent.click(screen.getByTestId('new-note-btn'));
    await waitFor(() => screen.getByTestId('note-content-input'));
    fireEvent.change(screen.getByTestId('note-content-input'), { target: { value: 'some note content' } });
    fireEvent.click(screen.getByText(/✨ Improve/i));
    await waitFor(() => {
      expect(screen.getByText('✓ Apply Improvement')).toBeInTheDocument();
    });
  });

  test('Gemini Improve does NOT auto-apply — requires user to click Apply', async () => {
    api.post.mockResolvedValue({ data: { improved: '## Improved Note', warning: 'Review before applying' } });
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📝 Notes/));
    fireEvent.click(screen.getByText(/📝 Notes/));
    await waitFor(() => screen.getByTestId('new-note-btn'));
    fireEvent.click(screen.getByTestId('new-note-btn'));
    await waitFor(() => screen.getByTestId('note-content-input'));

    const textarea = screen.getByTestId('note-content-input');
    fireEvent.change(textarea, { target: { value: 'original content' } });
    expect(textarea.value).toBe('original content');

    fireEvent.click(screen.getByText(/✨ Improve/i));
    await waitFor(() => screen.getByText('✓ Apply Improvement'));

    // Content should still be unchanged until user clicks Apply
    expect(textarea.value).toBe('original content');
  });

  test('Files tab shows Upload File button', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📁 Files/));
    fireEvent.click(screen.getByText(/📁 Files/));
    await waitFor(() => {
      expect(screen.getByText(/Upload File/i)).toBeInTheDocument();
      expect(screen.getByText(/Upload (Item Photo \/ )?File/i)).toBeInTheDocument();
    });
  });

  test('Files tab lists uploaded files', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📁 Files/));
    fireEvent.click(screen.getByText(/📁 Files/));
    await waitFor(() => {
      expect(screen.getByText('app.js')).toBeInTheDocument();
    });
  });

  test('Files tab shows file size', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/📁 Files/));
    fireEvent.click(screen.getByText(/📁 Files/));
    await waitFor(() => {
      expect(screen.getByText(/1.0 KB/i)).toBeInTheDocument();
    });
  });

  test('Members tab shows member list', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/👥 Members/));
    fireEvent.click(screen.getByText(/👥 Members/));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  test('Owner sees Add Member form', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => screen.getByText(/👥 Members/));
    fireEvent.click(screen.getByText(/👥 Members/));
    await waitFor(() => {
      expect(screen.getByTestId('add-member-input')).toBeInTheDocument();
    });
  });

  test('403 error shows Access denied message', async () => {
    api.get.mockRejectedValue({ response: { status: 403, data: { error: 'Access denied' } } });
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText(/not a member of this project/i)).toBeInTheDocument();
    });
  });

  test('Back to Projects navigation button exists', async () => {
    render(withAuth(<ProjectDetailPage />));
    await waitFor(() => {
      expect(screen.getByText('← Projects')).toBeInTheDocument();
    });
  });
});

// ======================================================
// SECURITY TESTS (frontend)
// ======================================================

describe('Frontend Security Tests', () => {
  test('no GEMINI_API_KEY pattern present in any component source', () => {
    // This test verifies that components don't contain hardcoded keys
    const projectPageSource = require('fs').readFileSync(
      require('path').join(__dirname, 'pages/ProjectsPage.jsx'),
      'utf-8'
    );
    expect(projectPageSource).not.toMatch(/AIza[A-Za-z0-9_-]{35}/);
    expect(projectPageSource).not.toMatch(/GEMINI_API_KEY\s*=/);
  });

  test('ProjectDetailPage source contains no hardcoded API keys', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'pages/ProjectDetailPage.jsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/AIza[A-Za-z0-9_-]{35}/);
  });
});
