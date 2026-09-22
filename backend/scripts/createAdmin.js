const mongoose = require('mongoose');
const User = require('../src/models/User');
const { connectDatabase } = require('../src/db');

const [,, name, email, password] = process.argv;
if (!name || !email || !password) {
  console.error('Usage: node scripts/createAdmin.js "Admin Name" admin@example.com "StrongPassword123"');
  process.exit(1);
}

const run = async () => {
  await connectDatabase();
  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { name, email: email.toLowerCase(), role: 'admin', isActive: true }, { new: true, upsert: true, setDefaultsOnInsert: true });
  await user.setPassword(password);
  await user.save();
  console.log(`Admin account ready: ${user.email}`);
  await mongoose.disconnect();
};

run().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
