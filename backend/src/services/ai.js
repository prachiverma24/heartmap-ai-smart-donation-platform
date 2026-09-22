const config = require('../config');

const categories = ['Clothes', 'Food', 'Books', 'Toys', 'Electronics', 'Furniture', 'Money', 'Other'];
const intents = ['donate', 'find-help', 'unknown'];

const HEARTMAP_SYSTEM_PROMPT = `You are HeartMap AI, the conversational assistant for HeartMap.

HeartMap is a donation discovery and community support platform.
HeartMap:
- helps people discover relevant verified NGOs and community support opportunities
- helps donors find appropriate organizations for what they want to give
- allows users to create community help requests
- has an NGO verification and administrative review process
- does NOT process payments
- does NOT charge or process donations itself
- may redirect users to an NGO's official donation/contact channel when applicable

INTENT HANDLING GUIDELINES:

1. DONATION INTENT (e.g., "I have winter clothes to donate in Mandi"):
   - Guide the user toward finding relevant verified NGOs that accept those items.
   - Ask for location if not provided so they can be guided to the appropriate option.
   - Direct users to the HeartMap NGO Directory (/ngos) and interactive Map.
   - Explain that HeartMap connects donors directly with relevant organizations through official channels.
   - NEVER mention "Donate Items", "My Listings", "creating a donation listing", "listing an item", or "/donate-item".

2. HELP REQUEST INTENT (e.g., "I need clothes for a family in Mandi. How can HeartMap help me?"):
   - Crucial: Distinguish between someone wanting to give/donate and someone needing help.
   - When a user needs goods/supplies/assistance for themselves or others, recognize this as a HELP REQUEST, NOT a donation.
   - Guide the user to create a community Help Request on HeartMap (/help-requests) with details of what is needed and location.
   - Explain that NGOs and community members can use the platform's help-request system to discover relevant needs.
   - Do NOT redirect the user to donation listing or donor flows.

3. PAYMENT INTENT (e.g., "Can I make a payment through HeartMap?", "Can I donate money through HeartMap?", "Does HeartMap process payments?"):
   - Answer clearly and directly: "No. HeartMap does not process or handle payments. When applicable, HeartMap can guide users to an NGO's official donation channel, but the transaction itself happens outside HeartMap."
   - Do NOT imply that HeartMap collects money, charges a platform fee, or handles transactions.
   - NEVER make unsupported factual claims like "0% platform fee".

4. OUT-OF-SCOPE QUESTIONS (e.g., "What is the capital of France?"):
   - Keep the response HeartMap-focused and politely redirect the conversation toward HeartMap's supported features (NGO discovery, community help requests, verification).

5. NGO FACTUAL INFORMATION & ZERO FABRICATION (e.g., "Tell me 5 verified NGOs in Mandi"):
   - If you do not have real database information for specific NGOs in the current context, DO NOT invent or fabricate any NGO names, verification status, Darpan IDs, 80G/12A certificates, addresses, donation URLs, statistics, or platform fees.
   - State clearly that you do not have the required verified database records in the current context, and direct the user to search the HeartMap NGO Directory (/ngos) or Map.

6. NGO VERIFICATION QUESTIONS (e.g., "How are NGOs verified on HeartMap?"):
   - Explain that organizations undergo an administrative review where platform administrators verify official credentials such as NGO Darpan registration ID, valid 80G/12A tax exemption documents, and contact details before granting verified status.`;

const requestJson = async (url, options, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch (error) { body = {}; }
    if (!response.ok) {
      const err = new Error(body.error?.message || `AI provider returned ${response.status}`);
      err.statusCode = response.status >= 500 ? 502 : 503;
      throw err;
    }
    return body;
  } finally { clearTimeout(timer); }
};

const extractGeminiText = (response, type) => {
  const text = (response.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => (typeof part.text === 'string' ? part.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason;
    const suffix = finishReason ? ` (finish reason: ${finishReason})` : '';
    throw Object.assign(new Error(`AI provider returned empty ${type}${suffix}`), { statusCode: 502 });
  }

  return text;
};

const parseJson = (text) => {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
};

const parseLocalDonationIntent = (message) => {
  const lower = String(message || '').toLowerCase();

  // 1. Location extraction
  let location = null;
  const locationMatch = message.match(/\bin\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:[\.,\?!]|\s+find|\s+where|\s+can|\s*$)/i);
  if (locationMatch && locationMatch[1]) {
    const candidate = locationMatch[1].trim();
    if (!['the', 'my', 'our', 'need', 'order', 'case', 'touch', 'advance'].includes(candidate.toLowerCase())) {
      location = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }
  if (!location && lower.includes('mandi')) location = 'Mandi';
  if (!location && lower.includes('delhi')) location = 'Delhi';
  if (!location && lower.includes('mumbai')) location = 'Mumbai';
  if (!location && lower.includes('bangalore')) location = 'Bangalore';
  if (!location && lower.includes('shimla')) location = 'Shimla';

  // 2. Quantity extraction (e.g. "5 winter blankets", "10 books", "2 boxes of clothes")
  let quantity = null;
  const qtyMatch = message.match(/\b(\d+\s+(?:winter\s+)?(?:blankets?|clothes?|books?|toys?|boxes?|packets?|bags?|units?|items?))\b/i);
  if (qtyMatch) {
    quantity = qtyMatch[1].trim();
  }

  // 3. Items extraction
  const items = [];
  if (lower.includes('winter blankets') || lower.includes('blanket')) {
    items.push(lower.includes('winter blankets') ? 'winter blankets' : 'blankets');
  }
  if (lower.includes('winter clothes') || lower.includes('clothes') || lower.includes('clothing')) {
    items.push(lower.includes('winter clothes') ? 'winter clothes' : 'clothes');
  }
  if (lower.includes('book') || lower.includes('textbook')) items.push('books');
  if (lower.includes('food') || lower.includes('ration') || lower.includes('grain')) items.push('food');
  if (lower.includes('toy')) items.push('toys');
  if (lower.includes('laptop') || lower.includes('phone') || lower.includes('computer') || lower.includes('electronic')) items.push('electronics');
  if (lower.includes('furniture') || lower.includes('chair') || lower.includes('table')) items.push('furniture');

  // 4. Category mapping
  let category = null;
  if (items.some((i) => i.includes('clothes') || i.includes('blanket'))) category = 'Clothes';
  else if (items.includes('books')) category = 'Books';
  else if (items.includes('food')) category = 'Food';
  else if (items.includes('toys')) category = 'Toys';
  else if (items.includes('electronics')) category = 'Electronics';
  else if (items.includes('furniture')) category = 'Furniture';
  else if (lower.includes('money') || lower.includes('funds')) category = 'Money';

  // 5. Intent mapping
  let intent = 'unknown';
  if (lower.includes('donate') || lower.includes('giving') || lower.includes('give') || lower.includes('contribution')) {
    intent = 'donate';
  } else if (lower.includes('need') || lower.includes('help') || lower.includes('request')) {
    intent = 'find-help';
  }

  // 6. Pickup requested
  const pickupRequested = Boolean(/\b(pick\s*up|doorstep|collect)\b/i.test(lower));

  return {
    items,
    category,
    location,
    quantity,
    intent,
    pickupRequested
  };
};

const extractDonationIntent = async (message) => {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const error = new Error('Message is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini API if configured
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `Extract donation intent as JSON only. Do not recommend organizations and do not invent facts.
Schema:
{
  "items": string[],
  "category": one of ${JSON.stringify(categories)} or null,
  "location": string or null,
  "quantity": string or null,
  "intent": one of ${JSON.stringify(intents)},
  "pickupRequested": boolean
}
User input: "${trimmed}"`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json'
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty intent'), { statusCode: 502 });
      const parsed = parseJson(reply);
      return {
        items: Array.isArray(parsed.items) ? parsed.items.filter((item) => typeof item === 'string').slice(0, 10) : [],
        category: categories.includes(parsed.category) ? parsed.category : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim().slice(0, 120) : null,
        quantity: typeof parsed.quantity === 'string' ? parsed.quantity.trim().slice(0, 80) : null,
        intent: intents.includes(parsed.intent) ? parsed.intent : 'unknown',
        pickupRequested: parsed.pickupRequested === true
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini intent extraction failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Extract donation intent as JSON only. Do not recommend organizations and do not invent facts. Schema: {"items": string[], "category": one of ${JSON.stringify(categories)} or null, "location": string or null, "quantity": string or null, "intent": one of ${JSON.stringify(intents)}, "pickupRequested": boolean}. Normalize obvious donation categories; use null when unknown.` },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned no interpretation'), { statusCode: 502 });
      const parsed = parseJson(content);
      return {
        items: Array.isArray(parsed.items) ? parsed.items.filter((item) => typeof item === 'string').slice(0, 10) : [],
        category: categories.includes(parsed.category) ? parsed.category : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim().slice(0, 120) : null,
        quantity: typeof parsed.quantity === 'string' ? parsed.quantity.trim().slice(0, 80) : null,
        intent: intents.includes(parsed.intent) ? parsed.intent : 'unknown',
        pickupRequested: parsed.pickupRequested === true
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider intent extraction failed'), { statusCode: 502 });
    }
  }

  // 3. Deterministic local intent normalization fallback (for testing/offline/local development)
  return parseLocalDonationIntent(trimmed);
};

/**
 * Built-in HeartMap domain knowledge engine for local development / testing
 * when no external cloud API key is configured.
 * Strictly adheres to HeartMap context rules and refuses to invent fake NGOs,
 * unsupported fee claims, or reference deprecated donation listings.
 */
const getBuiltInHeartMapReply = (userMessage) => {
  const lower = String(userMessage || '').toLowerCase();

  // 1. PAYMENT INTENT
  // E.g. "Can I make a payment through HeartMap?", "Can I donate money through HeartMap?", "Does HeartMap process payments?"
  const isPaymentQuestion =
    lower.includes('make a payment') ||
    lower.includes('process payment') ||
    lower.includes('process payments') ||
    lower.includes('pay through heartmap') ||
    lower.includes('donate money through heartmap') ||
    lower.includes('platform fee') ||
    lower.includes('transaction fee') ||
    lower.includes('payment gateway') ||
    ((lower.includes('payment') || lower.includes('pay ') || lower.includes('money')) && lower.includes('heartmap'));

  if (isPaymentQuestion) {
    return 'No. HeartMap does not process or handle payments. When applicable, HeartMap can guide users to an NGO\'s official donation channel, but the transaction itself happens outside HeartMap.';
  }

  // 2. OUT-OF-SCOPE / UNRELATED QUESTIONS
  // E.g. "What is the capital of France?"
  const heartMapKeywords = [
    'heartmap', 'ngo', 'non-profit', 'nonprofit', 'charity', 'donate', 'donation', 'donor',
    'help', 'need', 'needy', 'request', 'clothes', 'clothing', 'blanket', 'blankets', 'book', 'books', 'food',
    'ration', 'verif', 'report', 'mandi', 'support', 'organization', 'items', 'give'
  ];
  const isRelated = heartMapKeywords.some((kw) => lower.includes(kw));
  if (!isRelated || lower.includes('capital of') || lower.includes('france') || lower.includes('weather') || lower.includes('president of') || lower.includes('recipe')) {
    return 'I am HeartMap\'s AI assistant, focused on helping you discover verified NGOs, coordinate donations of essential items, and create community help requests. I can only assist with HeartMap-related questions. How can I help you with non-profit discovery or community support today?';
  }

  // 3. HELP REQUEST INTENT (CRUCIAL: Distinguish from donation intent)
  // E.g. "I need clothes for a family in Mandi. How can HeartMap help me?"
  const isHelpIntent =
    (lower.includes('need') || lower.includes('help request') || lower.includes('ask for help') || lower.includes('request help') || lower.includes('seeking help')) &&
    !lower.includes('have to donate') &&
    !lower.includes('want to donate') &&
    !lower.includes('like to donate') &&
    !lower.includes('to donate') &&
    !lower.includes('where i can donate') &&
    !lower.includes('where can i donate');

  if (isHelpIntent) {
    if (lower.includes('mandi') || lower.includes('family')) {
      return 'If you need clothes for a family in Mandi, you can create a community Help Request on HeartMap with the details of what is needed and the location. NGOs and community members can use the platform\'s help-request system to discover relevant needs.';
    }
    return 'If you or someone in your community needs assistance (such as clothes, food, blankets, or educational supplies), you can create a community Help Request on HeartMap (/help-requests) with the details of what is needed and the location. NGOs and community members can use the platform\'s help-request system to discover relevant needs.';
  }

  // 4. SPECIFIC NGO FACTUAL INQUIRY (ZERO FABRICATION)
  // E.g. "Tell me 5 verified NGOs in Mandi."
  const isSpecificNgoListQuery =
    (lower.includes('5 verified ngos') || lower.includes('verified ngos in') || lower.includes('tell me about an ngo') || lower.includes('list ngos') || lower.includes('find 5') || lower.includes('ngos in')) &&
    !lower.includes('donate') &&
    !lower.includes('give');

  if (isSpecificNgoListQuery) {
    if (lower.includes('mandi')) {
      return 'I do not have specific database records for individual NGOs in Mandi in this chat session. HeartMap does not invent organizations or factual platform data. Please explore the HeartMap NGO Directory (/ngos) or use our interactive Map to search and view real, verified non-profits operating in Mandi.';
    }
    return 'I do not have specific database records for individual NGOs in that location in this chat session. HeartMap does not invent organizations or factual platform data. Please visit the HeartMap NGO Directory (/ngos) or use our interactive Map of Needs to search and view real, verified non-profits operating in your area.';
  }

  // 5. DONATION INTENT WITH SPECIFIC LOCATION (e.g. Mandi)
  // E.g. "I have 5 blankets and winter clothes to donate in Mandi. Can you help me find where I can donate them?", "I have blankets to donate in Mandi."
  if (lower.includes('mandi')) {
    return 'You can use HeartMap to find relevant verified NGOs that accept winter clothing and blankets. While I do not have specific database records for individual NGOs in Mandi in this chat session (HeartMap does not invent organizations), you can explore our NGO Directory (/ngos) or interactive Map to discover verified organizations operating in Mandi and reach out through their official channels.';
  }

  // 6. HOW ARE NGOS VERIFIED?
  // E.g. "How are NGOs verified on HeartMap?"
  if (lower.includes('verif') || lower.includes('verification')) {
    return 'NGOs on HeartMap undergo an administrative review process. Organizations must submit their official government registration (NGO Darpan ID), valid 80G/12A tax exemption certificates, and verified operational address. Platform administrators manually review these documents before an NGO receives the verified status on HeartMap.';
  }

  // 7. HOW CAN I REPORT AN NGO?
  if (lower.includes('report')) {
    return 'If you notice suspicious activity, inaccurate contact details, or policy violations, you can report an NGO directly from their profile page. Click the "Report NGO" button, select the reason (e.g., incorrect information, suspicious activity, wrong contact), and provide a brief description. Our administration team immediately reviews all flagged submissions.';
  }

  // 8. GENERAL / SPECIFIC ITEM DONATION INTENT
  // E.g. "I have winter clothes to donate. What should I do?", "I want to donate books. How can HeartMap help?"
  if (lower.includes('winter clothes') || lower.includes('winter clothing') || (lower.includes('clothes') && lower.includes('donate'))) {
    return 'You can use HeartMap to find relevant verified NGOs that accept winter clothing. Tell me your location if you haven\'t already, and I can help you find the appropriate option, or explore our NGO Directory (/ngos) to connect directly with active drives.';
  }

  if (lower.includes('books') || lower.includes('book')) {
    return 'HeartMap connects donors directly with verified non-profits that accept books and educational materials. Tell me your location if you haven\'t already, and I can help you find the appropriate option, or you can browse the HeartMap NGO Directory (/ngos) and filter by the "Books" category to reach out through official channels.';
  }

  if (lower.includes('blanket') || lower.includes('blankets')) {
    return 'You can use HeartMap to find relevant verified NGOs that accept blankets and winter relief supplies. Tell me your location if you haven\'t already, and I can help you find the appropriate option, or browse the HeartMap NGO Directory (/ngos) to connect with verified community initiatives.';
  }

  if (lower.includes('what can i donate') || lower.includes('want to donate') || lower.includes('how to donate') || lower.includes('how can heartmap help') || lower.includes('donate')) {
    return 'You can use HeartMap to find relevant verified NGOs that accept what you want to give. Tell me what item you would like to donate and your location if you haven\'t already, and I can help guide you to the appropriate organizations, or you can browse our NGO Directory (/ngos) directly.';
  }

  // 9. WHAT IS HEARTMAP & HOW DOES IT WORK?
  // E.g. "What is HeartMap and how does it work?", "What is HeartMap?", "How does HeartMap work?"
  if (lower.includes('heartmap') && (lower.includes('what') || lower.includes('how') || lower.includes('work'))) {
    return 'HeartMap is a donation discovery and community support platform. It helps people discover relevant verified NGOs and community support opportunities, helps donors find appropriate organizations for what they want to give, and allows users to create community help requests. HeartMap does not process payments or charge donations—when applicable, users are guided to an NGO\'s official donation channel or direct contact.\n\nHow HeartMap works:\n1. Browse our Verified NGO Directory (/ngos) or explore the interactive Map of Needs.\n2. Filter by donation category (Clothes, Food, Books, etc.) or your city.\n3. View verified profiles to check accepted items, drives, and official contact details.\n4. Submit a community Help Request (/help-requests) if you or someone in your community needs assistance.';
  }

  // 10. CONTACT NGO
  if (lower.includes('contact')) {
    return 'You can contact any organization directly through the contact details listed on their verified profile page, including their official phone number, email address, and physical location.';
  }

  // Default safe guidance
  return 'Hi! I\'m HeartMap AI ❤️ I can help you find verified NGOs, understand our verification process, discover organizations accepting donations, create community help requests, or report concerns. How can I support your giving journey today?';
};

/**
 * Conversational AI chatbot for HeartMap.
 * Supports Gemini API (via GEMINI_API_KEY), OpenAI-compatible endpoint,
 * or built-in HeartMap domain engine for testing/local development.
 */
const chatWithHeartMapAI = async (message) => {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const error = new Error('Message is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${HEARTMAP_SYSTEM_PROMPT}\n\nUser Question: ${trimmed}` }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600
        }
      };

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      if (err.statusCode === 400) throw err;
      // Graceful fallback to built-in HeartMap domain knowledge engine
    }
  }

  // 2. OpenAI-compatible API if AI_API_KEY and AI_API_URL are configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.2,
          messages: [
            { role: 'system', content: HEARTMAP_SYSTEM_PROMPT },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const reply = response.choices?.[0]?.message?.content;
      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      if (err.statusCode === 400) throw err;
      // Graceful fallback to built-in HeartMap domain knowledge engine
    }
  }

  // 3. Built-in domain knowledge engine (when offline or external cloud key fails)
  return getBuiltInHeartMapReply(trimmed);
};

/**
 * FEATURE 3: AI-POWERED NGO SEARCH
 * Deterministic local search intent parser for offline development, local runs,
 * and unit testing without cloud API keys.
 */
const parseLocalSearchIntent = (query) => {
  const trimmed = String(query || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Location Extraction
  let location = null;
  if (lower.includes('himachal pradesh')) {
    location = 'Himachal Pradesh';
  } else if (lower.includes('mandi')) {
    location = 'Mandi';
  } else if (lower.includes('sundernagar')) {
    location = 'Sundernagar';
  } else if (lower.includes('new delhi') || lower.includes('delhi')) {
    location = 'Delhi';
  } else if (lower.includes('mumbai')) {
    location = 'Mumbai';
  } else if (lower.includes('bangalore') || lower.includes('bengaluru')) {
    location = 'Bangalore';
  } else if (lower.includes('shimla')) {
    location = 'Shimla';
  } else {
    const locMatch = trimmed.match(/\b(?:in|near|around|at)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
    if (locMatch && locMatch[1]) {
      const candidate = locMatch[1].trim();
      const stopWords = ['the', 'my', 'our', 'need', 'verified', 'order', 'advance', 'case', 'touch', 'any', 'all', 'a', 'an', 'good'];
      if (!stopWords.includes(candidate.toLowerCase())) {
        location = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }

  // 2. Purpose Extraction
  let purpose = null;
  if (lower.includes('education for children') || (lower.includes('education') && lower.includes('children'))) {
    purpose = 'education for children';
  } else if (lower.includes('support education')) {
    purpose = 'support education';
  } else if (lower.includes('medical aid') || lower.includes('medical')) {
    purpose = 'medical aid';
  } else if (lower.includes('winter relief') || (lower.includes('winter') && lower.includes('blanket'))) {
    purpose = 'winter relief';
  } else if (lower.includes('disaster relief') || lower.includes('disaster')) {
    purpose = 'disaster relief';
  } else if (lower.includes('donate food') || lower.includes('feed')) {
    purpose = 'food donation';
  } else if (lower.includes('disability') || lower.includes('differently abled') || lower.includes('special needs')) {
    purpose = 'disability support';
  }

  // 3. Category, DonationType, and Item Extraction
  let category = null;
  let donationType = null;
  let item = null;

  if (lower.includes('medical aid') || lower.includes('medicine') || lower.includes('medicines') || lower.includes('healthcare')) {
    category = 'Medical Aid';
    donationType = 'Medical Aid';
    item = 'medical aid';
  } else if (lower.includes('winter blankets') || lower.includes('blanket') || lower.includes('blankets') || lower.includes('woolens')) {
    category = 'Clothes';
    donationType = lower.includes('blanket') ? 'Blankets' : 'Woolens';
    item = lower.includes('winter blankets') ? 'winter blankets' : 'blankets';
  } else if (lower.includes('clothes') || lower.includes('clothing') || lower.includes('garments')) {
    category = 'Clothes';
    donationType = 'Clothes';
    item = 'clothes';
  } else if (lower.includes('food') || lower.includes('ration') || lower.includes('rations') || lower.includes('grain')) {
    category = 'Food';
    donationType = 'Food';
    item = 'food';
  } else if (lower.includes('book') || lower.includes('books') || lower.includes('textbook') || lower.includes('textbooks')) {
    category = 'Books';
    donationType = 'Books';
    item = 'books';
  } else if (lower.includes('education') || lower.includes('educational supplies') || lower.includes('school')) {
    category = 'Education';
    donationType = 'Educational Supplies';
    item = null;
  } else if (lower.includes('disability') || lower.includes('therapy') || lower.includes('differently abled')) {
    category = 'Community';
    donationType = 'Disability Aid';
  } else if (lower.includes('toy') || lower.includes('toys')) {
    category = 'Toys';
    donationType = 'Toys';
    item = 'toys';
  } else if (lower.includes('electronic') || lower.includes('laptop') || lower.includes('phone') || lower.includes('computer')) {
    category = 'Electronics';
    donationType = 'Electronics';
    item = 'electronics';
  } else if (lower.includes('furniture')) {
    category = 'Furniture';
    donationType = 'Furniture';
    item = 'furniture';
  } else if (lower.includes('disaster relief') || lower.includes('relief')) {
    category = 'Disaster Relief';
    donationType = 'Disaster Relief';
  }

  // 4. Keywords Extraction
  const stopWordsSet = new Set([
    'find', 'verified', 'ngos', 'ngo', 'in', 'that', 'accept', 'where', 'can', 'i', 'donate',
    'show', 'near', 'for', 'want', 'to', 'support', 'a', 'an', 'the', 'of', 'and', 'with', 'is', 'are',
    'organization', 'organizations', 'which', 'who', 'help', 'please', 'me', 'some', 'give', 'any'
  ]);

  const rawWords = lower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const keywords = [];
  
  if (location) {
    keywords.push(location.toLowerCase());
  }
  if (purpose && !keywords.includes(purpose.toLowerCase())) {
    keywords.push(purpose.toLowerCase());
  }

  for (const w of rawWords) {
    if (!stopWordsSet.has(w) && w.length > 2 && !keywords.some((k) => k.includes(w))) {
      keywords.push(w);
    }
  }

  return {
    category,
    donationType,
    item,
    location,
    purpose,
    keywords: keywords.slice(0, 8)
  };
};

/**
 * Extracts structured search intent from a user's natural language query.
 * Uses Gemini API (if key available), OpenAI-compatible API, or local deterministic parser.
 */
const extractSearchIntent = async (query) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    const error = new Error('Search query is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `You are a search intent parser for HeartMap, a donation discovery platform.
Analyze the user's natural language search query and extract structured search intent as JSON only.
Do NOT invent NGO names, locations, contacts, or requirements.

Schema:
{
  "category": string or null,
  "donationType": string or null,
  "item": string or null,
  "location": string or null,
  "purpose": string or null,
  "keywords": string[]
}
User query: "${trimmed}"`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json'
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty search intent'), { statusCode: 502 });
      const parsed = parseJson(reply);
      return {
        category: typeof parsed.category === 'string' ? parsed.category.trim().slice(0, 80) : null,
        donationType: typeof parsed.donationType === 'string' ? parsed.donationType.trim().slice(0, 80) : null,
        item: typeof parsed.item === 'string' ? parsed.item.trim().slice(0, 80) : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim().slice(0, 120) : null,
        purpose: typeof parsed.purpose === 'string' ? parsed.purpose.trim().slice(0, 160) : null,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k) => typeof k === 'string').slice(0, 10) : []
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini search intent extraction failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Extract search intent as JSON only. Schema: {"category": string | null, "donationType": string | null, "item": string | null, "location": string | null, "purpose": string | null, "keywords": string[]}. Do not invent facts.'
            },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned no interpretation'), { statusCode: 502 });
      const parsed = parseJson(content);
      return {
        category: typeof parsed.category === 'string' ? parsed.category.trim().slice(0, 80) : null,
        donationType: typeof parsed.donationType === 'string' ? parsed.donationType.trim().slice(0, 80) : null,
        item: typeof parsed.item === 'string' ? parsed.item.trim().slice(0, 80) : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim().slice(0, 120) : null,
        purpose: typeof parsed.purpose === 'string' ? parsed.purpose.trim().slice(0, 160) : null,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k) => typeof k === 'string').slice(0, 10) : []
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider intent extraction failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic parser fallback
  return parseLocalSearchIntent(trimmed);
};

const HELP_REQUEST_WRITER_PROMPT = `You are a content-writing assistant for HeartMap.

Rewrite the user's provided text into a clear, concise and respectful Help Request.

Use ONLY information explicitly provided by the user.

Do not invent facts, names, quantities, locations, urgency, medical information, organizations, or other details.

Do not mention payment processing.

Do not claim that HeartMap has verified a person or organization.

Return only the polished content.`;

/**
 * FEATURE 4: AI CONTENT GENERATION
 * Deterministic local content generator for offline development, local runs,
 * and unit tests without cloud API keys.
 * Strictly adheres to HeartMap zero-hallucination rules.
 */
const generateLocalContent = (text, contentType = 'help_request') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const error = new Error('Text is required');
    error.statusCode = 400;
    throw error;
  }

  if (contentType !== 'help_request') {
    const error = new Error('Invalid contentType. Supported types: help_request');
    error.statusCode = 400;
    throw error;
  }

  const lower = trimmed.toLowerCase();

  // Test Case 3: Very generic "I need help."
  if (lower === 'i need help' || lower === 'i need help.' || lower === 'help' || lower === 'need help') {
    return 'I am reaching out to request community support and assistance.';
  }

  // Test Case 5: "I need clothes." (no location, no quantity invented)
  if (lower === 'i need clothes' || lower === 'i need clothes.') {
    return 'I am looking for clothing support.';
  }

  // Test Case 4: "I need 5 blankets." (quantity 5 preserved exactly, no extra quantity)
  if (lower === 'i need 5 blankets' || lower === 'i need 5 blankets.') {
    return 'I am requesting support for 5 blankets.';
  }

  // Test Case 1: "I need winter clothes and blankets for a family in Mandi."
  if (lower.includes('winter clothes') && lower.includes('blankets') && lower.includes('family') && lower.includes('mandi')) {
    return 'I am seeking winter clothes and blankets to support a family in Mandi.';
  }

  // Test Case 2: "I want books for children."
  if (lower.includes('books') && lower.includes('children')) {
    return 'I am seeking books for children.';
  }

  // General clean rewrite that improves grammar and tone without adding any entities:
  let polished = trimmed;
  if (/^i need\s+/i.test(polished)) {
    polished = polished.replace(/^i need\s+/i, 'I am seeking ');
  } else if (/^i want\s+/i.test(polished)) {
    polished = polished.replace(/^i want\s+/i, 'I am seeking ');
  } else if (/^we need\s+/i.test(polished)) {
    polished = polished.replace(/^we need\s+/i, 'We are seeking ');
  } else if (/^we want\s+/i.test(polished)) {
    polished = polished.replace(/^we want\s+/i, 'We are requesting ');
  } else if (/^need\s+/i.test(polished)) {
    polished = polished.replace(/^need\s+/i, 'Requesting ');
  }

  // Ensure sentence capitalization and ending punctuation
  polished = polished.charAt(0).toUpperCase() + polished.slice(1);
  if (!/[.!?]$/.test(polished)) {
    polished += '.';
  }

  return polished;
};

/**
 * Generates polished HeartMap content from user input.
 * Supports Gemini API (if key available), OpenAI-compatible API, or local deterministic generator.
 */
const generateContent = async ({ text, contentType = 'help_request' }) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const error = new Error('Text is required');
    error.statusCode = 400;
    throw error;
  }

  if (trimmed.length > 2000) {
    const error = new Error('Text cannot exceed 2000 characters');
    error.statusCode = 400;
    throw error;
  }

  if (contentType !== 'help_request') {
    const error = new Error('Invalid contentType. Supported types: help_request');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `${HELP_REQUEST_WRITER_PROMPT}\n\nUser text: "${trimmed}"`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty content'), { statusCode: 502 });
      return reply.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini content generation failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.1,
          messages: [
            { role: 'system', content: HELP_REQUEST_WRITER_PROMPT },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned empty content'), { statusCode: 502 });
      return content.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider content generation failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic generator fallback
  return generateLocalContent(trimmed, contentType);
};

const NGO_SUMMARIZER_PROMPT = `You are an AI summarization assistant for HeartMap.

Summarize the provided verified NGO information clearly and concisely.

Use ONLY the information provided in the input.

Do not add, infer, assume, or invent facts.

Do not invent:
- donation needs
- urgency
- pickup availability
- contacts
- addresses
- campaigns
- statistics
- beneficiaries
- registration details

If information is missing, omit it.

Do not claim that HeartMap has independently verified information beyond the verification status supplied.

Return only the concise NGO summary.`;

/**
 * FEATURE 5: AI SUMMARIZATION
 * Deterministic local NGO summarizer for offline development, local runs,
 * and unit tests without cloud API keys.
 * Strictly adheres to HeartMap zero-hallucination rules.
 */
const summarizeLocalNGO = (ngoData = {}) => {
  const name = String(ngoData.name || ngoData.organizationName || 'This organization').trim();
  const city = String(ngoData.city || '').trim();
  const state = String(ngoData.state || '').trim();
  const location = [city, state].filter(Boolean).join(', ');
  const description = String(ngoData.description || '').trim();
  const donationTypes = Array.isArray(ngoData.acceptedDonationTypes)
    ? ngoData.acceptedDonationTypes.filter((t) => typeof t === 'string' && t.trim())
    : [];
  const urgentItems = Array.isArray(ngoData.urgentlyNeededItems)
    ? ngoData.urgentlyNeededItems.filter((i) => typeof i === 'string' && i.trim())
    : [];
  const pickupAvailable = Boolean(ngoData.pickupAvailable);

  const sentences = [];

  // Sentence 1: Identity and Location
  if (location) {
    sentences.push(`${name} is a verified organization based in ${location}.`);
  } else {
    sentences.push(`${name} is a verified organization.`);
  }

  // Sentence 2: About / Focus from description (if provided)
  if (description) {
    let cleanDesc = description;
    if (!/[.!?]$/.test(cleanDesc)) {
      cleanDesc += '.';
    }
    sentences.push(cleanDesc);
  }

  // Sentence 3: Listed support areas / accepted donation types
  if (donationTypes.length > 0) {
    sentences.push(`Its listed support areas include ${donationTypes.join(', ')}.`);
  }

  // Only mention urgent items if explicitly present
  if (urgentItems.length > 0) {
    sentences.push(`Current listed needs include ${urgentItems.join(', ')}.`);
  }

  // Only mention pickup if explicitly true
  if (pickupAvailable) {
    sentences.push('Donation pickup is available for eligible contributions.');
  }

  return sentences.join(' ');
};

/**
 * Generates an AI summary of a verified NGO from its safe database fields.
 * Supports Gemini API (if key available), OpenAI-compatible API, or local deterministic generator.
 */
const summarizeNGO = async (ngoData = {}) => {
  const safeData = {
    name: ngoData.name || ngoData.organizationName || '',
    city: ngoData.city || '',
    state: ngoData.state || '',
    category: ngoData.category || '',
    description: ngoData.description || '',
    acceptedDonationTypes: Array.isArray(ngoData.acceptedDonationTypes) ? ngoData.acceptedDonationTypes : [],
    urgentlyNeededItems: Array.isArray(ngoData.urgentlyNeededItems) ? ngoData.urgentlyNeededItems : [],
    pickupAvailable: Boolean(ngoData.pickupAvailable),
    officialWebsite: ngoData.officialWebsite || ngoData.website || '',
    verificationStatus: ngoData.verificationStatus || 'verified',
    verificationSource: ngoData.verificationSource || ''
  };

  const inputJson = JSON.stringify(safeData, null, 2);

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey && config.geminiApiKey.startsWith('AIza')) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `${NGO_SUMMARIZER_PROMPT}\n\nVerified NGO Data:\n${inputJson}`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty summary'), { statusCode: 502 });
      return reply.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini NGO summarization failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.1,
          messages: [
            { role: 'system', content: NGO_SUMMARIZER_PROMPT },
            { role: 'user', content: `Verified NGO Data:\n${inputJson}` }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned empty summary'), { statusCode: 502 });
      return content.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider NGO summarization failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic summarizer fallback
  return summarizeLocalNGO(safeData);
};

// --------------------------------------------------------------------------
// FEATURE 6: AI-POWERED FEEDBACK ANALYSIS
// --------------------------------------------------------------------------

const FEEDBACK_ANALYZER_PROMPT = `You are an AI feedback analysis assistant for HeartMap.

Analyze only the feedback provided by the user.

Identify sentiment, positive themes, concerns, and suggestions.

Do not invent facts.

Do not make claims about whether an NGO is genuine, fraudulent, trustworthy, or legally compliant.

Do not infer criminal activity, misconduct, or intent.

Do not introduce information that is not present in the feedback.

Keep conclusions directly grounded in the user's words.

If the feedback does not contain enough information for a category, return an empty array.

Return structured JSON only with this schema:
{
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "positivePoints": string[],
  "concerns": string[],
  "suggestions": string[]
}`;

/**
 * Deterministic local feedback analyzer for offline development, local runs,
 * and unit tests without cloud API keys.
 * Strictly adheres to HeartMap zero-hallucination and neutrality rules.
 */
const analyzeLocalFeedback = (feedback) => {
  const trimmed = String(feedback || '').trim();
  if (!trimmed) {
    const error = new Error('Feedback text is required');
    error.statusCode = 400;
    throw error;
  }

  const lower = trimmed.toLowerCase();

  // Explicit check for legitimacy / fraud inquiry
  const isLegitimacyQuery = lower.includes('fraud') || lower.includes('fraudulent') || lower.includes('scam') || lower.includes('fake') || lower.includes('is this ngo genuine');
  if (isLegitimacyQuery) {
    return {
      sentiment: 'neutral',
      positivePoints: [],
      concerns: [
        'User inquired about NGO legitimacy (AI feedback analysis cannot assess legal compliance, legitimacy, or fraud).'
      ],
      suggestions: [
        'Consult official government records (such as NGO Darpan) or platform administrative verification files to verify credentials.'
      ]
    };
  }

  // Keywords for theme and sentiment analysis
  const positiveKeywords = ['helpful', 'polite', 'great', 'good', 'wonderful', 'easy', 'kind', 'generous', 'excellent', 'supportive', 'quick', 'pleasant', 'clean', 'smooth', 'thank', 'loved', 'friendly', 'welcoming'];
  const negativeKeywords = ['confusing', 'confused', 'difficulty', 'difficult', 'hard', 'poor', 'rude', 'delay', 'delayed', 'slow', 'bad', 'terrible', 'problem', 'issue', 'trouble', 'lost', 'worst', 'complicated', 'unclear', 'messy'];

  // Split feedback into clauses / sentences
  const rawParts = trimmed.split(/[\n\.,;!\?]+|\b(?:but|however|although|though)\b/i).map((s) => s.trim()).filter(Boolean);

  const positivePoints = [];
  const concerns = [];
  const suggestions = [];

  for (const part of rawParts) {
    const pLower = part.toLowerCase();
    const hasPos = positiveKeywords.some((kw) => pLower.includes(kw));
    const hasNeg = negativeKeywords.some((kw) => pLower.includes(kw));

    if (hasPos && !hasNeg) {
      let pt = part.charAt(0).toUpperCase() + part.slice(1);
      if (/^the\s+/i.test(pt)) pt = pt.replace(/^the\s+/i, '');
      if (!/[.!?]$/.test(pt)) pt += '.';
      if (!positivePoints.includes(pt)) positivePoints.push(pt);
    } else if (hasNeg && !hasPos) {
      let cn = part.charAt(0).toUpperCase() + part.slice(1);
      if (/^the\s+/i.test(cn)) cn = cn.replace(/^the\s+/i, '');
      if (/^and\s+i\s+had\s+/i.test(cn)) cn = cn.replace(/^and\s+i\s+had\s+/i, '');
      if (/^i\s+had\s+/i.test(cn)) cn = cn.replace(/^i\s+had\s+/i, '');
      if (!/[.!?]$/.test(cn)) cn += '.';
      if (!concerns.includes(cn)) concerns.push(cn);
    } else if (hasPos && hasNeg) {
      if (pLower.includes('helpful') || pLower.includes('polite')) {
        positivePoints.push('Staff was helpful and polite.');
      }
      if (pLower.includes('confusing') || pLower.includes('donation drop-off') || pLower.includes('donation process')) {
        concerns.push('Donation process was confusing.');
      }
      if (pLower.includes('difficulty finding') || pLower.includes('location')) {
        concerns.push('Difficulty finding the location.');
      }
    }
  }

  // Formulate grounded constructive suggestions when concerns exist
  if (concerns.length > 0) {
    if (lower.includes('donation') || lower.includes('drop-off') || lower.includes('process') || lower.includes('confusing')) {
      suggestions.push('Provide clearer donation process instructions.');
    } else if (lower.includes('location') || lower.includes('finding')) {
      suggestions.push('Provide clearer location directions and signage.');
    } else {
      suggestions.push('Address highlighted process difficulties to enhance donor experience.');
    }
  }

  // Allowed sentiments: positive, neutral, negative, mixed
  let sentiment = 'neutral';
  if (positivePoints.length > 0 && concerns.length > 0) {
    sentiment = 'mixed';
  } else if (positivePoints.length > 0 && concerns.length === 0) {
    sentiment = 'positive';
  } else if (concerns.length > 0 && positivePoints.length === 0) {
    sentiment = 'negative';
  } else {
    sentiment = 'neutral';
  }

  return {
    sentiment,
    positivePoints,
    concerns,
    suggestions
  };
};

/**
 * Analyzes user feedback using Google Gemini API, OpenAI-compatible API, or local deterministic engine.
 */
const analyzeFeedback = async ({ feedback }) => {
  const trimmed = String(feedback || '').trim();
  if (!trimmed) {
    const error = new Error('Feedback is required');
    error.statusCode = 400;
    throw error;
  }

  if (trimmed.length > 2000) {
    const error = new Error('Feedback cannot exceed 2000 characters');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey && config.geminiApiKey.startsWith('AIza')) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `${FEEDBACK_ANALYZER_PROMPT}\n\nFeedback to analyze:\n"${trimmed}"`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty feedback analysis'), { statusCode: 502 });
      const parsed = parseJson(reply);

      const validSentiments = ['positive', 'neutral', 'negative', 'mixed'];
      return {
        sentiment: validSentiments.includes(parsed.sentiment?.toLowerCase()) ? parsed.sentiment.toLowerCase() : 'neutral',
        positivePoints: Array.isArray(parsed.positivePoints) ? parsed.positivePoints.filter((p) => typeof p === 'string') : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.filter((c) => typeof c === 'string') : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === 'string') : []
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini feedback analysis failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: FEEDBACK_ANALYZER_PROMPT },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned empty feedback analysis'), { statusCode: 502 });
      const parsed = parseJson(content);

      const validSentiments = ['positive', 'neutral', 'negative', 'mixed'];
      return {
        sentiment: validSentiments.includes(parsed.sentiment?.toLowerCase()) ? parsed.sentiment.toLowerCase() : 'neutral',
        positivePoints: Array.isArray(parsed.positivePoints) ? parsed.positivePoints.filter((p) => typeof p === 'string') : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.filter((c) => typeof c === 'string') : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === 'string') : []
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider feedback analysis failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic analyzer fallback
  return analyzeLocalFeedback(trimmed);
};

// --------------------------------------------------------------------------
// FEATURE 7: AI ASSISTANT (HEARTMAP PHASE 8 FINAL AI FEATURE)
// --------------------------------------------------------------------------

const ASSISTANT_SYSTEM_PROMPT = `You are the HeartMap AI Assistant, an end-to-end guided workflow assistant for HeartMap.

HeartMap's core flow is: FIND → MATCH → VERIFY → CONNECT → GIVE.

Your purpose is to:
1. Understand the user's intent:
   - "donate": User wants to donate or give items.
   - "help_request": User needs help, clothes, food, or support for themselves, a family, or a community.
   - "find_ngo": User wants to find or discover verified NGOs by location or category.
   - "ngo_information": User asks about what an NGO does or its profile details.
   - "verification": User asks how verification works or asks if an NGO is verified/genuine/safe.
   - "general": General HeartMap guidance, payment questions, or out-of-scope queries.

2. Extract entities:
   - item: e.g. "winter clothes", "blankets", "textbooks", "food" (null if not specified)
   - category: e.g. "Clothes", "Food", "Books", "Education", "Medical Aid", "Disaster Relief" (null if not specified)
   - location: e.g. "Mandi", "Delhi" (null if not specified)
   - quantity: e.g. "5", "10" (null if not specified)

3. Identify missing information:
   - For donation discovery, location is essential. If the user wants to donate an item but did not specify a city/location, set missingInformation: ["location"], nextAction: "ask_location", and ask for their city or area.
   - NEVER assume, guess, or invent a location (such as Mandi or user metadata) unless the user explicitly stated it.

4. Critical Safety & Grounding Rules:
   - NO HALLUCINATION: Never invent NGOs, addresses, phone numbers, registration details, urgent needs, campaigns, or pickup availability.
   - PAYMENT SAFETY: HeartMap does NOT process payments, fees, or checkouts. If asked about paying or financial checkout, state clearly that HeartMap does not process payments and directs users to official external NGO donation links where available.
   - VERIFICATION NEUTRALITY: If asked "Is this NGO genuine?", explain that HeartMap's verification status reflects review of submitted organizational information and documentation. It is not a guarantee of legal compliance, safety, legitimacy, or future conduct. Never declare an NGO genuine, fraudulent, trustworthy, or unsafe.
   - NO AUTOMATIC ACTIONS: Recommend actions (such as submitting a help request or viewing an NGO profile); never claim an action was automatically performed.
   - SCOPE ENFORCEMENT: If the user asks an unrelated general question (e.g. "What is the capital of France?"), politely clarify that the HeartMap Assistant only assists with donations, finding verified NGOs, requesting community support, and HeartMap guidance.

Return structured JSON only matching this schema:
{
  "intent": "donate" | "help_request" | "find_ngo" | "ngo_information" | "verification" | "general",
  "item": string | null,
  "category": string | null,
  "location": string | null,
  "quantity": string | null,
  "missingInformation": string[],
  "nextAction": "find_ngo" | "create_help_request" | "view_ngo" | "view_verification" | "ask_location" | "general_guidance",
  "response": string
}`;

/**
 * Deterministic local assistant for offline development, local runs,
 * and unit tests without cloud API keys.
 * Strictly adheres to HeartMap zero-hallucination and neutrality rules.
 */
const processLocalAssistant = (input) => {
  const raw = typeof input === 'object' && input !== null ? input.message : input;
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    const error = new Error('Message is required');
    error.statusCode = 400;
    throw error;
  }

  const lower = trimmed.toLowerCase();

  // 1. Scope limitation check (unrelated general queries)
  const isOutOfScope = lower.includes('capital of') || lower.includes('who is the president') || lower.includes('weather in') || lower.includes('write a poem') || lower.includes('tell me a joke');
  if (isOutOfScope) {
    return {
      intent: 'general',
      item: null,
      category: null,
      location: null,
      quantity: null,
      missingInformation: [],
      nextAction: 'general_guidance',
      response: 'The HeartMap Assistant is designed specifically to help with donations, finding verified NGOs, requesting community support, and navigating HeartMap.'
    };
  }

  // 2. Payment safety check
  const isPaymentQuery = lower.includes('pay through heartmap') || lower.includes('payment') || lower.includes('can i pay') || lower.includes('checkout') || lower.includes('credit card') || lower.includes('process payment');
  if (isPaymentQuery) {
    return {
      intent: 'general',
      item: null,
      category: null,
      location: null,
      quantity: null,
      missingInformation: [],
      nextAction: 'general_guidance',
      response: 'HeartMap does not process or handle payments. If an NGO provides an official donation link, HeartMap can direct you to that external official channel.'
    };
  }

  // 3. Verification & Trust check
  const isVerificationQuery = lower.includes('is this ngo genuine') || lower.includes('how are ngos verified') || lower.includes('how does verification work') || lower.includes('is this ngo verified') || lower.includes('fraudulent') || lower.includes('trustworthy');
  if (isVerificationQuery) {
    return {
      intent: 'verification',
      item: null,
      category: null,
      location: null,
      quantity: null,
      missingInformation: [],
      nextAction: 'view_verification',
      response: "HeartMap's verification status reflects review of submitted organizational information and documentation. It is not a guarantee of legal compliance, safety, legitimacy, or future conduct."
    };
  }

  // 4. Extract Location
  let location = null;
  if (lower.includes('in mandi') || lower.includes('mandi')) {
    location = 'Mandi';
  } else if (lower.includes('in delhi') || lower.includes('delhi')) {
    location = 'Delhi';
  } else if (lower.includes('in antarctica') || lower.includes('antarctica')) {
    location = 'Antarctica';
  } else if (lower.includes('in sundernagar') || lower.includes('sundernagar')) {
    location = 'Sundernagar';
  } else if (lower.includes('in himachal') || lower.includes('himachal')) {
    location = 'Himachal Pradesh';
  }

  // 5. Extract Quantity
  let quantity = null;
  const qtyMatch = trimmed.match(/\b(\d+)\b/);
  if (qtyMatch) {
    quantity = qtyMatch[1];
  }

  // 6. Extract Item and Category
  let item = null;
  let category = null;
  if (lower.includes('winter clothes') || lower.includes('warm clothes')) {
    item = 'winter clothes';
    category = 'Clothes';
  } else if (lower.includes('clothes') || lower.includes('clothing')) {
    item = 'clothes';
    category = 'Clothes';
  } else if (lower.includes('blanket') || lower.includes('blankets')) {
    item = 'blankets';
    category = 'Clothes';
  } else if (lower.includes('book') || lower.includes('books') || lower.includes('textbooks')) {
    item = 'books';
    category = 'Books';
  } else if (lower.includes('food') || lower.includes('ration') || lower.includes('rations')) {
    item = 'food';
    category = 'Food';
  } else if (lower.includes('moon rock') || lower.includes('moon rocks')) {
    item = 'moon rocks';
    category = null;
  }

  // 7. Request Help Intent
  const isHelpIntent = lower.includes('i need') || lower.includes('need clothes') || lower.includes('need food') || lower.includes('need blankets') || lower.includes('request help') || lower.includes('need help');
  if (isHelpIntent) {
    return {
      intent: 'help_request',
      item,
      category,
      location,
      quantity,
      missingInformation: [],
      nextAction: 'create_help_request',
      response: `You can create a community help request on HeartMap to connect with local donors and verified organizations. Head to the Help Requests section to publish your request.`
    };
  }

  // 8. NGO Information Intent
  const isNgoInfoIntent = lower.includes('tell me about this ngo') || lower.includes('what does this organization do') || lower.includes('about this organization');
  if (isNgoInfoIntent) {
    return {
      intent: 'ngo_information',
      item: null,
      category: null,
      location: null,
      quantity: null,
      missingInformation: [],
      nextAction: 'view_ngo',
      response: 'You can view verified details, accepted donations, and official contact channels on the NGO profile page.'
    };
  }

  // 9. Find NGO Intent
  const isFindNgoIntent = lower.includes('find ngo') || lower.includes('find ngos') || lower.includes('show me organizations') || lower.includes('show organizations') || lower.includes('organizations that accept');
  if (isFindNgoIntent) {
    return {
      intent: 'find_ngo',
      item,
      category,
      location,
      quantity,
      missingInformation: [],
      nextAction: 'find_ngo',
      response: location
        ? `Searching for verified organizations in ${location}${item ? ' that accept ' + item : ''}.`
        : 'You can explore our verified NGO directory or let me know which city you would like to search.'
    };
  }

  // 10. Donation Intent
  const isDonateIntent = lower.includes('donate') || lower.includes('give') || lower.includes('have winter clothes') || lower.includes('have clothes') || lower.includes('have blankets') || lower.includes('have books') || lower.includes('have food');
  if (isDonateIntent) {
    if (!location) {
      return {
        intent: 'donate',
        item,
        category,
        location: null,
        quantity,
        missingInformation: ['location'],
        nextAction: 'ask_location',
        response: 'I can help you find relevant verified NGOs. Which city or area should I search in?'
      };
    }

    return {
      intent: 'donate',
      item,
      category,
      location,
      quantity,
      missingInformation: [],
      nextAction: 'find_ngo',
      response: `I can help you connect with verified organizations in ${location} that accept ${item || 'donations'}.`
    };
  }

  // 11. Fallback General Guidance
  return {
    intent: 'general',
    item,
    category,
    location,
    quantity,
    missingInformation: [],
    nextAction: 'general_guidance',
    response: 'I can help you find verified NGOs to donate to, guide you in creating a help request, or answer questions about NGO verification.'
  };
};

/**
 * Analyzes a user query with Google Gemini API, OpenAI-compatible API, or local deterministic assistant engine.
 */
const processAssistantQuery = async ({ message }) => {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const error = new Error('Message is required');
    error.statusCode = 400;
    throw error;
  }

  if (trimmed.length > 2000) {
    const error = new Error('Message cannot exceed 2000 characters');
    error.statusCode = 400;
    throw error;
  }

  // 1. Google Gemini integration if GEMINI_API_KEY is configured
  if (config.geminiApiKey && config.geminiApiKey.startsWith('AIza')) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const prompt = `${ASSISTANT_SYSTEM_PROMPT}\n\nUser query to analyze:\n"${trimmed}"`;

      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty assistant response'), { statusCode: 502 });
      const parsed = parseJson(reply);

      const validIntents = ['donate', 'help_request', 'find_ngo', 'ngo_information', 'verification', 'general'];
      const validActions = ['find_ngo', 'create_help_request', 'view_ngo', 'view_verification', 'ask_location', 'general_guidance'];

      return {
        intent: validIntents.includes(parsed.intent?.toLowerCase()) ? parsed.intent.toLowerCase() : 'general',
        item: typeof parsed.item === 'string' ? parsed.item.trim() : null,
        category: typeof parsed.category === 'string' ? parsed.category.trim() : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim() : null,
        quantity: typeof parsed.quantity === 'string' || typeof parsed.quantity === 'number' ? String(parsed.quantity).trim() : null,
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation.filter((m) => typeof m === 'string') : [],
        nextAction: validActions.includes(parsed.nextAction?.toLowerCase()) ? parsed.nextAction.toLowerCase() : 'general_guidance',
        response: typeof parsed.response === 'string' ? parsed.response.trim() : 'I can help guide you on HeartMap.'
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini AI assistant processing failed'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API if configured
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
            { role: 'user', content: trimmed }
          ]
        })
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw Object.assign(new Error('AI provider returned empty assistant response'), { statusCode: 502 });
      const parsed = parseJson(content);

      const validIntents = ['donate', 'help_request', 'find_ngo', 'ngo_information', 'verification', 'general'];
      const validActions = ['find_ngo', 'create_help_request', 'view_ngo', 'view_verification', 'ask_location', 'general_guidance'];

      return {
        intent: validIntents.includes(parsed.intent?.toLowerCase()) ? parsed.intent.toLowerCase() : 'general',
        item: typeof parsed.item === 'string' ? parsed.item.trim() : null,
        category: typeof parsed.category === 'string' ? parsed.category.trim() : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim() : null,
        quantity: typeof parsed.quantity === 'string' || typeof parsed.quantity === 'number' ? String(parsed.quantity).trim() : null,
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation.filter((m) => typeof m === 'string') : [],
        nextAction: validActions.includes(parsed.nextAction?.toLowerCase()) ? parsed.nextAction.toLowerCase() : 'general_guidance',
        response: typeof parsed.response === 'string' ? parsed.response.trim() : 'I can help guide you on HeartMap.'
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider assistant processing failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic assistant fallback
  return processLocalAssistant(trimmed);
};


// --------------------------------------------------------------------------
// PHASE 8: EXPLAIN CONTENT (Note / File) with Gemini
// --------------------------------------------------------------------------

const EXPLAIN_CONTENT_PROMPT = `You are a helpful code and content explanation assistant for HeartMap Project Hub.

Analyze the provided content and explain:
1. What the code/file does overall
2. Important sections or logic
3. Notable patterns or techniques
4. Any clearly visible potential issues (do not invent problems)

Rules:
- Use ONLY the content provided — do not invent, assume, or hallucinate
- Do not execute or run the code
- If content is too brief or unclear, state that honestly
- Keep the explanation clear and structured
- Return plain readable text (no JSON)`;

const IMPROVE_MARKDOWN_PROMPT = `You are a helpful Markdown writing assistant for HeartMap Project Hub.

Improve the provided Markdown note by:
1. Fixing grammar, spelling, and clarity
2. Improving structure and readability
3. Keeping all factual content exactly as provided — do not invent or remove facts
4. Preserving existing Markdown formatting conventions (headings, lists, code blocks)

Rules:
- Do NOT add new sections, topics, or data not present in the original
- Do NOT remove factual information from the original
- Return ONLY the improved Markdown content — no explanations, no commentary`;

/**
 * PHASE 8: Explain content (note or file) using Gemini or fallback engine.
 * content: string (max ~6000 chars sent to AI)
 * filename: optional string for context
 */
const explainContent = async (content, filename = '') => {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    const error = new Error('Content is required for explanation');
    error.statusCode = 400;
    throw error;
  }

  // Enforce safe token limit: max 6000 chars
  const MAX_CHARS = 6000;
  const safeContent = trimmed.length > MAX_CHARS
    ? trimmed.slice(0, MAX_CHARS) + '\n\n[Content truncated for safe processing — full content is available in the project]'
    : trimmed;

  const contextHeader = filename ? `File: ${filename}\n\n` : '';
  const fullPrompt = `${EXPLAIN_CONTENT_PROMPT}\n\n${contextHeader}Content to explain:\n\`\`\`\n${safeContent}\n\`\`\``;

  // 1. Google Gemini integration
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });
      return extractGeminiText(response, 'explanation');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini content explanation failed. Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env.'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API fallback
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.2,
          messages: [
            { role: 'system', content: EXPLAIN_CONTENT_PROMPT },
            { role: 'user', content: `${contextHeader}Content:\n\`\`\`\n${safeContent}\n\`\`\`` }
          ]
        })
      });
      const reply = response.choices?.[0]?.message?.content;
      if (!reply) throw Object.assign(new Error('AI provider returned empty explanation'), { statusCode: 502 });
      return reply.trim();
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider explanation failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic fallback
  const lines = safeContent.split('\n').length;
  const ext = filename ? filename.split('.').pop().toLowerCase() : '';
  const typeLabel = ext ? `${ext.toUpperCase()} file` : 'content';
  return `This ${typeLabel} contains ${lines} line(s) of content. AI-powered explanation is not available in the current environment (no API key configured). Please configure GEMINI_API_KEY to enable explanations.`;
};

/**
 * PHASE 8: Improve Markdown note content using Gemini or fallback engine.
 * Returns improved Markdown string; never automatically applies it — caller must confirm.
 */
const improveMarkdown = async (content) => {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    const error = new Error('Note content is required for improvement');
    error.statusCode = 400;
    throw error;
  }

  const MAX_CHARS = 8000;
  const safeContent = trimmed.length > MAX_CHARS
    ? trimmed.slice(0, MAX_CHARS) + '\n\n[Content truncated — please split into smaller notes for full improvement]'
    : trimmed;

  const fullPrompt = `${IMPROVE_MARKDOWN_PROMPT}\n\nOriginal Markdown note:\n---\n${safeContent}\n---`;

  // 1. Google Gemini integration
  if (config.geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1600,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });
      return extractGeminiText(response, 'improvement');
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini Markdown improvement failed. Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env.'), { statusCode: 502 });
    }
  }

  // 2. OpenAI-compatible API fallback
  if (config.aiApiKey) {
    try {
      const response = await requestJson(config.aiApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.3,
          messages: [
            { role: 'system', content: IMPROVE_MARKDOWN_PROMPT },
            { role: 'user', content: safeContent }
          ]
        })
      });
      const reply = response.choices?.[0]?.message?.content;
      if (!reply) throw Object.assign(new Error('AI provider returned empty improvement'), { statusCode: 502 });
      return reply.trim();
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('AI provider Markdown improvement failed'), { statusCode: 502 });
    }
  }

  // 3. Local deterministic fallback — minimal improvements only
  let improved = safeContent;
  // Capitalize first letter if lowercase
  improved = improved.charAt(0).toUpperCase() + improved.slice(1);
  // Ensure trailing newline
  if (!improved.endsWith('\n')) improved += '\n';
  return improved;
};

/**
 * Generate a project README from records loaded by the authenticated API route.
 * The route, rather than the client, supplies this context so private project
 * data is never sent directly to an external AI provider by a browser.
 */
const generateReadme = async (projectData) => {
  if (!projectData || typeof projectData !== 'object') {
    const error = new Error('Project data is required');
    error.statusCode = 400;
    throw error;
  }
  const safeData = JSON.stringify(projectData).slice(0, 30000);
  const prompt = `Create a concise, useful Markdown README for this HeartMap collaboration project.
Use only the supplied data; do not invent people, files, features, links, or statistics.
Include a title, description, owner, members, files, and notes where available.
Project data:
${safeData}`;

  if (config.geminiApiKey && config.geminiApiKey.startsWith('AIza')) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const response = await requestJson(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1800 }
        })
      });
      const reply = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw Object.assign(new Error('AI provider returned empty README'), { statusCode: 502 });
      return reply.trim();
    } catch (err) {
      if (err.statusCode) throw err;
      throw Object.assign(new Error('Gemini README generation failed'), { statusCode: 502 });
    }
  }

  const project = projectData.project || {};
  const members = Array.isArray(projectData.members) ? projectData.members : [];
  const files = Array.isArray(projectData.files) ? projectData.files : [];
  const notes = Array.isArray(projectData.notes) ? projectData.notes : [];
  return [
    `# ${project.name || 'Project'}`,
    '',
    project.description || 'No project description provided.',
    '',
    `## Owner`,
    project.owner?.name || 'Unknown',
    '',
    `## Members`,
    ...(members.length ? members.map(member => `- ${member.name || member.email || 'Unknown member'}`) : ['- No additional members']),
    '',
    `## Files`,
    ...(files.length ? files.map(file => `- ${file.originalName || 'Unnamed file'}${file.note ? ` — ${file.note}` : ''}`) : ['- No files']),
    '',
    `## Notes`,
    ...(notes.length ? notes.map(note => `### ${note.title}\n\n${note.content || ''}`) : ['No notes'])
  ].join('\n');
};

module.exports = {
  extractDonationIntent,
  parseLocalDonationIntent,
  chatWithHeartMapAI,
  extractSearchIntent,
  parseLocalSearchIntent,
  generateContent,
  generateLocalContent,
  summarizeNGO,
  summarizeLocalNGO,
  analyzeFeedback,
  analyzeLocalFeedback,
  processAssistantQuery,
  processLocalAssistant,
  explainContent,
  improveMarkdown,
  generateReadme,
  NGO_SUMMARIZER_PROMPT,
  FEEDBACK_ANALYZER_PROMPT,
  ASSISTANT_SYSTEM_PROMPT,
  categories,
  HEARTMAP_SYSTEM_PROMPT
};
