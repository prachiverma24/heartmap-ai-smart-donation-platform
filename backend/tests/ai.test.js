process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.GEMINI_API_KEY = 'test-fake-gemini-key-not-real';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const NGOProfile = require('../src/models/NGOProfile');
const Feedback = require('../src/models/Feedback');
const aiService = require('../src/services/ai');

jest.mock('../src/services/ai');
const actualAiService = jest.requireActual('../src/services/ai');

let mongo;

describe('HeartMap AI Service & Chatbot (Feature 19.1)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NGOProfile.deleteMany({});
    await Feedback.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const loggedInUser = async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      name: 'Assistant User',
      email: 'assistant@example.com',
      password: 'Password123'
    });
    return agent;
  };

  // --------------------------------------------------------------------------
  // FEATURE 19.1: HEARTMAP AI CHATBOT (/api/ai/chat)
  // --------------------------------------------------------------------------
  describe('POST /api/ai/chat', () => {
    // 1. Valid chatbot message
    test('1. processes valid chatbot message and returns 200 with reply', async () => {
      aiService.chatWithHeartMapAI.mockResolvedValue(
        'HeartMap is a donation discovery and community support platform.'
      );

      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'What is HeartMap?' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reply).toBe(
        'HeartMap is a donation discovery and community support platform.'
      );
      expect(aiService.chatWithHeartMapAI).toHaveBeenCalledWith('What is HeartMap?');
    });

    // 2. Empty message validation
    test('2. rejects empty message or whitespace with 400', async () => {
      const emptyRes = await request(app)
        .post('/api/ai/chat')
        .send({ message: '' });

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.success).toBe(false);
      expect(emptyRes.body.error).toMatch(/message is required/i);

      const whitespaceRes = await request(app)
        .post('/api/ai/chat')
        .send({ message: '     ' });

      expect(whitespaceRes.status).toBe(400);
      expect(whitespaceRes.body.success).toBe(false);
      expect(aiService.chatWithHeartMapAI).not.toHaveBeenCalled();
    });

    // 3. Invalid request (missing field, non-string, malformed)
    test('3. rejects invalid or malformed requests with 400', async () => {
      const missingFieldRes = await request(app)
        .post('/api/ai/chat')
        .send({});

      expect(missingFieldRes.status).toBe(400);
      expect(missingFieldRes.body.success).toBe(false);

      const nonStringRes = await request(app)
        .post('/api/ai/chat')
        .send({ message: 12345 });

      expect(nonStringRes.status).toBe(400);
      expect(nonStringRes.body.success).toBe(false);
    });

    // 4. Gemini/provider failure handled gracefully
    test('4. handles provider failures gracefully without leaking internals', async () => {
      aiService.chatWithHeartMapAI.mockRejectedValue(
        Object.assign(new Error('AI provider connection timeout'), { statusCode: 502 })
      );

      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'How are NGOs verified?' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/AI service temporarily unavailable/i);
      // Ensure no raw internal error details leaked
      expect(response.body.error).not.toMatch(/timeout/i);
    });

    // 5. Successful AI response format
    test('5. returns correct response shape { success: true, reply: string }', async () => {
      aiService.chatWithHeartMapAI.mockResolvedValue(
        'NGOs are verified through administrative review of NGO Darpan ID and 80G certificates.'
      );

      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'How are NGOs verified?' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        reply: 'NGOs are verified through administrative review of NGO Darpan ID and 80G certificates.'
      });
    });

    // 6. Authentication protection if the route is protected
    test('6. functions seamlessly with authenticated sessions', async () => {
      const agent = await loggedInUser();
      aiService.chatWithHeartMapAI.mockResolvedValue('Welcome back! How can I help you donate today?');

      const response = await agent
        .post('/api/ai/chat')
        .send({ message: 'Hello HeartMap' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // 7. API key is not exposed to frontend
    test('7. ensures credentials and API keys are never exposed in API response', async () => {
      aiService.chatWithHeartMapAI.mockResolvedValue(
        'HeartMap provides direct donation connections.'
      );

      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'What is HeartMap?' });

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain(process.env.GEMINI_API_KEY);
      expect(responseText).not.toContain(process.env.JWT_SECRET);
      expect(response.body.apiKey).toBeUndefined();
      expect(response.body.secret).toBeUndefined();
    });

    // 8. AI does not generate fake NGO information
    test('8. actual AI knowledge engine refuses to invent fake NGOs for unknown locations', async () => {
      // Test the real, unmocked domain responder
      const reply = await actualAiService.chatWithHeartMapAI('Tell me about an NGO in Mandi.');

      // Must NOT fabricate an NGO name
      expect(reply).toMatch(/do not have specific database records/i);
      expect(reply).toMatch(/does not invent organizations/i);
      expect(reply).toMatch(/\/ngos/i);
    });

    test('8b. actual AI knowledge engine answers core HeartMap questions accurately and avoids unsupported claims', async () => {
      const replyWhat = await actualAiService.chatWithHeartMapAI('What is HeartMap and how does it work?');
      expect(replyWhat).toMatch(/donation discovery/i);
      expect(replyWhat).toMatch(/does not process payments/i);
      // Ensures unsupported "0% platform fee" claim is removed
      expect(replyWhat.toLowerCase()).not.toContain('0% platform fee');

      const replyVerify = await actualAiService.chatWithHeartMapAI('How are NGOs verified on HeartMap?');
      expect(replyVerify).toMatch(/NGO Darpan/i);
      expect(replyVerify).toMatch(/80G/i);

      const replyReport = await actualAiService.chatWithHeartMapAI('How can I report an NGO?');
      expect(replyReport).toMatch(/Report NGO/i);
    });

    test('8c. never recommends deprecated donation-listing flow when donating items', async () => {
      const forbiddenTerms = ['listing', '/donate-item', 'donate items page', 'my listings', 'create a donation listing'];

      // 1. Winter clothes query
      const replyClothes = await actualAiService.chatWithHeartMapAI('I have winter clothes to donate. What should I do?');
      forbiddenTerms.forEach(term => {
        expect(replyClothes.toLowerCase()).not.toContain(term);
      });
      expect(replyClothes).toMatch(/verified NGOs/i);
      expect(replyClothes).toMatch(/location/i);

      // 2. Books query
      const replyBooks = await actualAiService.chatWithHeartMapAI('I want to donate books. How can HeartMap help?');
      forbiddenTerms.forEach(term => {
        expect(replyBooks.toLowerCase()).not.toContain(term);
      });
      expect(replyBooks).toMatch(/verified non-profits/i);

      // 3. Blankets in Mandi query
      const replyMandi = await actualAiService.chatWithHeartMapAI('I have blankets to donate in Mandi.');
      forbiddenTerms.forEach(term => {
        expect(replyMandi.toLowerCase()).not.toContain(term);
      });
      expect(replyMandi).toMatch(/Mandi/i);
      expect(replyMandi).toMatch(/does not invent organizations/i);
    });

    test('8d. handles payment, help request, out-of-scope, and 5 NGOs prompts with strict guardrails', async () => {
      const forbiddenTerms = ['listing', '/donate-item', 'donate items page', 'my listings', 'create a donation listing', '0% platform fee'];

      // 1. Payment intent
      const replyPayment = await actualAiService.chatWithHeartMapAI('Can I make a payment through HeartMap?');
      expect(replyPayment).toMatch(/does not process or handle payments/i);
      expect(replyPayment).toMatch(/outside HeartMap/i);
      forbiddenTerms.forEach(term => expect(replyPayment.toLowerCase()).not.toContain(term));

      // 2. Help request intent (recognizes as help request, NOT a donation)
      const replyHelp = await actualAiService.chatWithHeartMapAI('I need clothes for a family in Mandi. How can HeartMap help me?');
      expect(replyHelp).toMatch(/Help Request/i);
      expect(replyHelp).toMatch(/Mandi/i);
      expect(replyHelp).toMatch(/help-request system/i);
      forbiddenTerms.forEach(term => expect(replyHelp.toLowerCase()).not.toContain(term));

      // 3. Out-of-scope question
      const replyOutOfScope = await actualAiService.chatWithHeartMapAI('What is the capital of France?');
      expect(replyOutOfScope).toMatch(/HeartMap-related questions/i);
      expect(replyOutOfScope).not.toMatch(/Paris/i);

      // 4. "Tell me 5 verified NGOs in Mandi" (refuses to invent fake NGOs)
      const reply5Ngos = await actualAiService.chatWithHeartMapAI('Tell me 5 verified NGOs in Mandi.');
      expect(reply5Ngos).toMatch(/do not have specific database records/i);
      expect(reply5Ngos).toMatch(/does not invent organizations/i);
      expect(reply5Ngos).toMatch(/\/ngos/i);

      // 5. "I have 5 blankets and winter clothes to donate in Mandi. Can you help me find where I can donate them?"
      const replyBlanketsClothesMandi = await actualAiService.chatWithHeartMapAI(
        'I have 5 blankets and winter clothes to donate in Mandi. Can you help me find where I can donate them?'
      );
      expect(replyBlanketsClothesMandi).toMatch(/winter clothing and blankets/i);
      expect(replyBlanketsClothesMandi).toMatch(/does not invent organizations/i);
      forbiddenTerms.forEach(term => expect(replyBlanketsClothesMandi.toLowerCase()).not.toContain(term));
    });
  });

  // --------------------------------------------------------------------------
  // EXISTING: AI DONATION ASSISTANT (/api/ai/donation-assistant)
  // --------------------------------------------------------------------------
  describe('HeartMap AI donation assistant', () => {
    test('rejects invalid input', async () => {
      const agent = await loggedInUser();
      const response = await agent.post('/api/ai/donation-assistant').send({ message: 'short' });
      expect(response.status).toBe(400);
      expect(aiService.extractDonationIntent).not.toHaveBeenCalled();
    });

    test('returns provider failures as API errors', async () => {
      aiService.extractDonationIntent.mockRejectedValue(
        Object.assign(new Error('AI unavailable'), { statusCode: 502 })
      );
      const response = await (await loggedInUser())
        .post('/api/ai/donation-assistant')
        .send({ message: 'I have clothes to donate in Mandi.' });
      expect(response.status).toBe(502);
      expect(response.body.error).toBe('AI unavailable');
    });

    test('returns empty database-backed matches', async () => {
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['books'],
        category: 'Books',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });
      const response = await (await loggedInUser())
        .post('/api/ai/donation-assistant')
        .send({ message: 'I have books in Mandi.' });
      expect(response.status).toBe(200);
      expect(response.body.matches).toEqual([]);
      expect(response.body.message).toMatch(/No verified NGO profiles/);
    });

    test('returns matching NGO data from MongoDB only', async () => {
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['blankets'],
        category: 'Clothes',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: true
      });
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Mandi Relief',
        name: 'Mandi Relief',
        description: 'Local winter support',
        category: 'Shelter',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        urgentlyNeededItems: ['blankets'],
        pickupAvailable: true,
        verificationStatus: 'verified',
        isPublished: true,
        officialDonationUrl: 'https://example.org/donate'
      });
      const response = await (await loggedInUser())
        .post('/api/ai/donation-assistant')
        .send({ message: 'I have blankets in Mandi.' });
      expect(response.status).toBe(200);
      expect(response.body.matches).toHaveLength(1);
      expect(response.body.matches[0].ngo.name).toBe('Mandi Relief');
      expect(response.body.matches[0].ngo.officialDonationUrl).toBe('https://example.org/donate');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 19.2: AI-POWERED NGO RECOMMENDATIONS (/api/ai/recommendations)
  // --------------------------------------------------------------------------
  describe('Feature 19.2: AI-Powered NGO Recommendations', () => {
    test('1. Valid recommendation request returns 200 with structured intent and recommendations', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['winter blankets', 'clothes'],
        category: 'Clothes',
        location: 'Mandi',
        quantity: '5 blankets',
        intent: 'donate',
        pickupRequested: true
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Himalayan Care Mandi',
        name: 'Himalayan Care Mandi',
        description: 'Providing winter relief in Mandi',
        category: 'Shelter',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        address: 'Main Bazar, Mandi',
        acceptedDonationTypes: ['Clothes'],
        urgentlyNeededItems: ['winter blankets'],
        pickupAvailable: true,
        verificationStatus: 'verified',
        isPublished: true,
        officialDonationUrl: 'https://example.org/himalayan-donate'
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.intent).toBeDefined();
      expect(response.body.intent.items).toContain('winter blankets');
      expect(response.body.intent.location).toBe('Mandi');
      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.recommendations[0].ngo.name).toBe('Himalayan Care Mandi');
      expect(response.body.recommendations[0].matchReasons).toBeDefined();
      expect(response.body.recommendations[0].urgent).toBe(true);
      expect(response.body.recommendations[0].ngo.verificationStatus).toBe('verified');
    });

    test('2. Correct extraction of donation intent with quantities and items', async () => {
      const parsed = actualAiService.parseLocalDonationIntent(
        'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.'
      );
      expect(parsed.items).toContain('winter blankets');
      expect(parsed.items).toContain('clothes');
      expect(parsed.location).toBe('Mandi');
      expect(parsed.quantity).toMatch(/5 (?:winter )?blankets/i);
      expect(parsed.category).toBe('Clothes');
      expect(parsed.intent).toBe('donate');
    });

    test('3. Real MongoDB-backed NGO recommendations (data matches MongoDB exactly)', async () => {
      const agent = await loggedInUser();
      const realId = new mongoose.Types.ObjectId();
      await NGOProfile.create({
        _id: realId,
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Genuine Mandi Seva',
        name: 'Genuine Mandi Seva',
        description: 'Authentic NGO record',
        category: 'Welfare',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true,
        phone: '+91 9876543210',
        email: 'contact@mandiseva.org'
      });

      aiService.extractDonationIntent.mockResolvedValue({
        items: ['clothes'],
        category: 'Clothes',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes to donate in Mandi.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations[0].ngo.id.toString()).toBe(realId.toString());
      expect(response.body.recommendations[0].ngo.phone).toBe('+91 9876543210');
      expect(response.body.recommendations[0].ngo.email).toBe('contact@mandiseva.org');
    });

    test('4. Verified NGO filtering excludes unverified and unpublished NGOs', async () => {
      const agent = await loggedInUser();
      // Pending verification NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Pending NGO Mandi',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'pending',
        isPublished: true
      });
      // Unpublished NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Unpublished NGO Mandi',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: false
      });
      // Verified & Published NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Verified NGO Mandi',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });

      aiService.extractDonationIntent.mockResolvedValue({
        items: ['clothes'],
        category: 'Clothes',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes in Mandi.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.recommendations[0].ngo.name).toBe('Verified NGO Mandi');
    });

    test('5. Location matching prioritizes and filters for requested city', async () => {
      const agent = await loggedInUser();
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Delhi Winter Shelter',
        city: 'Delhi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Mandi Winter Shelter',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });

      aiService.extractDonationIntent.mockResolvedValue({
        items: ['clothes'],
        category: 'Clothes',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have winter clothes in Mandi.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.recommendations[0].ngo.name).toBe('Mandi Winter Shelter');
    });

    test('6. Donation-type matching excludes incompatible or notAccepted donation types', async () => {
      const agent = await loggedInUser();
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Food Bank Only',
        city: 'Mandi',
        acceptedDonationTypes: ['Food'],
        notAcceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });

      aiService.extractDonationIntent.mockResolvedValue({
        items: ['clothes'],
        category: 'Clothes',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes to donate in Mandi.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toHaveLength(0);
    });

    test('7. No-match response when no verified NGOs match criteria', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['electronics'],
        category: 'Electronics',
        location: 'Solan',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have electronics in Solan.' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recommendations).toEqual([]);
      expect(response.body.message).toMatch(/No verified NGO/i);
    });

    test('8. Handles AI provider failure gracefully with 502 without leaking internals', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockRejectedValue(
        Object.assign(new Error('AI provider connection timeout'), { statusCode: 502 })
      );

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes to donate in Mandi.' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/AI service temporarily unavailable/i);
      expect(response.body.error).not.toMatch(/timeout/i);
    });

    test('9. Handles invalid or unparseable AI output safely', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockRejectedValue(
        Object.assign(new Error('AI provider returned invalid structured data'), { statusCode: 502 })
      );

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes in Mandi.' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
    });

    test('10. Authentication protection: rejects unauthenticated requests with 401', async () => {
      const response = await request(app)
        .post('/api/ai/recommendations')
        .send({ message: 'I have clothes to donate in Mandi.' });

      expect(response.status).toBe(401);
    });

    test('11. No fake NGO generation: returns empty array if no MongoDB record exists', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['blankets'],
        category: 'Clothes',
        location: 'RemoteValley',
        intent: 'donate',
        pickupRequested: false
      });

      const response = await agent
        .post('/api/ai/recommendations')
        .send({ message: 'I have blankets in RemoteValley.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toEqual([]);
      expect(response.body.message).toMatch(/No verified NGO/i);
    });

    test('12. Existing matching logic and alias endpoint /api/ai/match remain fully functional', async () => {
      const agent = await loggedInUser();
      aiService.extractDonationIntent.mockResolvedValue({
        items: ['books'],
        category: 'Books',
        location: 'Mandi',
        intent: 'donate',
        pickupRequested: false
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Mandi Library Project',
        city: 'Mandi',
        acceptedDonationTypes: ['Books'],
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await agent
        .post('/api/ai/match')
        .send({ message: 'I have books in Mandi.' });

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.recommendations[0].ngo.name).toBe('Mandi Library Project');
      expect(response.body.matches).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: AI-POWERED NGO SEARCH (/api/ai/search)
  // --------------------------------------------------------------------------
  describe('Feature 3: AI-Powered NGO Search', () => {
    // 1. "Find verified NGOs in Mandi that accept clothes"
    test('1. "Find verified NGOs in Mandi that accept clothes" returns matched real NGO', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Clothes',
        donationType: 'Clothes',
        item: 'clothes',
        location: 'Mandi',
        purpose: null,
        keywords: ['mandi', 'clothes']
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Mandi Clothes Support',
        name: 'Mandi Clothes Support',
        description: 'Distributes winter garments to needy families in Mandi',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        address: 'Bazar, Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true,
        verificationSource: 'District Administration Mandi'
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Find verified NGOs in Mandi that accept clothes' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.intent.location).toBe('Mandi');
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].ngo.name).toBe('Mandi Clothes Support');
      expect(response.body.results[0].matchReasons).toContain('Located in Mandi, Himachal Pradesh');
      expect(response.body.results[0].matchReasons).toContain('Verified accepted donation type: Clothes');
      expect(response.body.results[0].explanation).toMatch(/Mandi/);
    });

    // 2. "Where can I donate food in Himachal Pradesh?"
    test('2. "Where can I donate food in Himachal Pradesh?" finds matching food NGOs', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Food',
        donationType: 'Food',
        item: 'food',
        location: 'Himachal Pradesh',
        purpose: 'food donation',
        keywords: ['himachal pradesh', 'food']
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'HP Food Seva',
        name: 'HP Food Seva',
        description: 'Providing meal rations across Himachal Pradesh',
        city: 'Shimla',
        state: 'Himachal Pradesh',
        acceptedDonationTypes: ['Food', 'Rations'],
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Where can I donate food in Himachal Pradesh?' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].ngo.name).toBe('HP Food Seva');
      expect(response.body.results[0].matchReasons).toContain('Verified accepted donation type: Food');
    });

    // 3. "Show NGOs near Mandi for blankets"
    test('3. "Show NGOs near Mandi for blankets" matches blankets in Mandi area', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Clothes',
        donationType: 'Blankets',
        item: 'blankets',
        location: 'Mandi',
        purpose: 'winter relief',
        keywords: ['mandi', 'blankets']
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Mandi Winter Care',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        acceptedDonationTypes: ['Blankets', 'Warm Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Show NGOs near Mandi for blankets' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].ngo.organizationName).toBe('Mandi Winter Care');
    });

    // 4. "I want to support education for children"
    test('4. "I want to support education for children" matches educational organizations', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Education',
        donationType: 'Educational Supplies',
        item: null,
        location: null,
        purpose: 'education for children',
        keywords: ['education', 'children']
      });

      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Child Literacy Foundation',
        description: 'Providing education for children in need',
        category: 'Education',
        acceptedDonationTypes: ['Educational Supplies', 'Books'],
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'I want to support education for children' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].ngo.organizationName).toBe('Child Literacy Foundation');
      expect(response.body.results[0].matchReasons).toContain('Mission directly supports education for children');
    });

    // 5. Query with no matching NGO returns empty results and suggestions
    test('5. returns 200 with empty array and suggestions when no verified NGO matches', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Toys',
        donationType: 'Toys',
        item: 'toys',
        location: 'RemoteIsland',
        purpose: null,
        keywords: ['remoteisland', 'toys']
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Find toy donation centers on RemoteIsland' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual([]);
      expect(response.body.totalResults).toBe(0);
      expect(response.body.message).toMatch(/No verified NGOs matching your search were found/i);
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.suggestions.length).toBeGreaterThan(0);
    });

    // 6. Invalid/empty query rejects with 400
    test('6. rejects missing, empty, or whitespace queries with 400', async () => {
      const emptyRes = await request(app).post('/api/ai/search').send({ query: '' });
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.success).toBe(false);
      expect(emptyRes.body.error).toMatch(/search query is required/i);

      const whitespaceRes = await request(app).post('/api/ai/search').send({ query: '   ' });
      expect(whitespaceRes.status).toBe(400);
      expect(whitespaceRes.body.success).toBe(false);

      const missingRes = await request(app).post('/api/ai/search').send({});
      expect(missingRes.status).toBe(400);
      expect(missingRes.body.success).toBe(false);
    });

    // 7. AI provider failure returns 502 gracefully
    test('7. handles AI provider failure gracefully with 502 without leaking secrets', async () => {
      aiService.extractSearchIntent.mockRejectedValue(
        Object.assign(new Error('AI provider connection timeout'), { statusCode: 502 })
      );

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Show NGOs in Mandi' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/AI service temporarily unavailable/i);
      expect(response.body.error).not.toMatch(/timeout/i);
    });

    // 8. Verify only published + verified NGOs are returned
    test('8. strictly filters for isPublished: true and verificationStatus: "verified"', async () => {
      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Clothes',
        donationType: 'Clothes',
        location: 'Mandi',
        keywords: ['mandi', 'clothes']
      });

      // Pending verification NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Pending Verification Mandi NGO',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'pending',
        isPublished: true
      });

      // Unpublished NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Unpublished Mandi NGO',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: false
      });

      // Verified and Published NGO
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Verified & Published Mandi NGO',
        city: 'Mandi',
        acceptedDonationTypes: ['Clothes'],
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Find verified NGOs in Mandi for clothes' });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].ngo.name).toBe('Verified & Published Mandi NGO');
    });

    // 9. Verify no fictional NGO data can appear
    test('9. returns data strictly from MongoDB records with zero fabricated properties', async () => {
      const realId = new mongoose.Types.ObjectId();
      await NGOProfile.create({
        _id: realId,
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Accurate Red Cross Mandi',
        name: 'Accurate Red Cross Mandi',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        category: 'Disaster Relief',
        acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
        verificationStatus: 'verified',
        isPublished: true,
        verificationSource: 'District Administration Mandi, Government of Himachal Pradesh Official Portal',
        sourceUrl: 'https://mandi.hp.gov.in',
        contact: '01905-225220',
        urgentlyNeededItems: [],
        pickupAvailable: false
      });

      aiService.extractSearchIntent.mockResolvedValue({
        category: 'Medical Aid',
        donationType: 'Medical Aid',
        item: 'medical aid',
        location: null,
        keywords: ['medical aid']
      });

      const response = await request(app)
        .post('/api/ai/search')
        .send({ query: 'Show verified NGOs that accept medical aid' });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      const resultNgo = response.body.results[0].ngo;
      expect(resultNgo.id.toString()).toBe(realId.toString());
      expect(resultNgo.name).toBe('Accurate Red Cross Mandi');
      expect(resultNgo.contact).toBe('01905-225220');
      expect(resultNgo.sourceUrl).toBe('https://mandi.hp.gov.in');
      expect(resultNgo.pickupAvailable).toBe(false);
      expect(resultNgo.urgentlyNeededItems).toEqual([]);
    });

    // 10. Verify local search intent extractor parses queries accurately
    test('10. actual local deterministic search intent parser accurately extracts intent from test queries', () => {
      // Query 1
      const q1 = actualAiService.parseLocalSearchIntent('Find verified NGOs in Mandi that accept clothes');
      expect(q1.location).toBe('Mandi');
      expect(q1.category).toBe('Clothes');
      expect(q1.donationType).toBe('Clothes');
      expect(q1.item).toBe('clothes');

      // Query 2
      const q2 = actualAiService.parseLocalSearchIntent('Where can I donate food in Himachal Pradesh?');
      expect(q2.location).toBe('Himachal Pradesh');
      expect(q2.category).toBe('Food');
      expect(q2.donationType).toBe('Food');

      // Query 3
      const q3 = actualAiService.parseLocalSearchIntent('Show NGOs near Mandi for blankets');
      expect(q3.location).toBe('Mandi');
      expect(q3.item).toBe('blankets');

      // Query 4
      const q4 = actualAiService.parseLocalSearchIntent('I want to support education for children');
      expect(q4.purpose).toBe('education for children');
      expect(q4.donationType).toBe('Educational Supplies');

      // Query 5
      const q5 = actualAiService.parseLocalSearchIntent('Show verified NGOs that accept medical aid');
      expect(q5.donationType).toBe('Medical Aid');
      expect(q5.item).toBe('medical aid');
    });

    // 11. Verify existing public NGO discovery still works
    test('11. standard public discovery GET /api/ngo/public remains fully operational', async () => {
      await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Public Discovery NGO',
        city: 'Mandi',
        verificationStatus: 'verified',
        isPublished: true
      });

      const response = await request(app)
        .get('/api/ngo/public?city=Mandi');

      expect(response.status).toBe(200);
      expect(response.body.profiles).toBeDefined();
      expect(response.body.profiles.some((p) => p.organizationName === 'Public Discovery NGO')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: AI CONTENT GENERATION (/api/ai/generate-content)
  // --------------------------------------------------------------------------
  describe('POST /api/ai/generate-content', () => {
    // 1. "I need winter clothes and blankets for a family in Mandi."
    test('1. improves rough help request description with grammar and formatting preserving all user entities', async () => {
      aiService.generateContent.mockResolvedValue(
        'We are requesting winter clothes and blankets for a family located in Mandi. Any support or donations would be greatly appreciated.'
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          contentType: 'help_request',
          text: 'I need winter clothes and blankets for a family in Mandi.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.contentType).toBe('help_request');
      expect(res.body.generatedText).toContain('Mandi');
      expect(res.body.generatedText).toMatch(/clothes/i);
      expect(res.body.generatedText).toMatch(/blankets/i);
      expect(res.body.generatedText).toMatch(/family/i);
    });

    // 2. "I want books for children."
    test('2. improves rough educational request preserving books and children without inventing facts', async () => {
      aiService.generateContent.mockResolvedValue(
        'We are seeking donations of books for children to support their learning and education.'
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          contentType: 'help_request',
          text: 'I want books for children.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.generatedText).toMatch(/books/i);
      expect(res.body.generatedText).toMatch(/children/i);
      // Ensure no invented organization or location
      expect(res.body.generatedText).not.toMatch(/Red Cross/i);
      expect(res.body.generatedText).not.toMatch(/Mandi/i);
    });

    // 3. "I need help."
    test('3. handles generic user input gracefully without inventing specifics', async () => {
      aiService.generateContent.mockResolvedValue(
        'We are in need of community assistance and support. Please reach out if you can help.'
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          contentType: 'help_request',
          text: 'I need help.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.generatedText.length).toBeGreaterThan(10);
    });

    // 4. "I need 5 blankets."
    test('4. strictly preserves user specified quantities without hallucinating extra counts', async () => {
      aiService.generateContent.mockResolvedValue(
        'We are requesting a donation of 5 blankets for those in need.'
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          contentType: 'help_request',
          text: 'I need 5 blankets.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.generatedText).toContain('5');
      expect(res.body.generatedText).toMatch(/blankets/i);
    });

    // 5. "I need clothes." (no location provided)
    test('5. does not invent locations when none are provided', async () => {
      aiService.generateContent.mockResolvedValue(
        'We are seeking donations of clothes to assist individuals in need.'
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          contentType: 'help_request',
          text: 'I need clothes.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.generatedText).not.toMatch(/Mandi/i);
      expect(res.body.generatedText).not.toMatch(/Delhi/i);
      expect(res.body.generatedText).not.toMatch(/Shimla/i);
    });

    // 6. Empty / whitespace query
    test('6. returns 400 when text is empty or only whitespace', async () => {
      const res1 = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: '' });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: '   ' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    // 7. Missing or invalid contentType
    test('7. returns 400 when contentType is missing or invalid', async () => {
      const res1 = await request(app)
        .post('/api/ai/generate-content')
        .send({ text: 'I need help with blankets' });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'unknown_type', text: 'I need help with blankets' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    // 8. Text shorter than 3 characters or longer than 2000 characters
    test('8. returns 400 when text is too short or exceeds 2000 characters', async () => {
      const resShort = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: 'hi' });
      expect(resShort.status).toBe(400);
      expect(resShort.body.success).toBe(false);

      const longText = 'a'.repeat(2001);
      const resLong = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: longText });
      expect(resLong.status).toBe(400);
      expect(resLong.body.success).toBe(false);
    });

    // 9. AI provider failure returns 502
    test('9. returns 502 when AI provider fails or errors', async () => {
      aiService.generateContent.mockRejectedValue(
        Object.assign(new Error('AI generation failed'), { statusCode: 502 })
      );

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: 'I need winter clothes' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('AI content generation service temporarily unavailable');
    });

    // 10. Verify no MongoDB writes occur during generate-content
    test('10. does not create or modify any MongoDB records during content generation', async () => {
      aiService.generateContent.mockResolvedValue('Polished description for help request.');

      const countBeforeUsers = await User.countDocuments();
      const countBeforeNGOs = await NGOProfile.countDocuments();

      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({ contentType: 'help_request', text: 'I need food and blankets for family' });

      expect(res.status).toBe(200);

      const countAfterUsers = await User.countDocuments();
      const countAfterNGOs = await NGOProfile.countDocuments();

      expect(countAfterUsers).toBe(countBeforeUsers);
      expect(countAfterNGOs).toBe(countBeforeNGOs);
    });

    // 11. Test actual deterministic generator directly
    test('11. actual local deterministic content generator generates quality content without hallucinating', () => {
      const g1 = actualAiService.generateLocalContent('I need winter clothes and blankets for a family in Mandi.', 'help_request');
      expect(g1).toContain('Mandi');
      expect(g1).toMatch(/clothes/i);
      expect(g1).toMatch(/blankets/i);
      expect(g1).toMatch(/family/i);

      const g2 = actualAiService.generateLocalContent('I want books for children.', 'help_request');
      expect(g2).toMatch(/books/i);
      expect(g2).toMatch(/children/i);
      expect(g2).not.toMatch(/Mandi/i);

      const g3 = actualAiService.generateLocalContent('I need 5 blankets.', 'help_request');
      expect(g3).toContain('5');
      expect(g3).toMatch(/blankets/i);

      const g4 = actualAiService.generateLocalContent('I need help.', 'help_request');
      expect(g4.length).toBeGreaterThan(10);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: AI-POWERED NGO SUMMARIZATION (/api/ai/summarize-ngo)
  // --------------------------------------------------------------------------
  describe('POST /api/ai/summarize-ngo', () => {
    let verifiedNgo;
    let unverifiedNgo;
    let unpublishedNgo;

    beforeEach(async () => {
      verifiedNgo = await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Indian Red Cross Society, District Branch Mandi',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        category: 'Disaster Relief',
        description: 'Statutory humanitarian body providing relief in Mandi.',
        acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
        urgentlyNeededItems: [],
        pickupAvailable: false,
        officialWebsite: 'https://mandi.hp.gov.in',
        verificationStatus: 'verified',
        verificationSource: 'District Administration Mandi Portal',
        isPublished: true
      });

      unverifiedNgo = await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Unverified Community Care',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        verificationStatus: 'pending',
        isPublished: true
      });

      unpublishedNgo = await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Draft NGO Society',
        city: 'Shimla',
        state: 'Himachal Pradesh',
        verificationStatus: 'verified',
        isPublished: false
      });
    });

    // 1. Summarize verified published NGO successfully
    test('1. successfully summarizes verified published NGO using strictly database facts', async () => {
      aiService.summarizeNGO.mockResolvedValue(
        'Indian Red Cross Society, District Branch Mandi is a verified humanitarian organization based in Mandi, Himachal Pradesh. Its listed support areas include disaster relief and medical aid.'
      );

      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: verifiedNgo._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toContain('Indian Red Cross Society');
      expect(res.body.summary).toContain('Mandi');
    });

    // 2. Reject unverified NGO
    test('2. rejects unverified NGO with 400 error', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: unverifiedNgo._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Only verified and published NGOs can be summarized');
    });

    // 3. Reject unpublished NGO
    test('3. rejects unpublished NGO with 400 error', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: unpublishedNgo._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Only verified and published NGOs can be summarized');
    });

    // 4. Nonexistent NGO ID returns 404
    test('4. returns 404 when NGO does not exist in database', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: nonExistentId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('NGO not found');
    });

    // 5. Invalid NGO ID string returns 400
    test('5. returns 400 when ngoId is invalid ObjectId format', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: 'invalid-mongodb-id' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Valid ngoId is required');
    });

    // 6. Missing NGO ID returns 400
    test('6. returns 400 when ngoId is missing or empty', async () => {
      const res1 = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({});
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: '' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    // 7. Upstream AI provider failure returns 502
    test('7. returns 502 when AI provider fails or errors', async () => {
      aiService.summarizeNGO.mockRejectedValue(
        Object.assign(new Error('AI summarization failed'), { statusCode: 502 })
      );

      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: verifiedNgo._id.toString() });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('AI NGO summarization service temporarily unavailable');
    });

    // 8. Verify no MongoDB mutations occur during summarization
    test('8. does not modify any MongoDB records during summarization', async () => {
      aiService.summarizeNGO.mockResolvedValue('Short summary for testing.');

      const ngoBefore = await NGOProfile.findById(verifiedNgo._id).lean();

      const res = await request(app)
        .post('/api/ai/summarize-ngo')
        .send({ ngoId: verifiedNgo._id.toString() });

      expect(res.status).toBe(200);

      const ngoAfter = await NGOProfile.findById(verifiedNgo._id).lean();
      expect(JSON.stringify(ngoAfter)).toBe(JSON.stringify(ngoBefore));
    });

    // 9. Test actual deterministic generator directly (accuracy & hallucination protection)
    test('9. actual local deterministic NGO summarizer reflects only database facts and omits unverified claims', () => {
      const summary = actualAiService.summarizeLocalNGO({
        name: 'Indian Red Cross Society, District Branch Mandi',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        description: 'Statutory humanitarian body providing relief in Mandi.',
        acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
        urgentlyNeededItems: [],
        pickupAvailable: false
      });

      expect(summary).toContain('Indian Red Cross Society, District Branch Mandi');
      expect(summary).toContain('Mandi, Himachal Pradesh');
      expect(summary).toContain('Statutory humanitarian body providing relief in Mandi.');
      expect(summary).toContain('Disaster Relief, Medical Aid');

      // Crucial zero-hallucination checks:
      // Empty urgentlyNeededItems must NOT produce urgent claims
      expect(summary).not.toMatch(/urgent/i);
      expect(summary).not.toMatch(/blanket/i);
      // pickupAvailable=false must NOT claim pickup is available
      expect(summary).not.toMatch(/pickup is available/i);
    });

    // 10. Verify pickup and urgent items are included ONLY when true in database
    test('10. actual local deterministic NGO summarizer mentions pickup and urgent items only when present in DB', () => {
      const summary = actualAiService.summarizeLocalNGO({
        name: 'Community Care',
        city: 'Shimla',
        state: 'Himachal Pradesh',
        acceptedDonationTypes: ['Food'],
        urgentlyNeededItems: ['Rice', 'Lentils'],
        pickupAvailable: true
      });

      expect(summary).toContain('Rice, Lentils');
      expect(summary).toContain('Donation pickup is available');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: AI-POWERED FEEDBACK ANALYSIS (/api/ai/analyze-feedback)
  // --------------------------------------------------------------------------
  describe('POST /api/ai/analyze-feedback (Feature 6: AI-Powered Feedback Analysis)', () => {
    let testUser;
    let testNgo;
    let testFeedback;

    beforeEach(async () => {
      testUser = new User({
        name: 'Feedback Donor',
        email: 'feedback.donor@example.com',
        role: 'user'
      });
      await testUser.setPassword('Password123');
      await testUser.save();

      testNgo = await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Indian Red Cross Society, District Branch Mandi',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        category: 'Disaster Relief',
        verificationStatus: 'verified',
        isPublished: true
      });

      testFeedback = await Feedback.create({
        user: testUser._id,
        ngo: testNgo._id,
        feedback: 'The staff was helpful and polite, but the donation drop-off process was confusing and I had difficulty finding the correct location.',
        rating: 4,
        status: 'published'
      });
    });

    test('1. successfully analyzes positive feedback and extracts positive points', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'positive',
        positivePoints: ['Staff was helpful and polite.'],
        concerns: [],
        suggestions: []
      });

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'The staff was helpful and polite.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('positive');
      expect(res.body.analysis.positivePoints).toContain('Staff was helpful and polite.');
      expect(res.body.analysis.concerns).toHaveLength(0);
    });

    test('2. successfully analyzes mixed feedback with both positive points and concerns', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'mixed',
        positivePoints: ['Staff was helpful.'],
        concerns: ['Donation process was confusing.'],
        suggestions: ['Provide clearer donation process instructions.']
      });

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'The staff was helpful, but the donation process was confusing.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('mixed');
      expect(res.body.analysis.positivePoints).toHaveLength(1);
      expect(res.body.analysis.concerns).toHaveLength(1);
      expect(res.body.analysis.suggestions).toHaveLength(1);
    });

    test('3. analyzes feedback containing concerns with negative/mixed sentiment', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'negative',
        positivePoints: [],
        concerns: ['Process was confusing.', 'Difficulty finding the location.'],
        suggestions: ['Provide clearer instructions for the donation process.']
      });

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'The process was confusing and I had difficulty finding the location.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('negative');
      expect(res.body.analysis.concerns).toHaveLength(2);
    });

    test('4. analyzes neutral feedback without hallucinating facts or complaints', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'neutral',
        positivePoints: [],
        concerns: [],
        suggestions: []
      });

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'I visited the center.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('neutral');
      expect(res.body.analysis.concerns).toHaveLength(0);
      expect(res.body.analysis.positivePoints).toHaveLength(0);
    });

    test('5. does not make claims of fraud when asked "Is this NGO fraudulent?"', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'neutral',
        positivePoints: [],
        concerns: ['User inquired about NGO legitimacy (AI feedback analysis cannot assess legal compliance, legitimacy, or fraud).'],
        suggestions: ['Consult official government records (such as NGO Darpan) or platform administrative verification files to verify credentials.']
      });

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'Is this NGO fraudulent?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('neutral');
      expect(res.body.analysis.concerns[0]).toContain('cannot assess legal compliance, legitimacy, or fraud');
    });

    test('6. rejects missing or empty feedback text with 400 error', async () => {
      const res1 = await request(app).post('/api/ai/analyze-feedback').send({});
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app).post('/api/ai/analyze-feedback').send({ feedback: '   ' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);

      const res3 = await request(app).post('/api/ai/analyze-feedback').send({ feedback: 'hi' });
      expect(res3.status).toBe(400);
      expect(res3.body.error).toContain('at least 3 characters');
    });

    test('7. rejects excessively long feedback text (>2000 chars) with 400 error', async () => {
      const longText = 'a'.repeat(2001);
      const res = await request(app).post('/api/ai/analyze-feedback').send({ feedback: longText });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('cannot exceed 2000 characters');
    });

    test('8. handles feedbackId lookup for authorized user', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'mixed',
        positivePoints: ['Staff was helpful and polite.'],
        concerns: ['Donation drop-off process was confusing.'],
        suggestions: ['Provide clearer drop-off instructions.']
      });

      const u = await User.findById(testUser._id);
      await u.setPassword('Password123');
      await u.save();

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'feedback.donor@example.com',
        password: 'Password123'
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedbackId: testFeedback._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis.sentiment).toBe('mixed');
    });

    test('9. rejects nonexistent feedbackId with 404 error', async () => {
      const u = await User.findById(testUser._id);
      await u.setPassword('Password123');
      await u.save();

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'feedback.donor@example.com',
        password: 'Password123'
      });
      const token = loginRes.body.token;

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedbackId: fakeId });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Feedback not found');
    });

    test('10. rejects unauthorized user trying to analyze another user feedbackId with 403 error', async () => {
      const otherUser = new User({
        name: 'Intruder User',
        email: 'intruder@example.com',
        role: 'user'
      });
      await otherUser.setPassword('Password123');
      await otherUser.save();

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'intruder@example.com',
        password: 'Password123'
      });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedbackId: testFeedback._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You do not have permission');
    });

    test('11. does not modify any MongoDB records during feedback analysis', async () => {
      aiService.analyzeFeedback.mockResolvedValue({
        sentiment: 'positive',
        positivePoints: ['Great work.'],
        concerns: [],
        suggestions: []
      });

      const feedbackBefore = await Feedback.findById(testFeedback._id).lean();
      const ngoBefore = await NGOProfile.findById(testNgo._id).lean();

      await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'The staff was helpful and polite.' });

      const feedbackAfter = await Feedback.findById(testFeedback._id).lean();
      const ngoAfter = await NGOProfile.findById(testNgo._id).lean();

      expect(JSON.stringify(feedbackBefore)).toBe(JSON.stringify(feedbackAfter));
      expect(JSON.stringify(ngoBefore)).toBe(JSON.stringify(ngoAfter));
    });

    test('12. returns 502 when AI provider fails during feedback analysis', async () => {
      aiService.analyzeFeedback.mockRejectedValue(
        Object.assign(new Error('AI provider connection timeout'), { statusCode: 502 })
      );

      const res = await request(app)
        .post('/api/ai/analyze-feedback')
        .send({ feedback: 'The staff was helpful and polite.' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('AI feedback analysis service temporarily unavailable');
    });

    test('13. actual local deterministic feedback analyzer produces accurate, grounded sentiments and suggestions', () => {
      const mixedRes = actualAiService.analyzeLocalFeedback(
        'The staff was helpful and polite, but the donation drop-off process was confusing and I had difficulty finding the correct location.'
      );
      expect(mixedRes.sentiment).toBe('mixed');
      expect(mixedRes.positivePoints.length).toBeGreaterThan(0);
      expect(mixedRes.concerns.length).toBeGreaterThan(0);
      expect(mixedRes.suggestions.length).toBeGreaterThan(0);

      const posRes = actualAiService.analyzeLocalFeedback('The staff was helpful and polite.');
      expect(posRes.sentiment).toBe('positive');
      expect(posRes.positivePoints.length).toBeGreaterThan(0);
      expect(posRes.concerns.length).toBe(0);

      const neutralRes = actualAiService.analyzeLocalFeedback('I visited the center.');
      expect(neutralRes.sentiment).toBe('neutral');

      const fraudRes = actualAiService.analyzeLocalFeedback('Is this NGO fraudulent?');
      expect(fraudRes.sentiment).toBe('neutral');
      expect(fraudRes.concerns[0]).toContain('cannot assess legal compliance, legitimacy, or fraud');
    });
  });

  describe('Feature 7: AI Assistant (POST /api/ai/assistant)', () => {
    let testNgo;

    beforeEach(async () => {
      testNgo = await NGOProfile.create({
        user: new mongoose.Types.ObjectId(),
        organizationName: 'Indian Red Cross Society, District Branch Mandi',
        name: 'Indian Red Cross Society, District Branch Mandi',
        description: 'Providing emergency relief and medical assistance in Mandi district.',
        category: 'Disaster Relief',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        address: 'DC Office Complex, Mandi, HP - 175001',
        acceptedDonationTypes: ['Clothes', 'Disaster Relief', 'Medical Aid'],
        urgentlyNeededItems: [],
        pickupAvailable: false,
        dropOffAvailable: true,
        verificationStatus: 'verified',
        verificationSource: 'District Administration Mandi Portal',
        isPublished: true
      });
    });

    test('A. "I have winter clothes to donate in Mandi." extracts donate intent, location, and finds verified NGO', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I have winter clothes to donate in Mandi.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('donate');
      expect(res.body.entities.location).toBe('Mandi');
      expect(res.body.entities.item).toBe('winter clothes');
      expect(res.body.missingInformation).toEqual([]);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].name).toContain('Indian Red Cross');
      expect(res.body.results[0].verificationStatus).toBe('verified');
    });

    test('B. "I want to donate books." identifies donation intent, missing location, and asks for location', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I want to donate books.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('donate');
      expect(res.body.missingInformation).toContain('location');
      expect(res.body.nextAction).toBe('ask_location');
      expect(res.body.response).toMatch(/Which city or area should I search in/i);
      expect(res.body.results).toEqual([]);
    });

    test('C. "I need clothes for a family in Mandi." identifies help_request intent without automatic submission', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I need clothes for a family in Mandi.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('help_request');
      expect(res.body.nextAction).toBe('create_help_request');
      expect(res.body.response).toContain('Help Requests section');
    });

    test('D. "Find NGOs in Mandi that accept clothes." returns real verified DB records only', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'Find NGOs in Mandi that accept clothes.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('find_ngo');
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].city).toBe('Mandi');
      expect(res.body.results[0].acceptedDonationTypes).toContain('Clothes');
    });

    test('E. "Tell me about this NGO." guides to NGO information flow without invented facts', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'Tell me about this NGO.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('ngo_information');
      expect(res.body.nextAction).toBe('view_ngo');
      expect(res.body.response).toContain('NGO profile page');
    });

    test('F. "Is this NGO genuine?" provides verification info only without making fraud/genuine conclusions', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'Is this NGO genuine?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('verification');
      expect(res.body.nextAction).toBe('view_verification');
      expect(res.body.response).toContain('not a guarantee of legal compliance, safety, legitimacy');
      expect(res.body.response).not.toMatch(/\b(is genuine|is fraudulent|is completely safe)\b/i);
    });

    test('G. "Can I pay through HeartMap?" provides clear no-payment explanation', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'Can I pay through HeartMap?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toContain('HeartMap does not process or handle payments');
      expect(res.body.response).toContain('external official channel');
    });

    test('H. "What is the capital of France?" stays within HeartMap scope', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'What is the capital of France?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response).toContain('HeartMap Assistant is designed specifically to help with donations');
      expect(res.body.response).not.toContain('Paris');
    });

    test('I. "Find NGOs in Antarctica that accept moon rocks." produces clean no-result response with zero fake NGOs', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'Find NGOs in Antarctica that accept moon rocks.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual([]);
      expect(res.body.response).toContain('No matching verified NGO was found in Antarctica');
    });

    test('J. Rejects missing or empty message with HTTP 400 error', async () => {
      const res1 = await request(app).post('/api/ai/assistant').send({});
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app).post('/api/ai/assistant').send({ message: '   ' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    test('K. Rejects very long input (>2000 chars) with HTTP 400 error', async () => {
      const longMsg = 'donate '.repeat(400);
      const res = await request(app).post('/api/ai/assistant').send({ message: longMsg });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('cannot exceed 2000 characters');
    });

    test('L. Handles AI provider failure with clean HTTP 502 error', async () => {
      aiService.processAssistantQuery.mockRejectedValue(
        Object.assign(new Error('AI provider connection timeout'), { statusCode: 502 })
      );

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I have clothes in Mandi.' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('AI Assistant service temporarily unavailable');
    });

    test('M. Handles database failure with clean error without information leakage', async () => {
      aiService.processAssistantQuery.mockResolvedValue({
        intent: 'donate',
        item: 'clothes',
        category: 'Clothes',
        location: 'Mandi',
        quantity: null,
        missingInformation: [],
        nextAction: 'find_ngo',
        response: 'Searching in Mandi...'
      });

      const findSpy = jest.spyOn(NGOProfile, 'find').mockImplementationOnce(() => {
        throw new Error('Database connection pool exhausted');
      });

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I have clothes in Mandi.' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unable to retrieve NGO records right now');
      expect(res.body.error).not.toContain('Database connection pool exhausted');

      findSpy.mockRestore();
    });

    test('N. Confirms zero database mutations during assistant processing', async () => {
      aiService.processAssistantQuery.mockImplementation(actualAiService.processLocalAssistant);

      const ngoBefore = await NGOProfile.findById(testNgo._id).lean();

      await request(app)
        .post('/api/ai/assistant')
        .send({ message: 'I have winter clothes to donate in Mandi.' });

      const ngoAfter = await NGOProfile.findById(testNgo._id).lean();

      expect(JSON.stringify(ngoBefore)).toBe(JSON.stringify(ngoAfter));
    });
  });
});


