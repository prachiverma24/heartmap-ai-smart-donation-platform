const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { body } = require('express-validator');
const DonationDrive = require('../models/DonationDrive');
const DonationDriveMember = require('../models/DonationDriveMember');
const DonationDriveNote = require('../models/DonationDriveNote');
const DonationDriveFile = require('../models/DonationDriveFile');
const DonationItem = require('../models/DonationItem');
const DonationInterest = require('../models/DonationInterest');
const User = require('../models/User');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { upload: storeFile, remove: removeFile } = require('../services/cloudinary');

const router = express.Router();
const allowedFileTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])],
  ['application/pdf', new Set(['.pdf'])],
  ['text/markdown', new Set(['.md'])],
  ['text/plain', new Set(['.txt'])],
  ['application/json', new Set(['.json'])],
  ['text/css', new Set(['.css'])],
  ['text/html', new Set(['.html'])],
  ['text/javascript', new Set(['.js', '.jsx'])],
  ['application/javascript', new Set(['.js', '.jsx'])],
  ['application/typescript', new Set(['.ts', '.tsx'])],
  ['text/x-python', new Set(['.py'])],
  ['text/x-java-source', new Set(['.java'])],
  ['text/x-c', new Set(['.c', '.h'])],
  ['text/x-c++', new Set(['.cpp', '.hpp'])]
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const extensions = allowedFileTypes.get(file.mimetype);
    if (!extensions || !extensions.has(extension)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    callback(null, true);
  }
});
const receiveFile = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File size cannot exceed 10 MB' : 'Unsupported file type' });
  }
  return res.status(400).json({ error: 'Unsupported file type or invalid upload' });
});
const validId = (id) => mongoose.isValidObjectId(id);
const access = asyncHandler(async (req, res, next) => {
  const id = req.params.id || req.params.driveId;
  if (!validId(id)) return res.status(400).json({ error: 'Invalid drive ID format' });
  const drive = await DonationDrive.findById(id);
  if (!drive) return res.status(404).json({ error: 'Donation drive not found' });
  const member = await DonationDriveMember.findOne({ drive: id, user: req.user._id });
  if (!member && req.user.role !== 'admin') return res.status(403).json({ error: 'Access forbidden: You are not a member of this drive' });
  req.drive = drive; req.driveMember = member || { role: 'owner' }; next();
});
const owner = (req, res, next) => {
  if (req.user.role === 'admin' || req.drive.owner.equals(req.user._id) || req.driveMember.role === 'owner') return next();
  return res.status(403).json({ error: 'Permission denied: Only drive owners can perform this action' });
};
const summary = async (drive, userRole) => ({
  id: drive._id, name: drive.name, description: drive.description, category: drive.category,
  targetRegion: drive.targetRegion, goal: drive.goal, coverImage: drive.coverImage, status: drive.status,
  isPublic: drive.isPublic,
  owner: drive.owner, userRole, createdAt: drive.createdAt, updatedAt: drive.updatedAt,
  memberCount: await DonationDriveMember.countDocuments({ drive: drive._id }),
  itemCount: await DonationItem.countDocuments({ drive: drive._id }),
  interestCount: await DonationInterest.countDocuments({ drive: drive._id })
});

router.post('/', authenticate, [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('category').optional().isString().trim().isLength({ max: 80 }),
  body('targetRegion').optional().isString().trim().isLength({ max: 160 }),
  body('goal').optional().isFloat({ min: 0 }),
  body('isPublic').optional().isBoolean(),
  body('status').optional().isIn(['active', 'completed', 'archived']), handleValidation
], asyncHandler(async (req, res) => {
  const drive = await DonationDrive.create({ ...req.body, owner: req.user._id });
  await DonationDriveMember.create({ drive: drive._id, user: req.user._id, role: 'owner' });
  return res.status(201).json({ drive: await summary(drive, 'owner') });
}));

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const memberships = await DonationDriveMember.find({ user: req.user._id }).select('drive role');
  const drives = await DonationDrive.find({ _id: { $in: memberships.map((m) => m.drive) } }).populate('owner', 'name email role').sort({ createdAt: -1 });
  return res.json({ drives: await Promise.all(drives.map((d) => summary(d, memberships.find((m) => m.drive.equals(d._id))?.role))) });
}));
router.get('/:id', authenticate, access, asyncHandler(async (req, res) => res.json({ drive: await summary(await req.drive.populate('owner', 'name email role'), req.driveMember.role) })));
router.put('/:id', authenticate, access, owner, asyncHandler(async (req, res) => {
  ['name', 'description', 'category', 'targetRegion', 'goal', 'coverImage', 'isPublic', 'status'].forEach((key) => { if (req.body[key] !== undefined) req.drive[key] = req.body[key]; });
  await req.drive.save(); return res.json({ drive: await summary(req.drive, req.driveMember.role) });
}));
router.patch('/:id', authenticate, access, owner, asyncHandler(async (req, res) => {
  ['name', 'description', 'category', 'targetRegion', 'goal', 'coverImage', 'isPublic', 'status'].forEach((key) => { if (req.body[key] !== undefined) req.drive[key] = req.body[key]; });
  await req.drive.save(); return res.json({ drive: await summary(req.drive, req.driveMember.role) });
}));
router.delete('/:id', authenticate, access, owner, asyncHandler(async (req, res) => {
  const files = await DonationDriveFile.find({ drive: req.drive._id }).select('publicId resourceType');
  await Promise.all(files.map((file) => removeFile(file.publicId, file.resourceType || 'image')));
  await Promise.all([DonationDriveMember.deleteMany({ drive: req.drive._id }), DonationDriveNote.deleteMany({ drive: req.drive._id }), DonationDriveFile.deleteMany({ drive: req.drive._id }), DonationItem.deleteMany({ drive: req.drive._id }), DonationInterest.deleteMany({ drive: req.drive._id }), DonationDrive.deleteOne({ _id: req.drive._id })]);
  res.status(204).send();
}));

router.post('/:id/members', authenticate, access, owner, asyncHandler(async (req, res) => {
  const target = req.body.userId ? await User.findById(req.body.userId) : await User.findOne({ email: String(req.body.email || '').toLowerCase(), isActive: true });
  if (!target) return res.status(404).json({ error: 'User to add was not found' });
  try {
    const member = await DonationDriveMember.create({ drive: req.drive._id, user: target._id, role: req.body.role === 'owner' ? 'owner' : 'member' });
    return res.status(201).json({ member: { id: member._id, user: target.toSafeObject(), role: member.role, joinedAt: member.joinedAt } });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'User is already a member of this drive' }); throw error; }
}));
router.get('/:id/members', authenticate, access, asyncHandler(async (req, res) => {
  const members = await DonationDriveMember.find({ drive: req.drive._id }).populate('user', 'name email role').sort({ joinedAt: 1 });
  res.json({ members: members.filter((m) => m.user).map((m) => ({ id: m._id, user: { id: m.user._id, name: m.user.name, email: m.user.email, role: m.user.role }, role: m.role, joinedAt: m.joinedAt })) });
}));
router.delete('/:id/members/:userId', authenticate, access, owner, asyncHandler(async (req, res) => {
  if (req.drive.owner.equals(req.params.userId)) return res.status(400).json({ error: 'The drive owner cannot be removed' });
  const deleted = await DonationDriveMember.findOneAndDelete({ drive: req.drive._id, user: req.params.userId });
  if (!deleted) return res.status(404).json({ error: 'Member not found in this drive' });
  res.json({ message: 'Member removed successfully' });
}));

router.post('/:id/notes', authenticate, access, [body('title').isString().trim().isLength({ min: 1, max: 200 }), body('content').optional().isString().isLength({ max: 50000 }), handleValidation], asyncHandler(async (req, res) => {
  const note = await DonationDriveNote.create({ drive: req.drive._id, title: req.body.title, content: req.body.content || '', createdBy: req.user._id });
  res.status(201).json({ note });
}));
router.get('/:id/notes', authenticate, access, asyncHandler(async (req, res) => res.json({ notes: await DonationDriveNote.find({ drive: req.drive._id }).populate('createdBy', 'name email').sort({ updatedAt: -1 }) })));
router.put('/:id/notes/:noteId', authenticate, access, asyncHandler(async (req, res) => {
  const note = await DonationDriveNote.findOne({ _id: req.params.noteId, drive: req.drive._id }); if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!note.createdBy.equals(req.user._id) && req.user.role !== 'admin' && req.driveMember.role !== 'owner') return res.status(403).json({ error: 'Permission denied' });
  ['title', 'content'].forEach((k) => { if (req.body[k] !== undefined) note[k] = req.body[k]; }); await note.save(); res.json({ note });
}));
router.delete('/:id/notes/:noteId', authenticate, access, asyncHandler(async (req, res) => {
  const note = await DonationDriveNote.findOne({ _id: req.params.noteId, drive: req.drive._id }); if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!note.createdBy.equals(req.user._id) && req.user.role !== 'admin' && req.driveMember.role !== 'owner') return res.status(403).json({ error: 'Permission denied' });
  await note.deleteOne(); res.status(204).send();
}));

router.post('/:id/files', authenticate, access, receiveFile, asyncHandler(async (req, res) => {
 if (!req.file) return res.status(400).json({ error: 'A supported file up to 10 MB is required' });
 const originalName = path.basename(req.file.originalname || 'uploaded-file').replace(/[^\w.\- ()]/g, '_');
 const extension = path.extname(originalName).toLowerCase();
 const folder = `heartmap/donation-drives/${req.drive._id}`;
 let stored;
 try {
   stored = await storeFile({ ...req.file, originalname: originalName }, folder);
   const file = await DonationDriveFile.create({
     drive: req.drive._id,
     uploadedBy: req.user._id,
     originalName,
     filename: `${req.drive._id}-${Date.now()}${extension}`,
     mimeType: req.file.mimetype,
     size: req.file.size,
     ...stored,
     note: String(req.body.note || '').trim()
   });
   return res.status(201).json({ file: await file.populate('uploadedBy', 'name email') });
 } catch (error) {
   if (stored?.publicId) await removeFile(stored.publicId).catch(() => undefined);
   const message = error instanceof multer.MulterError
     ? 'Unsupported file type or file size exceeds 10 MB'
     : 'File upload failed. Please try again.';
   if (error instanceof multer.MulterError) return res.status(400).json({ error: message });
   return res.status(502).json({ error: 'Cloudinary upload failed. Check the file configuration and try again.' });
 }
}));
router.get('/:id/files', authenticate, access, asyncHandler(async (req, res) => res.json({ files: await DonationDriveFile.find({ drive: req.drive._id }).populate('uploadedBy', 'name email').sort({ createdAt: -1 }) })));
router.get('/:id/files/:fileId', authenticate, access, asyncHandler(async (req, res) => {
 if (!validId(req.params.fileId)) return res.status(400).json({ error: 'Invalid file ID' });
 const file = await DonationDriveFile.findOne({ _id: req.params.fileId, drive: req.drive._id }).populate('uploadedBy', 'name email');
 if (!file) return res.status(404).json({ error: 'File not found' });
 const extension = path.extname(file.originalName).toLowerCase();
 const isTextCode = ['.md', '.txt', '.json', '.css', '.html', '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp'].includes(extension);
 let content = null;
 if (isTextCode && file.secureUrl) {
   try {
     const response = await fetch(file.secureUrl);
     if (response.ok) content = (await response.text()).slice(0, 500 * 1024);
   } catch (error) {
     content = null;
   }
 }
 res.json({ file: { ...file.toObject(), content, isTextCode } });
}));
router.patch('/:id/files/:fileId/public', authenticate, access, owner, asyncHandler(async (req, res) => {
 if (!validId(req.params.fileId)) return res.status(400).json({ error: 'Invalid file ID' });
 const file = await DonationDriveFile.findOneAndUpdate(
   { _id: req.params.fileId, drive: req.drive._id },
   { isPublic: Boolean(req.body.isPublic) },
   { new: true }
 ).populate('uploadedBy', 'name email');
 if (!file) return res.status(404).json({ error: 'File not found' });
 res.json({ file });
}));
router.delete('/:id/files/:fileId', authenticate, access, asyncHandler(async (req, res) => {
 if (!validId(req.params.fileId)) return res.status(400).json({ error: 'Invalid file ID' });
 const file = await DonationDriveFile.findOne({ _id: req.params.fileId, drive: req.drive._id });
 if (!file) return res.status(404).json({ error: 'File not found' });
 if (!file.uploadedBy.equals(req.user._id) && req.user.role !== 'admin' && req.driveMember.role !== 'owner') return res.status(403).json({ error: 'Permission denied' });
 try {
   await removeFile(file.publicId, file.resourceType || 'image');
   await file.deleteOne();
   res.json({ message: 'File deleted successfully' });
 } catch (error) {
   return res.status(502).json({ error: 'File provider could not delete the file. Please try again.' });
 }
}));

router.get('/:id/items', authenticate, access, asyncHandler(async (req, res) => {
  res.json({ items: await DonationItem.find({ drive: req.drive._id }).populate('uploader', 'name email').sort({ createdAt: -1 }) });
}));
router.post('/:id/items', authenticate, access, [
  body('title').isString().trim().isLength({ min: 2, max: 120 }),
  body('category').isString().trim().isLength({ min: 1, max: 80 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('quantity').isInt({ min: 1, max: 100000 }),
  body('condition').isIn(['new', 'like-new', 'good', 'fair', 'used']), handleValidation
], asyncHandler(async (req, res) => {
  const item = await DonationItem.create({ ...req.body, drive: req.drive._id, uploader: req.user._id });
  res.status(201).json({ item });
}));

router.post('/:id/items/:itemId/interest', authenticate, requireRoles('ngo'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.itemId)) return res.status(400).json({ error: 'Invalid drive or item ID format' });
  const item = await DonationItem.findOne({ _id: req.params.itemId, drive: req.params.id });
  if (!item) return res.status(404).json({ error: 'Donation item not found' });
  try {
    const interest = await DonationInterest.create({
      drive: item.drive, item: item._id, ngo: req.user._id, message: String(req.body.message || '')
    });
    return res.status(201).json({ interest });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already expressed interest in this item' });
    throw error;
  }
}));

router.get('/:id/interests', authenticate, access, owner, asyncHandler(async (req, res) => {
  const interests = await DonationInterest.find({ drive: req.drive._id })
    .populate('ngo', 'name email role').populate('item', 'title category quantity').sort({ createdAt: -1 }).lean();
  res.json({ interests, count: interests.length });
}));

router.patch('/:id/interests/:interestId', authenticate, access, owner, [
  body('status').isIn(['pending', 'approved', 'rejected']), handleValidation
], asyncHandler(async (req, res) => {
  const interest = await DonationInterest.findOneAndUpdate(
    { _id: req.params.interestId, drive: req.drive._id },
    { status: req.body.status }, { new: true, runValidators: true }
  ).populate('ngo', 'name email role').populate('item', 'title category quantity');
  if (!interest) return res.status(404).json({ error: 'Donation interest not found' });
  res.json({ interest });
}));

router.get('/:id/analytics', authenticate, access, asyncHandler(async (req, res) => {
  const drive = req.drive._id;
  const [items, interests, members, files, notes, recentItems, recentInterests, recentFiles, recentNotes] = await Promise.all([
    DonationItem.aggregate([
      { $match: { drive } },
      { $group: { _id: '$category', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      { $sort: { quantity: -1, _id: 1 } }
    ]),
    DonationInterest.aggregate([
      { $match: { drive } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    DonationDriveMember.aggregate([
      { $match: { drive } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    DonationDriveFile.aggregate([
      { $match: { drive } },
      { $group: { _id: '$mimeType', count: { $sum: 1 }, bytes: { $sum: '$size' } } },
      { $sort: { count: -1, _id: 1 } }
    ]),
    DonationDriveNote.countDocuments({ drive }),
    DonationItem.find({ drive }).select('title category quantity condition createdAt uploader').populate('uploader', 'name').sort({ createdAt: -1 }).limit(5).lean(),
    DonationInterest.find({ drive }).select('status item ngo createdAt').populate('item', 'title').populate('ngo', 'name').sort({ createdAt: -1 }).limit(5).lean(),
    DonationDriveFile.find({ drive }).select('originalName mimeType size createdAt uploadedBy').populate('uploadedBy', 'name').sort({ createdAt: -1 }).limit(5).lean(),
    DonationDriveNote.find({ drive }).select('title createdAt createdBy').populate('createdBy', 'name').sort({ createdAt: -1 }).limit(5).lean()
  ]);

  const [itemSummary, interestSummary, memberCount, fileCount] = await Promise.all([
    DonationItem.aggregate([{ $match: { drive } }, { $group: { _id: null, total: { $sum: 1 }, quantity: { $sum: '$quantity' } } }]),
    DonationInterest.aggregate([{ $match: { drive } }, { $group: { _id: null, total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } } } }]),
    DonationDriveMember.countDocuments({ drive }),
    DonationDriveFile.countDocuments({ drive })
  ]);
  const memberContributions = await DonationDriveMember.aggregate([
    { $match: { drive } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'donationdrivenotes', let: { memberId: '$user._id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$drive', drive] }, { $eq: ['$createdBy', '$$memberId'] }] } } }, { $count: 'count' }], as: 'notes' } },
    { $lookup: { from: 'donationdrivefiles', let: { memberId: '$user._id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$drive', drive] }, { $eq: ['$uploadedBy', '$$memberId'] }] } } }, { $count: 'count' }], as: 'files' } },
    { $project: { _id: 0, memberId: '$user._id', memberName: { $ifNull: ['$user.name', 'Unknown member'] }, notes: { $ifNull: [{ $arrayElemAt: ['$notes.count', 0] }, 0] }, files: { $ifNull: [{ $arrayElemAt: ['$files.count', 0] }, 0] } } }
  ]);
  memberContributions.forEach((member) => { member.totalContributions = member.notes + member.files; });

  const activityMap = new Map();
  const addActivity = (date, type, count = 1) => {
    if (!date) return;
    const day = new Date(date).toISOString().slice(0, 10);
    const current = activityMap.get(day) || { date: day, total: 0, items: 0, files: 0, notes: 0, interests: 0, members: 0 };
    current[type] += count;
    current.total += count;
    activityMap.set(day, current);
  };
  const activitySources = await Promise.all([
    DonationItem.find({ drive }).select('createdAt').lean(),
    DonationDriveFile.find({ drive }).select('createdAt').lean(),
    DonationDriveNote.find({ drive }).select('createdAt').lean(),
    DonationInterest.find({ drive }).select('createdAt').lean(),
    DonationDriveMember.find({ drive }).select('joinedAt').lean()
  ]);
  activitySources[0].forEach((row) => addActivity(row.createdAt, 'items'));
  activitySources[1].forEach((row) => addActivity(row.createdAt, 'files'));
  activitySources[2].forEach((row) => addActivity(row.createdAt, 'notes'));
  activitySources[3].forEach((row) => addActivity(row.createdAt, 'interests'));
  activitySources[4].forEach((row) => addActivity(row.joinedAt, 'members'));

  const itemTotals = itemSummary[0] || { total: 0, quantity: 0 };
  const interestTotals = interestSummary[0] || { total: 0, pending: 0, accepted: 0, rejected: 0 };
  const totalContributions = notes + fileCount;
  res.json({
    analytics: {
      summary: {
        totalItems: itemTotals.total,
        totalQuantity: itemTotals.quantity,
        totalFiles: fileCount,
        totalNotes: notes,
        totalMembers: memberCount,
        totalContributions,
        totalNGOInterests: interestTotals.total
      },
      items: {
        total: itemTotals.total,
        totalQuantity: itemTotals.quantity,
        byCategory: items,
        byCondition: await DonationItem.aggregate([{ $match: { drive } }, { $group: { _id: '$condition', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } }, { $sort: { count: -1, _id: 1 } }]),
        recentItems
      },
      interests: {
        total: interestTotals.total,
        pending: interestTotals.pending,
        accepted: interestTotals.accepted,
        rejected: interestTotals.rejected,
        byStatus: interests,
        recentInterests
      },
      files: { total: fileCount, byMimeType: files, recentUploads: recentFiles },
      notes: { total: notes, recentNotes },
      members: { total: memberCount, byRole: members, contributions: memberContributions },
      contributionProgress: {
        totalItems: itemTotals.total,
        totalQuantity: itemTotals.quantity,
        totalNGOInterests: interestTotals.total,
        acceptedInterests: interestTotals.accepted,
        pendingInterests: interestTotals.pending
      },
      activity: Array.from(activityMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      recentActivity: [
        ...recentItems.map((item) => ({ type: 'item', date: item.createdAt, label: item.title })),
        ...recentFiles.map((file) => ({ type: 'file', date: file.createdAt, label: file.originalName })),
        ...recentNotes.map((note) => ({ type: 'note', date: note.createdAt, label: note.title })),
        ...recentInterests.map((interest) => ({ type: 'interest', date: interest.createdAt, label: interest.item?.title || 'NGO interest' }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
      totalItems: itemTotals.total,
      totalQuantity: itemTotals.quantity,
      totalInterests: interestTotals.total,
      itemsByCategory: items,
      interestsByStatus: interests,
      memberCount
    }
  });
}));

module.exports = router;
