process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const DonationDrive = require('../src/models/DonationDrive');
const DonationDriveMember = require('../src/models/DonationDriveMember');
const DonationDriveNote = require('../src/models/DonationDriveNote');
const DonationItem = require('../src/models/DonationItem');

let mongo;
const login = async (name, email) => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name, email, password: 'Password123' });
  await agent.post('/api/auth/login').send({ email, password: 'Password123' });
  return agent;
};

describe('Donation drive APIs', () => {
  beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  afterEach(async () => { await Promise.all([User.deleteMany({}), DonationDrive.deleteMany({}), DonationDriveMember.deleteMany({}), DonationDriveNote.deleteMany({}), DonationItem.deleteMany({})]); });
  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

  test('isolates drive membership and scopes notes', async () => {
    const owner = await login('Drive Owner', 'drive-owner@example.com');
    const other = await login('Other User', 'drive-other@example.com');
    const created = await owner.post('/api/donation-drives').send({ name: 'Winter drive' });
    expect(created.status).toBe(201);
    const id = created.body.drive.id;
    expect((await other.get(`/api/donation-drives/${id}/notes`)).status).toBe(403);
    expect((await owner.post(`/api/donation-drives/${id}/notes`).send({ title: 'Plan', content: 'Pack boxes' })).status).toBe(201);
    expect((await owner.get(`/api/donation-drives/${id}/notes`)).body.notes).toHaveLength(1);
  });

  test('returns aggregation analytics, not stored counters', async () => {
    const owner = await login('Analytics Owner', 'analytics-owner@example.com');
    const id = (await owner.post('/api/donation-drives').send({ name: 'Analytics drive' })).body.drive.id;
    await owner.post(`/api/donation-drives/${id}/items`).send({ title: 'Books', category: 'Books', quantity: 4, condition: 'good' });
    const analytics = await owner.get(`/api/donation-drives/${id}/analytics`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.analytics.totalItems).toBe(1);
    expect(analytics.body.analytics.totalQuantity).toBe(4);
    expect(analytics.body.analytics.summary).toMatchObject({
      totalItems: 1,
      totalQuantity: 4,
      totalFiles: 0,
      totalNotes: 0,
      totalMembers: 1,
      totalNGOInterests: 0
    });
    expect(analytics.body.analytics.items.byCategory).toEqual(
      expect.arrayContaining([expect.objectContaining({ _id: 'Books', quantity: 4 })])
    );
    expect(analytics.body.analytics.activity).toEqual(
      expect.arrayContaining([expect.objectContaining({ items: 1 })])
    );
  });

  test('blocks non-members from private drive analytics', async () => {
    const owner = await login('Private Owner', 'private-owner@example.com');
    const other = await login('Private Viewer', 'private-viewer@example.com');
    const id = (await owner.post('/api/donation-drives').send({ name: 'Private drive' })).body.drive.id;
    expect((await other.get(`/api/donation-drives/${id}/analytics`)).status).toBe(403);
  });

  test('serves only explicitly public drives without authentication', async () => {
    const owner = await login('Public Owner', 'public-owner@example.com');
    const id = (await owner.post('/api/donation-drives').send({
      name: 'Public drive',
      description: 'Safe public details',
      isPublic: true
    })).body.drive.id;
    await owner.post(`/api/donation-drives/${id}/items`).send({
      title: 'Blankets', category: 'Winter', description: 'Warm blankets',
      quantity: 8, condition: 'good'
    });

    const response = await request(require('../src/app')).get(`/api/public/donation-drives/${id}`);
    expect(response.status).toBe(200);
    expect(response.body.drive).toMatchObject({ name: 'Public drive' });
    expect(response.body.drive.isPublic).toBeUndefined();
    expect(response.body.drive.items[0]).toMatchObject({ title: 'Blankets', quantity: 8 });
    expect(response.body.drive.owner).toBeUndefined();
    expect(response.body.drive.notes).toBeUndefined();
  });

  test('does not expose private drives through public endpoint', async () => {
    const owner = await login('Private Public Owner', 'private-public-owner@example.com');
    const id = (await owner.post('/api/donation-drives').send({ name: 'Private drive' })).body.drive.id;
    expect((await request(require('../src/app')).get(`/api/public/donation-drives/${id}`)).status).toBe(404);
  });
});
