const mongoose = require('mongoose');
const config = require('./config');

let inMemoryServer = null;

const connectDatabase = async () => {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log('MongoDB connection: connected to configured MongoDB/Atlas');
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('MongoDB connection: configured MongoDB/Atlas unavailable; starting MongoMemoryServer fallback for development');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        inMemoryServer = await MongoMemoryServer.create();
        const memoryUri = inMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log('MongoDB connection: connected to MongoMemoryServer fallback (development only)');
      } catch (memErr) {
        console.error('Failed to start in-memory MongoDB:', memErr);
        throw err;
      }
    } else {
      throw err;
    }
  }
};

module.exports = { connectDatabase };
