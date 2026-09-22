process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const NGOProfile = require('../src/models/NGOProfile');
const DonationListing = require('../src/models/DonationListing');

let mongo;

describe('Audit Fixes Verification: Operating Hours & Donation Matching No-Match State', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NGOProfile.deleteMany({});
    await DonationListing.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  test('NGO can save structured operatingHours and donors can retrieve them via public API', async () => {
    // 1. Register NGO
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Timings NGO',
      email: 'timings@example.com',
      password: 'Password123!',
      role: 'ngo'
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token;

    // 2. Save structured operatingHours from NGO profile UI
    const operatingHours = {
      Monday: { open: '08:30', close: '16:30', closed: false },
      Tuesday: { open: '08:30', close: '16:30', closed: false },
      Wednesday: { open: '08:30', close: '16:30', closed: false },
      Thursday: { open: '08:30', close: '16:30', closed: false },
      Friday: { open: '08:30', close: '16:30', closed: false },
      Saturday: { open: '10:00', close: '14:00', closed: false },
      Sunday: { open: '', close: '', closed: true }
    };

    const putRes = await request(app)
      .put('/api/ngo/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Timings Foundation',
        organizationName: 'Timings Foundation',
        category: 'Shelter',
        city: 'Kullu',
        state: 'HP',
        operatingHours
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.profile.operatingHours.Monday.open).toBe('08:30');
    expect(putRes.body.profile.operatingHours.Sunday.closed).toBe(true);
    const profileId = putRes.body.profile._id;

    // Verify directly in MongoDB
    const doc = await NGOProfile.findById(profileId);
    expect(doc.operatingHours.Monday.open).toBe('08:30');
    expect(doc.operatingHours.Saturday.close).toBe('14:00');

    // Make NGO verified and published so public API returns it
    await NGOProfile.findByIdAndUpdate(profileId, { isPublished: true, verificationStatus: 'verified' });

    // 3. Donor accesses NGO Detail endpoint GET /api/ngo/:id
    const detailRes = await request(app).get(`/api/ngo/${profileId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.profile.operatingHours).toBeDefined();
    expect(detailRes.body.profile.operatingHours.Monday.open).toBe('08:30');
    expect(detailRes.body.profile.operatingHours.Sunday.closed).toBe(true);
  });

  test('Donation Matching returns empty array matches: [] when no verified NGO matches the category', async () => {
    // 1. Register donor user
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Donor User',
      email: 'donor@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const userToken = userRes.body.token;

    // 2. Post a donation listing for Electronics
    const postRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'Electronics',
        item: 'Old CRT Television',
        quantity: 1,
        condition: 'used',
        description: 'Working old CRT monitor',
        location: { address: 'Remote Village', lat: 31.5, lng: 77.1 }
      });
    expect(postRes.status).toBe(201);
    const listingId = postRes.body.listing._id;

    // 3. Call matching endpoint GET /api/donations/:id/matches
    // Since there are NO NGOs registered that accept Electronics, matches must be empty
    const matchRes = await request(app)
      .get(`/api/donations/${listingId}/matches`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(matchRes.status).toBe(200);
    expect(matchRes.body.matches).toEqual([]);
    // Frontend triggers empty state "No matching NGOs found for this donation in your area." when matches.length === 0
  });
});

