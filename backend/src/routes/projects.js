const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const mongoose = require('mongoose');
const { body, param } = require('express-validator');
const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');
const Note = require('../models/Note');
const ProjectFile = require('../models/ProjectFile');
const DonationItem = require('../models/DonationItem');
const DonationInterest = require('../models/DonationInterest');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { upload: itemUpload } = require('../middleware/upload');

const router = express.Router();

// Ensure upload directory exists
const projectUploadDir = path.join(__dirname, '../../uploads/project-files');
if (!fs.existsSync(projectUploadDir)) {
  fs.mkdirSync(projectUploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, projectUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    cb(null, safeName);
  }
});

// Allowed file extensions and MIME types
const allowedExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
  '.pdf',
  '.md', '.txt',
  '.js', '.jsx', '.ts', '.tsx',
  '.py',
  '.java',
  '.c', '.cpp', '.h', '.hpp',
  '.json', '.css', '.html', '.xml'
]);

const dangerousExtensions = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.bin', '.msi', '.dll', '.elf', '.com', '.vbs', '.scr', '.jar', '.apk'
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (dangerousExtensions.has(ext)) {
    return cb(new Error('Executable and dangerous files are strictly prohibited'), false);
  }
  if (!allowedExtensions.has(ext)) {
    return cb(new Error('Unsupported file type. Supported: Images, PDF, Markdown/Text, and common Code files.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper middleware: check project access
const requireProjectMember = asyncHandler(async (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  if (!mongoose.isValidObjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const member = await ProjectMember.findOne({ project: project._id, user: req.user._id });
  if (!member && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden: You are not a member of this project' });
  }

  req.project = project;
  req.projectMember = member || { role: req.user.role === 'admin' ? 'owner' : 'member' };
  next();
});

// Helper middleware: check project owner
const requireProjectOwner = asyncHandler(async (req, res, next) => {
  const isOwner = req.project.owner.equals(req.user._id) || req.projectMember?.role === 'owner' || req.user.role === 'admin';
  if (!isOwner) {
    return res.status(403).json({ error: 'Permission denied: Only project owners can perform this action' });
  }
  next();
});

const removeProjectFile = async (storagePath) => {
  if (!storagePath) return;
  const resolvedPath = path.resolve(storagePath);
  const uploadRoot = path.resolve(projectUploadDir);
  if (!resolvedPath.startsWith(`${uploadRoot}${path.sep}`)) return;
  try {
    await fs.promises.unlink(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

// ==========================================
// 1. PROJECT COLLABORATION ROUTES
// ==========================================

// POST /api/projects - Create a new project
router.post(
  '/',
  authenticate,
  itemUpload.single('coverImage'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Project name must be between 2 and 120 characters'),
    body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description must be under 2000 characters'),
    body('category').optional().isString().trim().isLength({ max: 80 }),
    body('targetRegion').optional().isString().trim().isLength({ max: 160 }),
    body('goal').optional().isFloat({ min: 0 }),
    body('coverImage').optional().isString().trim().isLength({ max: 500 }),
    body('isPublic').optional().isBoolean(),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const project = new Project({
      name: req.body.name,
      description: req.body.description || '',
      owner: req.user._id,
      category: req.body.category,
      targetRegion: req.body.targetRegion,
      goal: req.body.goal,
      coverImage: req.file ? req.file.filename : req.body.coverImage,
      isPublic: req.body.isPublic === true
    });
    await project.save();

    // Register creator as owner in ProjectMember
    const member = new ProjectMember({
      project: project._id,
      user: req.user._id,
      role: 'owner'
    });
    await member.save();

    const drive = {
        id: project._id,
        name: project.name,
        description: project.description,
        category: project.category, targetRegion: project.targetRegion,
        goal: project.goal, coverImage: project.coverImage,
        isPublic: project.isPublic,
        owner: req.user.toSafeObject(),
        memberCount: 1,
        itemCount: 0, interestCount: 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      };
    return res.status(201).json({ project: drive, drive });
  })
);

// PUT /api/projects/:id - Update project (owner only)
router.put(
  '/:id',
  authenticate,
  requireProjectMember,
  requireProjectOwner,
  itemUpload.single('coverImage'),
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Project name must be between 2 and 120 characters'),
    body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description must be under 2000 characters'),
    body('category').optional().isString().trim().isLength({ max: 80 }),
    body('targetRegion').optional().isString().trim().isLength({ max: 160 }),
    body('goal').optional().isFloat({ min: 0 }),
    body('coverImage').optional().isString().trim().isLength({ max: 500 }),
    body('isPublic').optional().isBoolean(),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    if (req.body.name !== undefined) req.project.name = req.body.name;
    if (req.body.description !== undefined) req.project.description = req.body.description;
    if (req.body.isPublic !== undefined) req.project.isPublic = req.body.isPublic;
    for (const field of ['category', 'targetRegion', 'goal', 'coverImage']) {
      if (req.body[field] !== undefined) req.project[field] = req.body[field];
    }
    if (req.file) req.project.coverImage = req.file.filename;
    await req.project.save();
    const project = await Project.findById(req.project._id).populate('owner', 'name email role');
    const memberCount = await ProjectMember.countDocuments({ project: project._id });
    const itemCount = await DonationItem.countDocuments({ drive: project._id });
    const interestCount = await DonationInterest.countDocuments({ drive: project._id });
    const resultObj = {
      id: project._id,
      name: project.name,
      description: project.description,
      category: project.category, targetRegion: project.targetRegion,
      goal: project.goal, coverImage: project.coverImage,
      isPublic: project.isPublic,
      owner: project.owner ? { id: project.owner._id, name: project.owner.name, email: project.owner.email, role: project.owner.role } : null,
      memberCount,
      itemCount, interestCount,
      userRole: req.projectMember.role,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    return res.json({ project: resultObj, drive: resultObj });
  })
);

router.patch(
  '/:id',
  authenticate,
  requireProjectMember,
  requireProjectOwner,
  itemUpload.single('coverImage'),
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Project name must be between 2 and 120 characters'),
    body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description must be under 2000 characters'),
    body('category').optional().isString().trim().isLength({ max: 80 }),
    body('targetRegion').optional().isString().trim().isLength({ max: 160 }),
    body('goal').optional().isFloat({ min: 0 }),
    body('coverImage').optional().isString().trim().isLength({ max: 500 }),
    body('isPublic').optional().isBoolean(),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    if (req.body.name !== undefined) req.project.name = req.body.name;
    if (req.body.description !== undefined) req.project.description = req.body.description;
    if (req.body.isPublic !== undefined) req.project.isPublic = req.body.isPublic;
    for (const field of ['category', 'targetRegion', 'goal', 'coverImage']) {
      if (req.body[field] !== undefined) req.project[field] = req.body[field];
    }
    if (req.file) req.project.coverImage = req.file.filename;
    await req.project.save();
    const project = await Project.findById(req.project._id).populate('owner', 'name email role');
    const memberCount = await ProjectMember.countDocuments({ project: project._id });
    const itemCount = await DonationItem.countDocuments({ drive: project._id });
    const interestCount = await DonationInterest.countDocuments({ drive: project._id });
    const resultObj = {
      id: project._id,
      name: project.name,
      description: project.description,
      category: project.category, targetRegion: project.targetRegion,
      goal: project.goal, coverImage: project.coverImage,
      isPublic: project.isPublic,
      owner: project.owner ? { id: project.owner._id, name: project.owner.name, email: project.owner.email, role: project.owner.role } : null,
      memberCount,
      itemCount, interestCount,
      userRole: req.projectMember.role,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    return res.json({ project: resultObj, drive: resultObj });
  })
);

// DELETE /api/projects/:id - Delete project and all associated data (owner only)
router.delete(
  '/:id',
  authenticate,
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const files = await ProjectFile.find({ project: req.project._id }).select('storagePath').lean();
    // Remove database records together so no orphaned collaboration data remains.
    await Promise.all([
      ProjectMember.deleteMany({ project: req.project._id }),
      Note.deleteMany({ project: req.project._id }),
      ProjectFile.deleteMany({ project: req.project._id }),
      DonationInterest.deleteMany({ drive: req.project._id }),
      DonationItem.deleteMany({ drive: req.project._id }),
      Project.deleteOne({ _id: req.project._id })
    ]);
    await Promise.all(files.map(file => removeProjectFile(file.storagePath).catch(() => undefined)));
    return res.json({ message: 'Project deleted successfully' });
  })
);

// GET /api/projects - List projects accessible to current user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    // Find all memberships for current user
    const memberships = await ProjectMember.find({ user: req.user._id });
    const projectIds = memberships.map(m => m.project);

    // If admin, they can also see all projects or user's projects
    const filter = req.user.role === 'admin' ? {} : { _id: { $in: projectIds } };
    const projects = await Project.find(filter).populate('owner', 'name email role').sort({ updatedAt: -1 });

    // Fetch member count for each project
    const projectList = await Promise.all(
      projects.map(async (p) => {
        const count = await ProjectMember.countDocuments({ project: p._id });
        const itemCount = await DonationItem.countDocuments({ drive: p._id });
        const interestCount = await DonationInterest.countDocuments({ drive: p._id });
        const userMembership = memberships.find(m => m.project.toString() === p._id.toString());
        return {
          id: p._id,
          name: p.name,
          description: p.description,
          category: p.category, targetRegion: p.targetRegion,
          goal: p.goal, coverImage: p.coverImage,
          isPublic: p.isPublic,
          owner: p.owner ? { id: p.owner._id, name: p.owner.name, email: p.owner.email, role: p.owner.role } : null,
          memberCount: count,
          itemCount, interestCount,
          userRole: userMembership?.role || (p.owner?._id?.equals(req.user._id) ? 'owner' : 'member'),
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        };
      })
    );

    return res.json({ projects: projectList, drives: projectList });
  })
);

// GET /api/projects/:id - Get project details
router.get(
  '/:id',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id).populate('owner', 'name email role');
    const memberCount = await ProjectMember.countDocuments({ project: project._id });
    const itemCount = await DonationItem.countDocuments({ drive: project._id });
    const interestCount = await DonationInterest.countDocuments({ drive: project._id });
    const isOwner = project.owner._id.equals(req.user._id) || req.projectMember?.role === 'owner';

    return res.json({
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        category: project.category, targetRegion: project.targetRegion,
        goal: project.goal, coverImage: project.coverImage,
        isPublic: project.isPublic,
        owner: {
          id: project.owner._id,
          name: project.owner.name,
          email: project.owner.email,
          role: project.owner.role
        },
        memberCount,
        itemCount, interestCount,
        userRole: req.projectMember?.role || (isOwner ? 'owner' : 'member'),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    });
  })
);

// Donation-drive inventory and NGO interest workflow.
const itemValidation = [
  body('title').isString().trim().isLength({ min: 2, max: 120 }),
  body('category').isString().trim().isLength({ min: 1, max: 80 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('quantity').isInt({ min: 1, max: 100000 }),
  body('condition').isIn(['new', 'like-new', 'good', 'fair', 'used']),
  body('image').optional().isString().trim().isLength({ max: 500 }),
  handleValidation
];

router.get('/:id/items', authenticate, requireProjectMember, asyncHandler(async (req, res) => {
  const items = await DonationItem.find({ drive: req.project._id })
    .populate('uploader', 'name email role').sort({ createdAt: -1 }).lean();
  return res.json({ items, count: items.length });
}));

router.post('/:id/items', authenticate, requireProjectMember, itemUpload.single('image'), itemValidation, asyncHandler(async (req, res) => {
  const item = await DonationItem.create({
    drive: req.project._id, uploader: req.user._id,
    image: req.file ? req.file.filename : req.body.image,
    title: req.body.title, category: req.body.category,
    description: req.body.description || '', quantity: req.body.quantity,
    condition: req.body.condition
  });
  return res.status(201).json({ item });
}));

router.get('/:id/items/:itemId', authenticate, requireProjectMember, asyncHandler(async (req, res) => {
  const item = await DonationItem.findOne({ _id: req.params.itemId, drive: req.project._id })
    .populate('uploader', 'name email role').lean();
  if (!item) return res.status(404).json({ error: 'Donation item not found' });
  const interestCount = await DonationInterest.countDocuments({ item: item._id });
  return res.json({ item, interestCount });
}));

router.post(['/:id/items/:itemId/interest', '/:id/items/:itemId/request'], authenticate, requireRoles('ngo'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.itemId)) {
    return res.status(400).json({ error: 'Invalid drive or item ID format' });
  }
  const item = await DonationItem.findOne({ _id: req.params.itemId, drive: req.params.id });
  if (!item) return res.status(404).json({ error: 'Donation item not found' });
  try {
    const interest = await DonationInterest.create({
      drive: item.drive, item: item._id, ngo: req.user._id, message: req.body.message || ''
    });
    return res.status(201).json({ interest });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already expressed interest in this item' });
    throw error;
  }
}));

router.get('/:id/interests', authenticate, requireProjectMember, requireProjectOwner, asyncHandler(async (req, res) => {
  const interests = await DonationInterest.find({ drive: req.project._id })
    .populate('ngo', 'name email role').populate('item', 'title category quantity').sort({ createdAt: -1 }).lean();
  return res.json({ interests, count: interests.length });
}));

router.patch('/:id/interests/:interestId', authenticate, requireProjectMember, requireProjectOwner, [
  body('status').isIn(['pending', 'approved', 'rejected']), handleValidation
], asyncHandler(async (req, res) => {
  const interest = await DonationInterest.findOneAndUpdate(
    { _id: req.params.interestId, drive: req.project._id },
    { status: req.body.status }, { new: true, runValidators: true }
  ).populate('ngo', 'name email role').populate('item', 'title category quantity');
  if (!interest) return res.status(404).json({ error: 'Donation interest not found' });
  return res.json({ interest });
}));

// POST /api/projects/:id/members - Add member (Owner only)
router.post(
  '/:id/members',
  authenticate,
  requireProjectMember,
  requireProjectOwner,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('userId').optional().isString(),
    body('role').optional().isIn(['member', 'owner']),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    let targetUser = null;
    if (req.body.userId) {
      if (!mongoose.isValidObjectId(req.body.userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      targetUser = await User.findById(req.body.userId);
    } else if (req.body.email) {
      targetUser = await User.findOne({ email: req.body.email.toLowerCase(), isActive: true });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User to add was not found' });
    }

    // Check duplicate membership
    const existing = await ProjectMember.findOne({ project: req.project._id, user: targetUser._id });
    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    const member = new ProjectMember({
      project: req.project._id,
      user: targetUser._id,
      role: req.body.role === 'owner' ? 'owner' : 'member'
    });
    await member.save();

    return res.status(201).json({
      member: {
        id: member._id,
        user: targetUser.toSafeObject(),
        role: member.role,
        joinedAt: member.joinedAt
      }
    });
  })
);

// GET /api/projects/:id/members - List project members
router.get(
  '/:id/members',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    const members = await ProjectMember.find({ project: req.project._id })
      .populate('user', 'name email role')
      .sort({ joinedAt: 1 });

    const safeMembers = members
      .filter(m => m.user)
      .map(m => ({
        id: m._id,
        user: {
          id: m.user._id,
          name: m.user.name,
          email: m.user.email,
          role: m.user.role
        },
        role: m.role,
        joinedAt: m.joinedAt
      }));

    return res.json({ members: safeMembers });
  })
);

// DELETE /api/projects/:id/members/:userId - Remove member (Owner only)
router.delete(
  '/:id/members/:userId',
  authenticate,
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Cannot remove project owner
    if (req.project.owner.equals(userId)) {
      return res.status(400).json({ error: 'The project owner cannot be removed from the project' });
    }

    const deleted = await ProjectMember.findOneAndDelete({ project: req.project._id, user: userId });
    if (!deleted) {
      return res.status(404).json({ error: 'Member not found in this project' });
    }

    return res.json({ message: 'Member removed successfully' });
  })
);

// ==========================================
// 2. MARKDOWN NOTES ROUTES
// ==========================================

// POST /api/projects/:projectId/notes - Create a note
router.post(
  '/:projectId/notes',
  authenticate,
  requireProjectMember,
  [
    body('title').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Note title is required (max 200 chars)'),
    body('content').optional().isString().isLength({ max: 50000 }).withMessage('Note content exceeds 50,000 characters limit'),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const note = new Note({
      project: req.project._id,
      title: req.body.title,
      content: req.body.content || '',
      createdBy: req.user._id
    });
    await note.save();

    return res.status(201).json({
      note: {
        id: note._id,
        project: note.project,
        title: note.title,
        content: note.content,
        createdBy: req.user.toSafeObject(),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      }
    });
  })
);

// GET /api/projects/:projectId/notes - List notes for project
router.get(
  '/:projectId/notes',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    const notes = await Note.find({ project: req.project._id })
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    const safeNotes = notes.map(n => ({
      id: n._id,
      project: n.project,
      title: n.title,
      content: n.content,
      createdBy: n.createdBy ? { id: n.createdBy._id, name: n.createdBy.name, email: n.createdBy.email } : null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    }));

    return res.json({ notes: safeNotes });
  })
);

// GET /api/projects/:projectId/notes/:noteId - Get single note
router.get(
  '/:projectId/notes/:noteId',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.noteId)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }

    const note = await Note.findOne({ _id: req.params.noteId, project: req.project._id }).populate('createdBy', 'name email');
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.json({
      note: {
        id: note._id,
        project: note.project,
        title: note.title,
        content: note.content,
        createdBy: note.createdBy ? { id: note.createdBy._id, name: note.createdBy.name, email: note.createdBy.email } : null,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      }
    });
  })
);

// PUT /api/projects/:projectId/notes/:noteId - Update note
router.put(
  '/:projectId/notes/:noteId',
  authenticate,
  requireProjectMember,
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('content').optional().isString().isLength({ max: 50000 }),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.noteId)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }

    const note = await Note.findOne({ _id: req.params.noteId, project: req.project._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (req.body.title !== undefined) note.title = req.body.title;
    if (req.body.content !== undefined) note.content = req.body.content;

    await note.save();

    return res.json({
      note: {
        id: note._id,
        project: note.project,
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt
      }
    });
  })
);

// DELETE /api/projects/:projectId/notes/:noteId - Delete note
router.delete(
  '/:projectId/notes/:noteId',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.noteId)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }

    const note = await Note.findOne({ _id: req.params.noteId, project: req.project._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Must be note creator, project owner, or admin
    const canDelete = note.createdBy.equals(req.user._id) || req.projectMember?.role === 'owner' || req.user.role === 'admin';
    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied: You can only delete your own notes or if you are the project owner' });
    }

    await Note.findByIdAndDelete(note._id);
    return res.json({ message: 'Note deleted successfully' });
  })
);

// ==========================================
// 3. FILE UPLOAD & PREVIEW ROUTES
// ==========================================

// POST /api/projects/:projectId/files - Upload file
router.post(
  '/:projectId/files',
  authenticate,
  requireProjectMember,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size limit exceeded (maximum 10 MB allowed)' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for upload' });
    }

    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (note.length > 2000) {
      await removeProjectFile(req.file.path);
      return res.status(400).json({ error: 'File note cannot exceed 2,000 characters' });
    }

    const projectFile = new ProjectFile({
      project: req.project._id,
      uploadedBy: req.user._id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      storagePath: req.file.path,
      note
    });

    try {
      await projectFile.save();
    } catch (error) {
      await removeProjectFile(req.file.path);
      throw error;
    }

    return res.status(201).json({
      file: {
        id: projectFile._id,
        project: projectFile.project,
        originalName: projectFile.originalName,
        filename: projectFile.filename,
        mimeType: projectFile.mimeType,
        size: projectFile.size,
        note: projectFile.note,
        uploadedBy: req.user.toSafeObject(),
        createdAt: projectFile.createdAt
      }
    });
  })
);

// GET /api/projects/:projectId/files - List files for project
router.get(
  '/:projectId/files',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    const files = await ProjectFile.find({ project: req.project._id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    const safeFiles = files.map(f => ({
      id: f._id,
      project: f.project,
      originalName: f.originalName,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
      note: f.note,
      uploadedBy: f.uploadedBy ? { id: f.uploadedBy._id, name: f.uploadedBy.name, email: f.uploadedBy.email } : null,
      createdAt: f.createdAt
    }));

    return res.json({ files: safeFiles });
  })
);

// GET /api/projects/:projectId/files/:fileId - Get file metadata & text preview content
router.get(
  '/:projectId/files/:fileId',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await ProjectFile.findOne({ _id: req.params.fileId, project: req.project._id }).populate('uploadedBy', 'name email');
    if (!file) {
      return res.status(404).json({ error: 'Project file not found' });
    }

    // Check if file is readable text/code for inline preview
    const ext = path.extname(file.originalName).toLowerCase();
    const isTextCode = allowedExtensions.has(ext) && !['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'].includes(ext);

    let content = null;
    if (isTextCode && fs.existsSync(file.storagePath)) {
      try {
        const stats = fs.statSync(file.storagePath);
        if (stats.size <= 500 * 1024) { // Read up to 500KB for preview
          content = fs.readFileSync(file.storagePath, 'utf8');
        } else {
          content = '(File is larger than 500 KB; download to view full content)';
        }
      } catch (err) {
        content = null;
      }
    }

    return res.json({
      file: {
        id: file._id,
        project: file.project,
        originalName: file.originalName,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        note: file.note,
        content,
        isTextCode,
        uploadedBy: file.uploadedBy ? { id: file.uploadedBy._id, name: file.uploadedBy.name, email: file.uploadedBy.email } : null,
        createdAt: file.createdAt
      }
    });
  })
);

// GET /api/projects/:projectId/files/:fileId/download - Download / stream file safely
router.get(
  '/:projectId/files/:fileId/download',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await ProjectFile.findOne({ _id: req.params.fileId, project: req.project._id });
    if (!file || !fs.existsSync(file.storagePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set safe non-executable content headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");

    // For images and PDFs, allow inline viewing
    const ext = path.extname(file.originalName).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'].includes(ext)) {
      res.setHeader('Content-Type', file.mimeType);
      return res.sendFile(path.resolve(file.storagePath));
    }

    return res.download(path.resolve(file.storagePath), file.originalName);
  })
);

// DELETE /api/projects/:projectId/files/:fileId - Delete file
router.delete(
  '/:projectId/files/:fileId',
  authenticate,
  requireProjectMember,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const file = await ProjectFile.findOne({ _id: req.params.fileId, project: req.project._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Must be uploader, owner, or admin
    const canDelete = file.uploadedBy.equals(req.user._id) || req.projectMember?.role === 'owner' || req.user.role === 'admin';
    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied: You can only delete files you uploaded or if you are project owner' });
    }

    // Remove from disk if it is inside the managed upload directory.
    await removeProjectFile(file.storagePath).catch(() => undefined);

    await ProjectFile.findByIdAndDelete(file._id);
    return res.json({ message: 'File deleted successfully' });
  })
);

module.exports = router;
