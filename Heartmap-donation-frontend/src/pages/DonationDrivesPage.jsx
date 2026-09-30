import React from 'react';
import ProjectsPage from './ProjectsPage';
import './DonationDrivesPage.css';

/**
 * Donation drives are a focused entry point into the existing project
 * workspace. ProjectsPage owns listing/creation and ProjectDetailPage owns
 * collaboration, so this page does not introduce a second API flow.
 */
const DonationDrivesPage = () => (
  <main className="donation-drives-page">
    <ProjectsPage variant="donation-drives" />
  </main>
);

export default DonationDrivesPage;
