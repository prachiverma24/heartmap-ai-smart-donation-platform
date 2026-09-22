const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { cookieName } = require('../utils/auth');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const NGOProfile = require('../models/NGOProfile');
const ProjectFile = require('../models/ProjectFile');
const Note = require('../models/Note');
const ProjectMember = require('../models/ProjectMember');
const Project = require('../models/Project');
const DonationDrive = require('../models/DonationDrive');
const DonationDriveMember = require('../models/DonationDriveMember');
const DonationItem = require('../models/DonationItem');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { extractDonationIntent, chatWithHeartMapAI, extractSearchIntent, generateContent, summarizeNGO, analyzeFeedback, processAssistantQuery, explainContent, improveMarkdown, generateReadme } = require('../services/ai');

const router = express.Router();
const assistantLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const chatLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const searchLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const generateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const summarizeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const feedbackLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

const getOptionalUser = async (req) => {
  let token = req.cookies?.[cookieName];
  if (!token && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) return user;
  } catch (err) {}
  return null;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * FEATURE 19.1: HEARTMAP AI CHATBOT
 * POST /api/ai/chat
 * Answers general HeartMap-related questions adhering strictly to HeartMap context.
 */
router.post('/chat', chatLimit, asyncHandler(async (req, res) => {
  const { message } = req.body || {};

  // Reject missing, non-string, or empty/whitespace input
  if (message === undefined || message === null || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const trimmed = message.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ success: false, error: 'Message cannot exceed 2000 characters' });
  }

  try {
    const reply = await chatWithHeartMapAI(trimmed);
    return res.status(200).json({ success: true, reply });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI service temporarily unavailable. Please try again later.'
    });
  }
}));

/**
 * FEATURE 19.2: AI-POWERED NGO RECOMMENDATIONS
 * POST /api/ai/recommendations
 * POST /api/ai/match
 * POST /api/ai/donation-assistant (backwards compatible)
 */
const handleDonationRecommendations = asyncHandler(async (req, res) => {
  let interpretation;
  try {
    interpretation = await extractDonationIntent(req.body.message);
  } catch (error) {
    if (req.path === '/donation-assistant') {
      error.statusCode = error.statusCode || 502;
      throw error;
    }
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI service temporarily unavailable. Please try again later.'
    });
  }

  if (interpretation.intent !== 'donate' && interpretation.intent !== 'unknown') {
    return res.json({
      success: true,
      intent: interpretation,
      interpretation,
      recommendations: [],
      matches: [],
      message: 'No verified NGOs matching your donation requirements were found.'
    });
  }

  const filter = { isPublished: true, verificationStatus: 'verified' };

  if (interpretation.location) {
    const locRegex = new RegExp(escapeRegex(interpretation.location), 'i');
    filter.$or = [
      { city: locRegex },
      { state: locRegex },
      { address: locRegex },
      { pickupAreas: locRegex }
    ];
  }

  if (interpretation.category) {
    const categoryOrConditions = [
      { acceptedDonationTypes: new RegExp(`^${escapeRegex(interpretation.category)}$`, 'i') },
      { category: new RegExp(`^${escapeRegex(interpretation.category)}$`, 'i') }
    ];

    if (interpretation.location) {
      categoryOrConditions.push(
        { acceptedDonationTypes: /Disaster Relief|Relief/i },
        { category: /Disaster Relief|Relief/i }
      );
      filter.$and = [
        { $or: filter.$or },
        { $or: categoryOrConditions }
      ];
      delete filter.$or;
    } else {
      filter.$or = categoryOrConditions;
    }
  }

  let ngos = await NGOProfile.find(filter).select('-documents -createdBy -user').lean();

  const matches = ngos
    .filter((ngo) => {
      if (!ngo.notAcceptedDonationTypes || !ngo.notAcceptedDonationTypes.length) return true;
      const notAccepted = ngo.notAcceptedDonationTypes.map((t) => t.toLowerCase());
      if (interpretation.category && notAccepted.includes(interpretation.category.toLowerCase())) return false;
      return !(interpretation.items || []).some((item) => notAccepted.some((na) => item.toLowerCase().includes(na) || na.includes(item.toLowerCase())));
    })
    .map((ngo) => {
      const urgentMatches = (ngo.urgentlyNeededItems || []).filter((item) => {
        if (!item) return false;
        const itemLower = item.toLowerCase();
        return (interpretation.items || []).some((it) => itemLower.includes(it.toLowerCase()) || it.toLowerCase().includes(itemLower)) ||
               req.body.message.toLowerCase().includes(itemLower);
      });
      const urgent = urgentMatches.length > 0;

      const matchReasons = [];
      const acceptsCategory = interpretation.category && (ngo.acceptedDonationTypes || []).some((t) => t.toLowerCase() === interpretation.category.toLowerCase());
      if (acceptsCategory) {
        matchReasons.push(`Accepts ${interpretation.category}`);
      } else if (ngo.category) {
        matchReasons.push(`Verified organization working in ${ngo.category}`);
      } else {
        matchReasons.push('Relevant verified NGO profile');
      }

      if (urgent) {
        matchReasons.push(`Verified urgent need: ${urgentMatches.join(', ')}`);
      }

      const isLocationMatch = Boolean(
        interpretation.location && (
          ngo.city?.toLowerCase().includes(interpretation.location.toLowerCase()) ||
          ngo.state?.toLowerCase().includes(interpretation.location.toLowerCase()) ||
          ngo.address?.toLowerCase().includes(interpretation.location.toLowerCase())
        )
      );

      if (isLocationMatch) {
        matchReasons.push(`Located in ${ngo.city || interpretation.location}${ngo.state ? ', ' + ngo.state : ''}`);
      }

      if (ngo.pickupAvailable) {
        matchReasons.push(interpretation.pickupRequested ? 'Doorstep pickup is verified as available' : 'Doorstep pickup available');
      } else if (ngo.dropOffAvailable) {
        matchReasons.push('Drop-off at center is available');
      }

      let score = 50;
      if (isLocationMatch) score += 30;
      if (acceptsCategory) score += 20;
      if (urgent) score += 25;
      if (interpretation.pickupRequested && ngo.pickupAvailable) score += 15;
      else if (ngo.dropOffAvailable) score += 5;

      let explanation;
      if (urgent) {
        explanation = `Verified NGO matching your donation for ${(interpretation.items || []).join(', ') || interpretation.category || 'useful items'}. Currently has verified urgent need for ${urgentMatches.join(', ')}.`;
      } else if (acceptsCategory) {
        explanation = `Verified NGO matching your donation for ${(interpretation.items || []).join(', ') || interpretation.category || 'useful items'}.`;
      } else if (isLocationMatch) {
        explanation = `Verified organization located in ${ngo.city || interpretation.location}. Recommended based on verified public records (${ngo.verificationSource || 'official portal'}). Contact ${ngo.contact || ngo.phone || 'the organization'} to confirm specific donation acceptance.`;
      } else {
        explanation = `Verified NGO profile: ${ngo.name || ngo.organizationName}.`;
      }

      return {
        ngo: {
          id: ngo._id,
          _id: ngo._id,
          name: ngo.name || ngo.organizationName,
          organizationName: ngo.organizationName || ngo.name,
          description: ngo.description || '',
          category: ngo.category || '',
          city: ngo.city || '',
          state: ngo.state || '',
          address: ngo.address || '',
          acceptedDonationTypes: ngo.acceptedDonationTypes || [],
          urgentlyNeededItems: ngo.urgentlyNeededItems || [],
          requirements: ngo.requirements || [],
          pickupAvailable: Boolean(ngo.pickupAvailable),
          dropOffAvailable: Boolean(ngo.dropOffAvailable),
          pickupAreas: ngo.pickupAreas || [],
          phone: ngo.phone || '',
          email: ngo.email || '',
          website: ngo.website || '',
          officialWebsite: ngo.officialWebsite || ngo.website || null,
          officialDonationUrl: ngo.officialDonationUrl || '',
          contact: ngo.contact || ngo.phone || null,
          registrationNumber: ngo.registrationNumber || null,
          sourceUrl: ngo.sourceUrl || null,
          verificationSource: ngo.verificationSource || null,
          lastVerifiedAt: ngo.lastVerifiedAt || null,
          verificationStatus: ngo.verificationStatus || 'verified',
          latitude: ngo.latitude ?? null,
          longitude: ngo.longitude ?? null
        },
        matchReasons,
        reasons: matchReasons,
        urgent,
        score,
        distanceKm: null,
        explanation
      };
    })
    .sort((a, b) => b.score - a.score);

  return res.json({
    success: true,
    intent: interpretation,
    interpretation,
    recommendations: matches,
    matches,
    message: matches.length
      ? 'These results come from verified NGO profiles in HeartMap.'
      : 'No verified NGO profiles matched this request.'
  });
});

router.post(
  '/recommendations',
  authenticate,
  requireRoles('user', 'ngo', 'admin'),
  assistantLimit,
  [body('message').isString().trim().isLength({ min: 8, max: 2000 }), handleValidation],
  handleDonationRecommendations
);

router.post(
  '/match',
  authenticate,
  requireRoles('user', 'ngo', 'admin'),
  assistantLimit,
  [body('message').isString().trim().isLength({ min: 8, max: 2000 }), handleValidation],
  handleDonationRecommendations
);

router.post(
  '/donation-assistant',
  authenticate,
  requireRoles('user', 'ngo', 'admin'),
  assistantLimit,
  [body('message').isString().trim().isLength({ min: 8, max: 2000 }), handleValidation],
  handleDonationRecommendations
);

/**
 * FEATURE 3: AI-POWERED NGO SEARCH
 * POST /api/ai/search
 * Natural-language search for verified NGOs.
 * Extracts structured search intent, queries MongoDB for verified and published NGOs,
 * and returns matched NGO records with grounded explanations.
 */
router.post('/search', searchLimit, asyncHandler(async (req, res) => {
  const { query } = req.body || {};

  // Reject missing, non-string, or empty/whitespace input
  if (query === undefined || query === null || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, error: 'Search query is required' });
  }

  const trimmed = query.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ success: false, error: 'Search query cannot exceed 2000 characters' });
  }

  let intent;
  try {
    intent = await extractSearchIntent(trimmed);
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI service temporarily unavailable. Please try again later.'
    });
  }

  const conditions = [
    { isPublished: true },
    { verificationStatus: 'verified' }
  ];

  if (intent.location) {
    const locRegex = new RegExp(escapeRegex(intent.location), 'i');
    conditions.push({
      $or: [
        { city: locRegex },
        { state: locRegex },
        { address: locRegex },
        { pickupAreas: locRegex }
      ]
    });
  }

  const topicConditions = [];
  const targetTerms = [];
  if (intent.donationType) targetTerms.push(intent.donationType);
  if (intent.category && !targetTerms.includes(intent.category)) targetTerms.push(intent.category);
  if (intent.item && !targetTerms.includes(intent.item)) targetTerms.push(intent.item);
  (intent.keywords || []).forEach((kw) => {
    if (!targetTerms.some((t) => t.toLowerCase() === kw.toLowerCase())) {
      targetTerms.push(kw);
    }
  });

  targetTerms.forEach((term) => {
    const termRegex = new RegExp(escapeRegex(term), 'i');
    topicConditions.push(
      { acceptedDonationTypes: termRegex },
      { category: termRegex },
      { organizationName: termRegex },
      { name: termRegex },
      { description: termRegex }
    );
  });

  if (intent.location && (intent.category === 'Clothes' || intent.donationType === 'Blankets' || intent.item === 'blankets' || intent.item === 'clothes')) {
    topicConditions.push(
      { acceptedDonationTypes: /Disaster Relief|Relief/i },
      { category: /Disaster Relief|Relief/i }
    );
  }

  if (topicConditions.length > 0) {
    conditions.push({ $or: topicConditions });
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  let ngos = await NGOProfile.find(filter).select('-documents -createdBy -user').lean();

  // Exclude NGOs where user search item is explicitly not accepted
  const filteredNgos = ngos.filter((ngo) => {
    if (!ngo.notAcceptedDonationTypes || !ngo.notAcceptedDonationTypes.length) return true;
    const notAccepted = ngo.notAcceptedDonationTypes.map((t) => t.toLowerCase());
    if (intent.category && notAccepted.includes(intent.category.toLowerCase())) return false;
    if (intent.donationType && notAccepted.includes(intent.donationType.toLowerCase())) return false;
    if (intent.item && notAccepted.some((na) => intent.item.toLowerCase().includes(na) || na.includes(intent.item.toLowerCase()))) return false;
    return true;
  });

  const results = filteredNgos.map((ngo) => {
    const matchReasons = [];
    const isLocationMatch = Boolean(
      intent.location && (
        ngo.city?.toLowerCase().includes(intent.location.toLowerCase()) ||
        ngo.state?.toLowerCase().includes(intent.location.toLowerCase()) ||
        ngo.address?.toLowerCase().includes(intent.location.toLowerCase())
      )
    );
    if (isLocationMatch) {
      matchReasons.push(`Located in ${ngo.city || intent.location}${ngo.state ? ', ' + ngo.state : ''}`);
    }

    const acceptedTypes = ngo.acceptedDonationTypes || [];
    const matchedTypes = acceptedTypes.filter((t) =>
      targetTerms.some((term) => t.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(t.toLowerCase()))
    );
    if (matchedTypes.length > 0) {
      matchReasons.push(`Verified accepted donation type: ${matchedTypes.join(', ')}`);
    } else if (ngo.category) {
      matchReasons.push(`Verified organization working in ${ngo.category}`);
    } else {
      matchReasons.push('Relevant verified NGO profile');
    }

    if (intent.purpose && ngo.description && ngo.description.toLowerCase().includes(intent.purpose.toLowerCase())) {
      matchReasons.push(`Mission directly supports ${intent.purpose}`);
    }

    if (ngo.pickupAvailable) {
      matchReasons.push('Doorstep pickup is verified as available');
    } else if (ngo.dropOffAvailable) {
      matchReasons.push('Drop-off at center is available');
    }

    let score = 50;
    if (isLocationMatch) score += 30;
    if (matchedTypes.length > 0) score += 20;
    if (intent.purpose && ngo.description && ngo.description.toLowerCase().includes(intent.purpose.toLowerCase())) score += 15;
    if (ngo.dropOffAvailable) score += 5;

    let explanation = `Verified organization located in ${ngo.city || intent.location || 'India'}. `;
    if (matchedTypes.length > 0) {
      explanation += `Accepts ${matchedTypes.join(', ')}. `;
    } else if (ngo.category) {
      explanation += `Specializes in ${ngo.category}. `;
    }
    explanation += `Recommended based on verified public records (${ngo.verificationSource || 'official portal'}).`;

    return {
      ngo: {
        id: ngo._id,
        _id: ngo._id,
        name: ngo.name || ngo.organizationName,
        organizationName: ngo.organizationName || ngo.name,
        description: ngo.description || '',
        category: ngo.category || '',
        city: ngo.city || '',
        state: ngo.state || '',
        address: ngo.address || '',
        acceptedDonationTypes: ngo.acceptedDonationTypes || [],
        urgentlyNeededItems: ngo.urgentlyNeededItems || [],
        requirements: ngo.requirements || [],
        pickupAvailable: Boolean(ngo.pickupAvailable),
        dropOffAvailable: Boolean(ngo.dropOffAvailable),
        pickupAreas: ngo.pickupAreas || [],
        phone: ngo.phone || '',
        email: ngo.email || '',
        website: ngo.website || '',
        officialWebsite: ngo.officialWebsite || ngo.website || null,
        officialDonationUrl: ngo.officialDonationUrl || '',
        contact: ngo.contact || ngo.phone || null,
        registrationNumber: ngo.registrationNumber || null,
        sourceUrl: ngo.sourceUrl || null,
        verificationSource: ngo.verificationSource || null,
        lastVerifiedAt: ngo.lastVerifiedAt || null,
        verificationStatus: ngo.verificationStatus || 'verified',
        latitude: ngo.latitude ?? null,
        longitude: ngo.longitude ?? null
      },
      matchReasons,
      reasons: matchReasons,
      explanation,
      score
    };
  }).sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    return res.json({
      success: true,
      query: trimmed,
      intent,
      results: [],
      totalResults: 0,
      message: 'No verified NGOs matching your search were found.',
      suggestions: [
        'Try broadening your location (e.g. search by state instead of a specific locality).',
        'Try searching for broader donation categories (e.g. Clothes, Food, Books, Medical Aid).',
        'Check your spelling or try alternative keywords for the cause or purpose.'
      ]
    });
  }

  return res.json({
    success: true,
    query: trimmed,
    intent,
    results,
    totalResults: results.length,
    message: 'These results come from verified NGO profiles in HeartMap.'
  });
}));

/**
 * FEATURE 4: AI CONTENT GENERATION
 * POST /api/ai/generate-content
 * Turns user's rough input into a clear, professional Help Request description without inventing facts.
 */
router.post('/generate-content', generateLimit, asyncHandler(async (req, res) => {
  const { text, contentType } = req.body || {};

  if (!contentType || typeof contentType !== 'string' || contentType.trim() !== 'help_request') {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing contentType. Supported contentType is "help_request".'
    });
  }

  if (text === undefined || text === null || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Text is required and cannot be empty.'
    });
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Text must be at least 3 characters long.'
    });
  }

  if (trimmedText.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Text cannot exceed 2000 characters.'
    });
  }

  try {
    const generatedText = await generateContent({
      text: trimmedText,
      contentType: contentType.trim()
    });

    return res.status(200).json({
      success: true,
      contentType: contentType.trim(),
      generatedText
    });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI content generation service temporarily unavailable. Please try again later.'
    });
  }
}));

/**
 * FEATURE 5: AI-POWERED NGO SUMMARIZATION
 * POST /api/ai/summarize-ngo
 * Summarizes a verified, published NGO strictly using verified information stored in MongoDB.
 */
router.post('/summarize-ngo', summarizeLimit, asyncHandler(async (req, res) => {
  const { ngoId } = req.body || {};

  if (!ngoId || typeof ngoId !== 'string' || !mongoose.Types.ObjectId.isValid(ngoId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid ngoId is required.'
    });
  }

  const ngo = await NGOProfile.findById(ngoId);
  if (!ngo) {
    return res.status(404).json({
      success: false,
      error: 'NGO not found.'
    });
  }

  if (!ngo.isPublished || ngo.verificationStatus !== 'verified') {
    return res.status(400).json({
      success: false,
      error: 'Only verified and published NGOs can be summarized.'
    });
  }

  const safeData = {
    name: ngo.organizationName || ngo.name,
    city: ngo.city,
    state: ngo.state,
    category: ngo.category,
    description: ngo.description,
    acceptedDonationTypes: ngo.acceptedDonationTypes || [],
    urgentlyNeededItems: ngo.urgentlyNeededItems || [],
    pickupAvailable: Boolean(ngo.pickupAvailable),
    officialWebsite: ngo.officialWebsite || ngo.website || null,
    verificationStatus: ngo.verificationStatus,
    verificationSource: ngo.verificationSource || null
  };

  try {
    const summary = await summarizeNGO(safeData);
    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI NGO summarization service temporarily unavailable. Please try again later.'
    });
  }
}));

/**
 * FEATURE 6: AI-POWERED FEEDBACK ANALYSIS
 * POST /api/ai/analyze-feedback
 * Evaluates feedback to identify sentiment, positive themes, concerns, and suggestions.
 * Strictly grounded in user input; never makes fraud or legal determinations.
 */
router.post('/analyze-feedback', feedbackLimit, asyncHandler(async (req, res) => {
  const { feedback, feedbackId } = req.body || {};

  let textToAnalyze = '';

  if (feedbackId !== undefined && feedbackId !== null) {
    if (typeof feedbackId !== 'string' || !mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid feedbackId is required.'
      });
    }

    const record = await Feedback.findById(feedbackId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found.'
      });
    }

    const user = await getOptionalUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to analyze stored feedback.'
      });
    }

    const isOwner = record.user && (record.user._id ? record.user._id.equals(user._id) : record.user.equals(user._id));
    const isAdmin = user.role === 'admin';
    const ngo = await NGOProfile.findById(record.ngo);
    const isTargetNgo = ngo && ngo.user && ngo.user.equals(user._id);

    if (!isOwner && !isAdmin && !isTargetNgo) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to analyze this feedback.'
      });
    }

    textToAnalyze = record.feedback;
  } else if (feedback !== undefined && feedback !== null) {
    if (typeof feedback !== 'string' || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Feedback text is required and cannot be empty.'
      });
    }

    const trimmed = feedback.trim();
    if (trimmed.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Feedback must be at least 3 characters long.'
      });
    }

    if (trimmed.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Feedback cannot exceed 2000 characters.'
      });
    }

    textToAnalyze = trimmed;
  } else {
    return res.status(400).json({
      success: false,
      error: 'Either feedback text or feedbackId is required.'
    });
  }

  try {
    const analysis = await analyzeFeedback({ feedback: textToAnalyze });
    return res.status(200).json({
      success: true,
      analysis
    });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI feedback analysis service temporarily unavailable. Please try again later.'
    });
  }
}));

/**
 * FEATURE 7: AI ASSISTANT (HEARTMAP PHASE 8 FINAL AI FEATURE)
 * POST /api/ai/assistant
 * End-to-end guided workflow assistant for donations, help requests, NGO discovery, and verification.
 * Grounded in MongoDB data; never mutates the database; never processes payments.
 */
router.post('/assistant', assistantLimit, asyncHandler(async (req, res) => {
  const { message } = req.body || {};

  if (message === undefined || message === null || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message is required and cannot be empty.'
    });
  }

  const trimmed = message.trim();
  if (trimmed.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Message must be at least 2 characters long.'
    });
  }

  if (trimmed.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot exceed 2000 characters.'
    });
  }

  let assistantResult;
  try {
    assistantResult = await processAssistantQuery({ message: trimmed });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : 'AI Assistant service temporarily unavailable. Please try again later.'
    });
  }

  const { intent, item, category, location, quantity, missingInformation, nextAction } = assistantResult;
  let responseText = assistantResult.response;
  let results = [];

  // If intent is donate or find_ngo and location/category/item is specified without missing location
  if ((intent === 'donate' || intent === 'find_ngo') && nextAction !== 'ask_location' && (location || category || item)) {
    try {
      const filter = {
        isPublished: true,
        verificationStatus: 'verified'
      };

      if (location) {
        const locRegex = new RegExp(escapeRegex(location), 'i');
        filter.$or = [
          { city: locRegex },
          { state: locRegex },
          { address: locRegex },
          { pickupAreas: locRegex }
        ];
      }

      if (category || item) {
        const catSearch = category || item;
        const catRegex = new RegExp(escapeRegex(catSearch), 'i');
        const catCondition = [
          { acceptedDonationTypes: catRegex },
          { category: catRegex },
          { description: catRegex }
        ];

        if (filter.$or) {
          filter.$and = [
            { $or: filter.$or },
            { $or: catCondition }
          ];
          delete filter.$or;
        } else {
          filter.$or = catCondition;
        }
      }

      const matchingNgos = await NGOProfile.find(filter)
        .select('-documents -createdBy -user')
        .limit(6)
        .lean();

      if (matchingNgos.length > 0) {
        results = matchingNgos.map((ngo) => ({
          id: ngo._id,
          _id: ngo._id,
          name: ngo.name || ngo.organizationName,
          city: ngo.city,
          state: ngo.state,
          category: ngo.category,
          acceptedDonationTypes: ngo.acceptedDonationTypes || [],
          urgentlyNeededItems: ngo.urgentlyNeededItems || [],
          pickupAvailable: Boolean(ngo.pickupAvailable),
          dropOffAvailable: Boolean(ngo.dropOffAvailable),
          verificationStatus: ngo.verificationStatus,
          verificationSource: ngo.verificationSource || null,
          officialWebsite: ngo.officialWebsite || ngo.website || null,
          description: ngo.description || ''
        }));

        if (intent === 'donate' && location) {
          responseText = `Found ${results.length} verified organization${results.length > 1 ? 's' : ''} in ${location} matching your donation for ${item || category || 'items'}.`;
        } else if (intent === 'find_ngo' && location) {
          responseText = `Found ${results.length} verified organization${results.length > 1 ? 's' : ''} in ${location}.`;
        }
      } else {
        results = [];
        if (location) {
          responseText = `No matching verified NGO was found in ${location} in the current HeartMap database.`;
        } else {
          responseText = 'No matching verified NGO was found in the current HeartMap database.';
        }
      }
    } catch (dbError) {
      return res.status(500).json({
        success: false,
        error: 'Unable to retrieve NGO records right now. Please try again later.'
      });
    }
  }

  return res.status(200).json({
    success: true,
    response: responseText,
    intent,
    entities: {
      item,
      category,
      location,
      quantity
    },
    missingInformation: missingInformation || [],
    nextAction,
    results
  });
}));


/**
 * PHASE 8: GEMINI EXPLAIN
 * POST /api/gemini/explain
 * Explains note content or uploaded file content using Gemini.
 * Content is loaded server-side; never executes code; API key never sent to frontend.
 */
const explainLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});


router.post(
  ['/gemini/explain', '/explain'],
  authenticate,
  explainLimit,
  [
    body('projectId').optional().isString(),
    body('fileId').optional().isString(),
    body('noteId').optional().isString(),
    body('content').optional().isString().isLength({ max: 50000 }),
    body('filename').optional().isString().isLength({ max: 260 }),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const { projectId, fileId, noteId, content: inlineContent, filename: inlineFilename } = req.body || {};
    let contentToExplain = '';
    let filenameForContext = inlineFilename || '';

    if (projectId && fileId) {
      // Load file from project (server-side)
      if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(fileId)) {
        return res.status(400).json({ success: false, error: 'Invalid project or file ID' });
      }
      // Verify project membership
      const member = await ProjectMember.findOne({ project: projectId, user: req.user._id });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access forbidden: You are not a member of this project' });
      }
      const file = await ProjectFile.findOne({ _id: fileId, project: projectId });
      if (!file) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      if (!fs.existsSync(file.storagePath)) {
        return res.status(404).json({ success: false, error: 'File not found on server' });
      }
      const stats = fs.statSync(file.storagePath);
      if (stats.size > 500 * 1024) {
        return res.status(413).json({ success: false, error: 'File is too large for AI explanation (max 500 KB). Please use a smaller file.' });
      }
      contentToExplain = fs.readFileSync(file.storagePath, 'utf8');
      filenameForContext = file.originalName;

    } else if (projectId && noteId) {
      // Load note from project (server-side)
      if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(noteId)) {
        return res.status(400).json({ success: false, error: 'Invalid project or note ID' });
      }
      const member = await ProjectMember.findOne({ project: projectId, user: req.user._id });
      if (!member && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access forbidden: You are not a member of this project' });
      }
      const note = await Note.findOne({ _id: noteId, project: projectId });
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }
      contentToExplain = note.content || note.title;
      filenameForContext = note.title;

    } else if (inlineContent) {
      // Inline content (from note editor before save — uses passed content only)
      if (typeof inlineContent !== 'string' || !inlineContent.trim()) {
        return res.status(400).json({ success: false, error: 'Content is required' });
      }
      contentToExplain = inlineContent.trim();

    } else {
      return res.status(400).json({ success: false, error: 'Provide projectId+fileId, projectId+noteId, or content to explain' });
    }

    if (!contentToExplain.trim()) {
      return res.status(400).json({ success: false, error: 'No content available to explain' });
    }

    try {
      const explanation = await explainContent(contentToExplain, filenameForContext);
      return res.status(200).json({ success: true, explanation });
    } catch (error) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
      return res.status(status).json({
        success: false,
        error: status === 400 || status === 502 ? error.message : 'AI explanation service temporarily unavailable. Please try again later.'
      });
    }
  })
);

/**
 * PHASE 8: GEMINI DOCS (IMPROVE MARKDOWN)
 * POST /api/gemini/docs
 * Improves Markdown note content using Gemini.
 * Returns suggested improved version; NEVER automatically overwrites saved note.
 */
router.post(
  ['/gemini/docs', '/docs'],
  authenticate,
  explainLimit,
  [
    body('content').isString().trim().isLength({ min: 1, max: 50000 }).withMessage('Content is required (max 50,000 characters)'),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    try {
      const improved = await improveMarkdown(content.trim());
      return res.status(200).json({
        success: true,
        improved,
        documentation: improved,
        warning: 'This is a suggested improvement. Review it before applying — your original note has NOT been changed.'
      });
    } catch (error) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
      return res.status(status).json({
        success: false,
        error: status === 400 || status === 502 ? error.message : 'AI improvement service temporarily unavailable. Please try again later.'
      });
    }
  })
);

/**
 * POST /api/gemini/readme
 * Generate a README from the authenticated user's project records.
 */
router.post(
  ['/gemini/readme', '/readme'],
  authenticate,
  explainLimit,
  [
    body('projectId').optional().isString(),
    body('driveId').optional().isString(),
    body('content').optional().isString(),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const { projectId, driveId, content: directContent } = req.body;
    if (!projectId && !driveId && !directContent) {
      return res.status(400).json({ success: false, error: 'Project ID, Drive ID, or content is required' });
    }
    if (driveId) {
      if (!mongoose.isValidObjectId(driveId)) return res.status(400).json({ success: false, error: 'Invalid drive ID' });
      const member = await DonationDriveMember.findOne({ drive: driveId, user: req.user._id });
      const drive = await DonationDrive.findById(driveId).populate('owner', 'name email').lean();
      if (!drive) return res.status(404).json({ success: false, error: 'Donation Drive not found' });
      if (!member && req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Access forbidden: You are not a member of this drive' });
      const [members, files, notes, items] = await Promise.all([
        DonationDriveMember.find({ drive: drive._id }).populate('user', 'name email').lean(),
        DonationDriveFile.find({ drive: drive._id }).select('originalName mimeType size note createdAt').lean(),
        DonationDriveNote.find({ drive: drive._id }).select('title content createdAt').lean(),
        DonationItem.find({ drive: drive._id }).select('title category description quantity condition').lean()
      ]);
      try {
        const readme = await generateReadme({
          project: { id: drive._id, name: drive.name, description: drive.description, owner: drive.owner ? { name: drive.owner.name, email: drive.owner.email } : null },
          members: members.filter((m) => m.user).map((m) => ({ name: m.user.name, email: m.user.email, role: m.role })),
          files: files.map((f) => ({ originalName: f.originalName, mimeType: f.mimeType, size: f.size, note: f.note || '' })),
          notes: notes.map((n) => ({ title: n.title, content: String(n.content || '').slice(0, 5000) })),
          items
        });
        return res.status(200).json({ success: true, readme });
      } catch (error) {
        return res.status(error.statusCode || 502).json({ success: false, error: error.statusCode === 400 ? error.message : 'AI README generation service temporarily unavailable. Please try again later.' });
      }
    }
    if (directContent && !projectId) {
      try {
        const readme = await generateReadme({
          project: { name: 'Donation Drive', description: directContent }
        });
        return res.status(200).json({ success: true, readme });
      } catch (error) {
        return res.status(error.statusCode || 502).json({ success: false, error: error.statusCode === 400 ? error.message : 'AI README generation service temporarily unavailable. Please try again later.' });
      }
    }
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const member = await ProjectMember.findOne({ project: projectId, user: req.user._id });
    const project = await Project.findById(projectId).populate('owner', 'name email');
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!member && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access forbidden: You are not a member of this project' });
    }

    const [members, files, notes] = await Promise.all([
      ProjectMember.find({ project: project._id }).populate('user', 'name email').lean(),
      ProjectFile.find({ project: project._id }).select('originalName mimeType size note createdAt uploadedBy').lean(),
      Note.find({ project: project._id }).select('title content createdBy createdAt updatedAt').lean()
    ]);

    const context = {
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        owner: project.owner ? { name: project.owner.name, email: project.owner.email } : null
      },
      members: members.filter(item => item.user).map(item => ({
        name: item.user.name,
        email: item.user.email,
        role: item.role
      })),
      files: files.map(file => ({
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        note: file.note || ''
      })),
      notes: notes.map(note => ({
        title: note.title,
        content: String(note.content || '').slice(0, 5000)
      }))
    };

    try {
      const readme = await generateReadme(context);
      return res.status(200).json({ success: true, readme });
    } catch (error) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
      return res.status(status).json({
        success: false,
        error: status === 400 ? error.message : 'AI README generation service temporarily unavailable. Please try again later.'
      });
    }
  })
);

module.exports = router;
