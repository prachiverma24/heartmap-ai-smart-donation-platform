process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const DonationListing = require('../src/models/DonationListing');

let mongo;

describe('Feature 10: Donation Listings API & Flows', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await DonationListing.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('User creates listing -> appears in My Listings (GET /api/donations)', async () => {
    // 1. Register donor user
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Alice Donor',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'user'
    });
    expect(userRes.status).toBe(201);
    const userToken = userRes.body.token;

    // 2. Initial My Listings is empty
    const initialListings = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(initialListings.status).toBe(200);
    expect(initialListings.body.listings).toEqual([]);

    // 3. User creates donation listing
    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'Clothes',
        item: 'Warm Wool Blankets',
        quantity: 10,
        condition: 'new',
        title: '10 Warm Wool Blankets',
        description: 'Brand new blankets suitable for winter shelters.',
        address: 'Mandi, Himachal Pradesh',
        lat: 31.58,
        lng: 76.91,
        pickupAvailable: true,
        images: ['https://example.com/blanket1.jpg']
      });
    expect(createRes.status).toBe(201);
    const listingId = createRes.body.listing._id;
    expect(listingId).toBeDefined();

    // 4. Listing exists in MongoDB
    const dbDoc = await DonationListing.findById(listingId);
    expect(dbDoc).not.toBeNull();
    expect(dbDoc.item).toBe('Warm Wool Blankets');
    expect(dbDoc.quantity).toBe(10);
    expect(dbDoc.pickupAvailable).toBe(true);
    expect(dbDoc.images).toContain('https://example.com/blanket1.jpg');

    // 5. Appears in User's My Listings
    const myListingsRes = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(myListingsRes.status).toBe(200);
    expect(myListingsRes.body.listings.length).toBe(1);
    expect(myListingsRes.body.listings[0]._id.toString()).toBe(listingId.toString());
    expect(myListingsRes.body.listings[0].item).toBe('Warm Wool Blankets');
    expect(myListingsRes.body.listings[0].status).toBe('available');
  });

  test('User edits listing -> updates successfully via PATCH /api/donations/:id', async () => {
    // 1. Register donor user
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Bob Donor',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const userToken = userRes.body.token;

    // 2. Create listing
    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'Books',
        item: 'Textbooks',
        quantity: 5,
        condition: 'good',
        title: 'Science Textbooks',
        description: 'High school science textbooks in good condition.',
        pickupAvailable: false
      });
    expect(createRes.status).toBe(201);
    const listingId = createRes.body.listing._id;

    // 3. User edits listing
    const updateRes = await request(app)
      .patch(`/api/donations/${listingId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        item: 'Science & Math Textbooks',
        quantity: 12,
        condition: 'like-new',
        title: '12 Science & Math Textbooks',
        description: 'Complete high school science and math sets.',
        pickupAvailable: true,
        status: 'available'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.listing.item).toBe('Science & Math Textbooks');
    expect(updateRes.body.listing.quantity).toBe(12);
    expect(updateRes.body.listing.condition).toBe('like-new');
    expect(updateRes.body.listing.pickupAvailable).toBe(true);

    // 4. Verify in MongoDB
    const updatedDb = await DonationListing.findById(listingId);
    expect(updatedDb.item).toBe('Science & Math Textbooks');
    expect(updatedDb.quantity).toBe(12);
    expect(updatedDb.condition).toBe('like-new');
    expect(updatedDb.pickupAvailable).toBe(true);

    // 5. Verify reflected in GET /api/donations
    const listRes = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.body.listings[0].item).toBe('Science & Math Textbooks');
    expect(listRes.body.listings[0].quantity).toBe(12);
  });

  test('User deletes listing -> confirmation -> deleted via DELETE /api/donations/:id', async () => {
    // 1. Register donor user
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Charlie Donor',
      email: 'charlie@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const userToken = userRes.body.token;

    // 2. Create listing
    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'Food',
        item: 'Rice & Dal Bags',
        quantity: 20,
        condition: 'new',
        title: '20kg Rice and Dal packages',
        description: 'Unopened sealed grain sacks for community pantry.',
        pickupAvailable: true
      });
    expect(createRes.status).toBe(201);
    const listingId = createRes.body.listing._id;

    // 3. User deletes listing
    const delRes = await request(app)
      .delete(`/api/donations/${listingId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(delRes.status).toBe(204);

    // 4. Document removed from MongoDB
    const docAfter = await DonationListing.findById(listingId);
    expect(docAfter).toBeNull();

    // 5. Listing list is empty now
    const listRes = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.body.listings).toEqual([]);
  });

  test('NGO logs in -> views available donation listings via GET /api/donations', async () => {
    // 1. Register Donor and create an available listing
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Community Donor',
      email: 'donor@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const userToken = userRes.body.token;

    const createRes = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'Toys',
        item: 'Educational Wooden Toys',
        quantity: 15,
        condition: 'like-new',
        title: '15 Montessori Wooden Toys',
        description: 'Clean, sanitized wooden toys for daycare or orphanage.',
        pickupAvailable: true,
        images: ['https://example.com/toy1.jpg']
      });
    expect(createRes.status).toBe(201);
    const listingId = createRes.body.listing._id;

    // 2. Register NGO user
    const ngoRes = await request(app).post('/api/auth/register').send({
      name: 'Care NGO',
      email: 'care@example.com',
      password: 'Password123!',
      role: 'ngo'
    });
    expect(ngoRes.status).toBe(201);
    const ngoToken = ngoRes.body.token;

    // 3. NGO calls GET /api/donations
    const ngoListingsRes = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${ngoToken}`);
    expect(ngoListingsRes.status).toBe(200);
    expect(ngoListingsRes.body.listings.length).toBe(1);

    const listing = ngoListingsRes.body.listings[0];
    expect(listing._id.toString()).toBe(listingId.toString());
    expect(listing.item).toBe('Educational Wooden Toys');
    expect(listing.quantity).toBe(15);
    expect(listing.condition).toBe('like-new');
    expect(listing.pickupAvailable).toBe(true);
    expect(listing.description).toContain('Clean, sanitized wooden toys');
    expect(listing.images).toContain('https://example.com/toy1.jpg');
    expect(listing.owner?.name).toBe('Community Donor');

    // 4. If listing status changed to closed, it no longer appears in NGO available listings
    await DonationListing.findByIdAndUpdate(listingId, { status: 'closed' });
    const afterCloseRes = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${ngoToken}`);
    expect(afterCloseRes.body.listings.length).toBe(0);
  });
});
