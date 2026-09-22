const express = require('express');
const mongoose = require('mongoose');
const DonationDrive = require('../models/DonationDrive');
const DonationItem = require('../models/DonationItem');
const DonationDriveFile = require('../models/DonationDriveFile');
const DonationDriveMember = require('../models/DonationDriveMember');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(['/donation-drives/:driveId', '/donation-drive/:driveId', '/projects/:driveId', '/project/:driveId'], asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.driveId)) {
    return res.status(404).json({ error: 'Donation Drive not found' });
  }

  let drive = await DonationDrive.findById(req.params.driveId)
    .select('name description category targetRegion goal coverImage status owner isPublic createdAt')
    .populate('owner', 'name')
    .lean();

  let isProject = false;
  if (!drive) {
    const Project = require('../models/Project');
    drive = await Project.findById(req.params.driveId)
      .select('name description category targetRegion goal coverImage status owner isPublic createdAt')
      .populate('owner', 'name')
      .lean();
    isProject = true;
  }

  if (!drive) return res.status(404).json({ error: 'Donation Drive not found' });
  if (!drive.isPublic) {
    return res.status(404).json({ error: 'This donation drive is currently private.', isPrivate: true });
  }

  const items = await DonationItem.find({ drive: drive._id })
    .select('title category description quantity condition image createdAt')
    .sort({ createdAt: -1 })
    .lean();
  let files = [];
  let memberCount = 1;
  if (!isProject) {
    [files, memberCount] = await Promise.all([
      DonationDriveFile.find({ drive: drive._id, isPublic: true }).select('originalName mimeType size secureUrl url note createdAt').sort({ createdAt: -1 }).lean(),
      DonationDriveMember.countDocuments({ drive: drive._id })
    ]);
  } else {
    const ProjectMember = require('../models/ProjectMember');
    memberCount = await ProjectMember.countDocuments({ project: drive._id });
  }

  return res.json({
    drive: {
      id: drive._id,
      name: drive.name,
      description: drive.description,
      category: drive.category,
      targetRegion: drive.targetRegion,
      goal: drive.goal,
      coverImage: drive.coverImage,
      status: drive.status,
      creator: drive.owner ? (drive.owner.name || 'Organizer') : null,
      createdAt: drive.createdAt,
      items,
      files,
      contributionSummary: { memberCount, itemCount: items.length, fileCount: files.length }
    }
  });
}));

module.exports = router;
