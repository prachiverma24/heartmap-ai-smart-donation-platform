const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const NGOProfile = require('../src/models/NGOProfile');
const { seedDevDataIfEmpty } = require('../src/utils/devSeed');
const { signToken } = require('../src/utils/auth');

async function runVerification() {
  console.log('--- STARTING REAL NGO & AI RECOMMENDATION AUDIT VERIFICATION ---');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await seedDevDataIfEmpty();

  const user = await User.findOne({ email: 'demo@heartmap.org' });
  const token = signToken(user);

  // Check that NO fictional NGOs exist in database
  const fictionalCount = await NGOProfile.countDocuments({
    organizationName: {
      $in: [
        'Himalayan Relief & Sewa Sansthan',
        'Mandi Community Care Foundation',
        'Delhi Annapurna Food Bank'
      ]
    }
  });

  if (fictionalCount > 0) {
    throw new Error(`Data audit failed: Found ${fictionalCount} fictional NGOs in MongoDB!`);
  }
  console.log('✓ Verified: Zero fictional/demo NGOs found in database.');

  // Check that real curated NGOs exist
  const realNgos = await NGOProfile.find().lean();
  console.log(`✓ Loaded ${realNgos.length} real curated NGOs from MongoDB:`);
  realNgos.forEach(n => {
    console.log(`  - ${n.organizationName} (${n.city}, ${n.state})`);
    console.log(`    Source: ${n.verificationSource}`);
    console.log(`    Source URL: ${n.sourceUrl}`);
    console.log(`    Reg Number: ${n.registrationNumber}`);
  });

  console.log('\n[TEST 1] Testing exact prompt:');
  const prompt1 = 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.';
  console.log(`Prompt: "${prompt1}"`);

  const res1 = await request(app)
    .post('/api/ai/recommendations')
    .set('Authorization', `Bearer ${token}`)
    .send({ message: prompt1 });

  console.log('Status:', res1.status);
  console.log('Response body:', JSON.stringify(res1.body, null, 2));

  if (res1.status !== 200 || !res1.body.success) {
    throw new Error('Test 1 failed: Expected status 200 and success true');
  }

  if (!res1.body.intent || res1.body.intent.location !== 'Mandi') {
    throw new Error('Test 1 failed: Intent location was not Mandi');
  }

  if (!res1.body.recommendations || res1.body.recommendations.length === 0) {
    throw new Error('Test 1 failed: Expected recommendations for Mandi');
  }

  // Validate that all returned organizations are real and verified
  const allowedRealNames = [
    'Indian Red Cross Society, District Branch Mandi',
    'Sahyog Bal Shrawan and Viklang Kalyan Samiti',
    'Sakar Society for Differently Abled Persons'
  ];

  res1.body.recommendations.forEach((rec, idx) => {
    const ngo = rec.ngo;
    console.log(`\nMatch #${idx + 1}: ${ngo.organizationName || ngo.name}`);
    console.log(`- Verification Status: ${ngo.verificationStatus}`);
    console.log(`- Verification Source: ${ngo.verificationSource}`);
    console.log(`- Source URL: ${ngo.sourceUrl}`);
    console.log(`- Registration Number: ${ngo.registrationNumber}`);
    console.log(`- Contact: ${ngo.contact || ngo.phone}`);
    console.log(`- Official Website: ${ngo.officialWebsite || ngo.website}`);

    if (!allowedRealNames.includes(ngo.organizationName) && !allowedRealNames.includes(ngo.name)) {
      throw new Error(`Test 1 failed: Unexpected NGO ${ngo.name} returned, not in curated real NGO dataset!`);
    }

    if (!ngo.verificationSource) {
      throw new Error(`Test 1 failed: NGO ${ngo.name} lacks verificationSource!`);
    }

    if (ngo.verificationStatus !== 'verified') {
      throw new Error(`Test 1 failed: NGO ${ngo.name} is not marked verified!`);
    }

    if (ngo.organizationName.includes('Red Cross')) {
      if (ngo.urgentlyNeededItems && ngo.urgentlyNeededItems.length > 0) {
        throw new Error(`Data accuracy error: Red Cross has unverified urgentlyNeededItems: ${JSON.stringify(ngo.urgentlyNeededItems)}`);
      }
      if (rec.urgent) {
        throw new Error('Data accuracy error: Red Cross was marked urgent without verified documentary evidence!');
      }
      if (ngo.pickupAvailable) {
        throw new Error('Data accuracy error: Red Cross was marked pickupAvailable without verified doorstep pickup service!');
      }
      console.log('✓ Verified: Indian Red Cross Society Mandi has zero fabricated urgent needs, pickupAvailable=false, and accurate facts only.');
    }
  });

  console.log('\n[TEST 2] Testing /api/ai/match alias:');
  const res2 = await request(app)
    .post('/api/ai/match')
    .set('Authorization', `Bearer ${token}`)
    .send({ message: prompt1 });

  if (res2.status !== 200 || !res2.body.success) {
    throw new Error('Test 2 failed: Expected /api/ai/match alias to work identically');
  }
  console.log('Status for /api/ai/match:', res2.status, '(matches found:', res2.body.recommendations.length, ')');

  console.log('\n[TEST 3] Testing No-Match Scenario:');
  const prompt3 = 'I want to donate vintage server computers in Timbuktu.';
  const res3 = await request(app)
    .post('/api/ai/recommendations')
    .set('Authorization', `Bearer ${token}`)
    .send({ message: prompt3 });

  console.log('Status:', res3.status);
  if (res3.body.recommendations && res3.body.recommendations.length > 0) {
    throw new Error('Test 3 failed: Expected 0 recommendations for nonexistent location/category');
  }
  console.log('✓ Successfully returned empty recommendations array for unmatchable request.');

  console.log('\n--- ALL REAL NGO QUALITY & AUDIT CHECKS PASSED SUCCESSFULLY ---');
  await mongoose.disconnect();
  await mongoServer.stop();
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
