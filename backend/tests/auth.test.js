process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const NGOProfile = require('../src/models/NGOProfile');
const DonationListing = require('../src/models/DonationListing');
const HelpRequest = require('../src/models/HelpRequest');

let mongo;

describe('authentication and authorization', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => { await User.deleteMany({}); await NGOProfile.deleteMany({}); await DonationListing.deleteMany({}); await HelpRequest.deleteMany({}); });
  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

  test('registers with a hashed password and safe response', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Test User', email: 'test@example.com', password: 'Password123' });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body.user.passwordHash).toBeUndefined();
    const user = await User.findOne({ email: 'test@example.com' }).select('+passwordHash');
    expect(user.passwordHash).not.toBe('Password123');
  });

  test('logs in and rejects invalid credentials', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Test User', email: 'test@example.com', password: 'Password123' });
    const valid = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'Password123' });
    expect(valid.status).toBe(200);
    expect(valid.headers['set-cookie'][0]).toContain('HttpOnly');
    const invalid = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrongpass' });
    expect(invalid.status).toBe(401);
  });

  test('protects current user and allows a valid token', async () => {
    const agent = request.agent(app);
    const unauthenticated = await request(app).get('/api/auth/me');
    expect(unauthenticated.status).toBe(401);
    await agent.post('/api/auth/register').send({ name: 'Test User', email: 'test@example.com', password: 'Password123' });
    const authenticated = await agent.get('/api/auth/me');
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.user.email).toBe('test@example.com');
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  test('enforces roles', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Test User', email: 'test@example.com', password: 'Password123' });
    const response = await agent.get('/api/admin/users');
    expect(response.status).toBe(403);
  });

  test('allows an admin to access admin routes', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Admin User', email: 'admin@example.com', password: 'Password123' });
    await User.updateOne({ email: 'admin@example.com' }, { role: 'admin' });
    await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'Password123' });
    const response = await agent.get('/api/admin/users');
    expect(response.status).toBe(200);
    expect(response.body.users[0].passwordHash).toBeUndefined();
  });

  test('supports NGO creation and public filtered discovery', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'NGO Owner', email: 'ngo@example.com', password: 'Password123' });
    await User.updateOne({ email: 'ngo@example.com' }, { role: 'ngo' });
    await agent.post('/api/auth/login').send({ email: 'ngo@example.com', password: 'Password123' });
    const created = await agent.post('/api/ngo').send({ name: 'Open Hands', description: 'Food support', category: 'Food', city: 'Pune', state: 'Maharashtra', latitude: 18.52, longitude: 73.85, acceptedDonationTypes: ['Food'], isPublished: true });
    expect(created.status).toBe(201);
    await NGOProfile.updateOne({ _id: created.body.profile._id }, { verificationStatus: 'verified', isPublished: true });
    const discovered = await request(app).get('/api/ngo/public?city=Pune&donationType=Food');
    expect(discovered.status).toBe(200);
    expect(discovered.body.profiles).toHaveLength(1);
    expect(discovered.body.profiles[0].latitude).toBe(18.52);
    expect(discovered.body.profiles[0].createdBy).toBeUndefined();
  });

  test('creates donation listings and protects ownership', async () => {
    const owner = request.agent(app);
    await owner.post('/api/auth/register').send({ name: 'Donor', email: 'donor@example.com', password: 'Password123' });
    const created = await owner.post('/api/donations').send({ type: 'Clothes', item: 'Winter clothes', quantity: 10, condition: 'good', title: 'Winter clothes', description: 'Clean and sorted', pickupAvailable: true, location: { address: 'Mandi' } });
    expect(created.status).toBe(201);
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ name: 'Other', email: 'other@example.com', password: 'Password123' });
    expect((await other.patch(`/api/donations/${created.body.listing._id}`).send({ item: 'Changed' })).status).toBe(404);
    expect((await owner.get(`/api/donations/${created.body.listing._id}/matches`)).status).toBe(200);
  });

  test('creates, updates, and deletes only owned help requests', async () => {
    const owner = request.agent(app);
    await owner.post('/api/auth/register').send({ name: 'Requester', email: 'requester@example.com', password: 'Password123' });
    const created = await owner.post('/api/help-requests').send({ title: 'Need blankets', category: 'Shelter', requiredItem: 'Blankets', quantity: 4, description: 'For winter', contactInformation: 'requester@example.com', location: { address: 'Mandi' } });
    expect(created.status).toBe(201);
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ name: 'Other', email: 'other@example.com', password: 'Password123' });
    expect((await other.delete(`/api/help-requests/${created.body.request._id}`)).status).toBe(404);
    expect((await owner.patch(`/api/help-requests/${created.body.request._id}`).send({ status: 'fulfilled' })).status).toBe(200);
    expect((await owner.delete(`/api/help-requests/${created.body.request._id}`)).status).toBe(204);
  });

  test('records admin verification and report review metadata', async () => {
    const ngoAgent = request.agent(app);
    await ngoAgent.post('/api/auth/register').send({ name: 'Review NGO', email: 'review-ngo@example.com', password: 'Password123' });
    await User.updateOne({ email: 'review-ngo@example.com' }, { role: 'ngo' });
    await ngoAgent.post('/api/auth/login').send({ email: 'review-ngo@example.com', password: 'Password123' });
    const profile = await ngoAgent.put('/api/ngo/profile').send({ name: 'Review NGO', organizationName: 'Review NGO', city: 'Mandi', category: 'Shelter' });
    expect(profile.status).toBe(200);
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/register').send({ name: 'Reporter', email: 'reporter@example.com', password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: 'reporter@example.com', password: 'Password123' });
    const report = await userAgent.post('/api/reports').send({ targetType: 'ngo', targetId: profile.body.profile._id, reason: 'Incorrect information', details: 'Please review the address.' });
    expect(report.status).toBe(201);
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/register').send({ name: 'Reviewer', email: 'reviewer@example.com', password: 'Password123' });
    await User.updateOne({ email: 'reviewer@example.com' }, { role: 'admin' });
    await adminAgent.post('/api/auth/login').send({ email: 'reviewer@example.com', password: 'Password123' });
    const verification = await adminAgent.patch(`/api/admin/ngos/${profile.body.profile._id}/verification`).send({ verificationStatus: 'flagged', reviewNotes: 'Needs additional evidence.' });
    expect(verification.status).toBe(200);
    expect(verification.body.profile.reviewNotes).toBe('Needs additional evidence.');
    expect((await adminAgent.patch(`/api/reports/${report.body.report._id}`).send({ status: 'reviewed', adminNotes: 'Contact details checked.' })).status).toBe(200);
  });

  test('generates valid JWT in response and allows Authorization Bearer header', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Bearer User',
      email: 'bearer@example.com',
      password: 'Password123'
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    expect(typeof regRes.body.token).toBe('string');

    const decoded = jwt.verify(regRes.body.token, process.env.JWT_SECRET);
    expect(decoded.sub).toBeDefined();
    expect(decoded.role).toBe('user');

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'bearer@example.com',
      password: 'Password123'
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // Authenticate using ONLY Authorization: Bearer <token> (without cookies)
    const bearerMeRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(bearerMeRes.status).toBe(200);
    expect(bearerMeRes.body.user.email).toBe('bearer@example.com');
  });
});
