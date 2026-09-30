import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StoryPage from './pages/StoryPage';
import DonatePage from './pages/DonatePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NGOProfilePage from './pages/NGOProfilePage';
import NGODirectoryPage from './pages/NGODirectoryPage';
import NGODetailPage from './pages/NGODetailPage';
import NGODonationsPage from './pages/NGODonationsPage';
import HelpRequestsPage from './pages/HelpRequestsPage';
import TrustAdminPage from './pages/TrustAdminPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import DonationAssistantPage from './pages/DonationAssistantPage';
import AIAssistantPage from './pages/AIAssistantPage';
import HowItWorksPage from './pages/HowItWorksPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DonationDrivesPage from './pages/DonationDrivesPage';
import PublicDonationDrivePage from './pages/PublicDonationDrivePage';
import Navigation from './components/Navigation';
import ChatBox from './components/ChatBox';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navigation />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/story/:id" element={<StoryPage />} />
            <Route path="/donate/:id" element={<DonatePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/ngos" element={<NGODirectoryPage />} />
            <Route path="/ngos/:id" element={<NGODetailPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/ai-assistant" element={<AIAssistantPage />} />
            <Route path="/help-requests" element={<ProtectedRoute roles={['user', 'ngo']}><HelpRequestsPage /></ProtectedRoute>} />
            <Route path="/assistant" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><DonationAssistantPage /></ProtectedRoute>} />
            <Route path="/recommendations" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><DonationAssistantPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/stories" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/trust" element={<ProtectedRoute roles={['admin']}><TrustAdminPage /></ProtectedRoute>} />
            <Route path="/ngo/donations" element={<ProtectedRoute roles={['ngo', 'admin']}><NGODonationsPage /></ProtectedRoute>} />
            <Route path="/ngo/profile" element={<ProtectedRoute roles={['ngo']}><NGOProfilePage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><ProjectsPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/donation-drives" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><DonationDrivesPage /></ProtectedRoute>} />
            <Route path="/donation-drives/:driveId" element={<ProtectedRoute roles={['user', 'ngo', 'admin']}><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/public/donation-drives/:driveId" element={<PublicDonationDrivePage />} />
            <Route path="/public/donation-drive/:driveId" element={<PublicDonationDrivePage />} />
          </Routes>
          <ChatBox />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
