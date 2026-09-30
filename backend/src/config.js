const dotenv = require('dotenv');

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
if (process.env.NODE_ENV !== 'test') {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const defaultOrigins = [
  'https://heartmap-ai-smart-frontend-donation.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

const parseClientOrigins = (envOrigin) => {
  if (!envOrigin) return defaultOrigins;
  const envList = envOrigin
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return Array.from(new Set([...envList, ...defaultOrigins]));
};

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/heartmap-test',
  jwtSecret: process.env.JWT_SECRET || 'test-only-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: parseClientOrigins(process.env.CLIENT_ORIGIN),
  publicApiOrigin: process.env.PUBLIC_API_ORIGIN || `http://localhost:${process.env.PORT || 5000}`,
  aiApiKey: process.env.AI_API_KEY?.startsWith('sk-') ? process.env.AI_API_KEY : '',
  aiApiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  // Keep compatibility with existing local setups that used AI_API_KEY for Gemini.
  // OpenAI-style keys remain reserved for the OpenAI-compatible provider.
  geminiApiKey: (process.env.NODE_ENV === 'test' ? '' : (process.env.GEMINI_API_KEY
    || (process.env.AI_API_KEY && !process.env.AI_API_KEY.startsWith('sk-') ? process.env.AI_API_KEY : ''))).trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim(),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
};
