const app = require('./app');
const config = require('./config');
const { connectDatabase } = require('./db');

const start = async () => {
  await connectDatabase();
  console.log(`Gemini AI: ${config.geminiApiKey ? `configured (${config.geminiModel})` : 'not configured — using local fallback'}`);
  if (process.env.NODE_ENV !== 'production') {
    const { seedDevDataIfEmpty } = require('./utils/devSeed');
    await seedDevDataIfEmpty();
  }
  app.listen(config.port, '0.0.0.0', () => console.log(`HeartMap API listening on port ${config.port}`));
};

if (require.main === module) start().catch((error) => { console.error(error); process.exit(1); });

module.exports = { start };
