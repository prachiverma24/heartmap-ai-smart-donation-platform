process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const NGOProfile = require('../src/models/NGOProfile');

let mongo;

describe('NGO Profile Delete Flow (Frontend -> API -> MongoDB -> Response -> Frontend)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NGOProfile.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('complete delete flow: creates profile, verifies in Mongo, deletes via API, confirms removed from Mongo and UI response', async () => {
    // 1. Register NGO user
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Hope NGO',
      email: 'hope@example.com',
      password: 'Password123!',
      role: 'ngo'
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token;
    expect(token).toBeDefined();

    // 2. Create NGO Profile (PUT /api/ngo/profile - as done from frontend NGOProfilePage)
    const createRes = await request(app)
      .put('/api/ngo/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hope Foundation',
        organizationName: 'Hope Foundation',
        category: 'Education',
        city: 'Shimla',
        state: 'HP',
        description: 'Empowering children',
        acceptedDonationTypes: ['Books', 'Toys']
      });
    expect(createRes.status).toBe(200);
    const profileId = createRes.body.profile._id;
    expect(profileId).toBeDefined();

    // 3. Verify in MongoDB that document exists
    const docInDb = await NGOProfile.findById(profileId);
    expect(docInDb).not.toBeNull();
    expect(docInDb.organizationName).toBe('Hope Foundation');

    // 4. Verify GET /api/ngo/profile returns the profile (Frontend initial load)
    const getBefore = await request(app)
      .get('/api/ngo/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(getBefore.status).toBe(200);
    expect(getBefore.body.profile._id).toBe(profileId);

    // 5. Delete NGO Profile (DELETE /api/ngo/:id - connected action from NGOProfilePage)
    const deleteRes = await request(app)
      .delete(`/api/ngo/${profileId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    // 6. Verify MongoDB: Document is completely removed from database
    const docAfterDelete = await NGOProfile.findById(profileId);
    expect(docAfterDelete).toBeNull();

    // 7. Verify GET /api/ngo/profile now returns { profile: null } (Frontend re-fetch / update state)
    const getAfter = await request(app)
      .get('/api/ngo/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(getAfter.status).toBe(200);
    expect(getAfter.body.profile).toBeNull();
  });

  test('unauthorized or mismatched user cannot delete another NGO profile', async () => {
    // NGO 1
    const ngo1 = await request(app).post('/api/auth/register').send({
      name: 'NGO One',
      email: 'ngo1@example.com',
      password: 'Password123!',
      role: 'ngo'
    });
    const ngo1Profile = await request(app)
      .put('/api/ngo/profile')
      .set('Authorization', `Bearer ${ngo1.body.token}`)
      .send({ name: 'NGO One Org', category: 'Health', city: 'Delhi' });
    const profileId = ngo1Profile.body.profile._id;

    // NGO 2
    const ngo2 = await request(app).post('/api/auth/register').send({
      name: 'NGO Two',
      email: 'ngo2@example.com',
      password: 'Password123!',
      role: 'ngo'
    });

    // NGO 2 tries to delete NGO 1's profile -> 404 (not found under NGO 2's filter)
    const deleteForbidden = await request(app)
      .delete(`/api/ngo/${profileId}`)
      .set('Authorization', `Bearer ${ngo2.body.token}`);
    expect(deleteForbidden.status).toBe(404);

    // Profile 1 still exists in MongoDB
    const docStillExists = await NGOProfile.findById(profileId);
    expect(docStillExists).not.toBeNull();
  });

  test('unauthenticated request is rejected with 401', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/ngo/${fakeId}`);
    expect(res.status).toBe(401);
  });

  test('regular user role is forbidden with 403', async () => {
    const regUser = await request(app).post('/api/auth/register').send({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/ngo/${fakeId}`)
      .set('Authorization', `Bearer ${regUser.body.token}`);
    expect(res.status).toBe(403);
  });
});

