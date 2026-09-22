const User = require('../models/User');
const NGOProfile = require('../models/NGOProfile');

/**
 * Curated Real NGO Dataset verified against official public sources:
 * - District Mandi, Government of Himachal Pradesh Official Portal (mandi.hp.gov.in / hpmandi.nic.in)
 * - Directorate for Empowerment of SCs, OBCs, Minorities & Specially Abled, HP (socialjustice.hp.gov.in)
 * - NITI Aayog NGO Darpan Registry (ngodarpan.gov.in)
 * - Official NGO portals (sakarsnr.com, sahyog.org, goonj.org)
 */
const seedDevDataIfEmpty = async () => {
  try {
    // Check if any fictional NGOs exist and clear them to guarantee data quality
    const fictionalNgos = await NGOProfile.find({
      organizationName: {
        $in: [
          'Himalayan Relief & Sewa Sansthan',
          'Mandi Community Care Foundation',
          'Delhi Annapurna Food Bank'
        ]
      }
    });

    // Purge fictional NGOs or stale seed records
    await NGOProfile.deleteMany({
      organizationName: {
        $in: [
          'Himalayan Relief & Sewa Sansthan',
          'Mandi Community Care Foundation',
          'Delhi Annapurna Food Bank',
          'Indian Red Cross Society, District Branch Mandi',
          'Sahyog Bal Shrawan and Viklang Kalyan Samiti',
          'Sakar Society for Differently Abled Persons',
          'Goonj'
        ]
      }
    });

    console.log('Seeding development database with curated REAL verified NGOs from public records...');

    // 1. Create demo donor user
    let demoUser = await User.findOne({ email: 'demo@heartmap.org' });
    if (!demoUser) {
      demoUser = new User({ name: 'Demo Donor', email: 'demo@heartmap.org', role: 'user' });
      await demoUser.setPassword('Password123');
      await demoUser.save();
    }

    // 2. Create demo admin user
    let demoAdmin = await User.findOne({ email: 'admin@heartmap.org' });
    if (!demoAdmin) {
      demoAdmin = new User({ name: 'HeartMap Admin', email: 'admin@heartmap.org', role: 'admin' });
      await demoAdmin.setPassword('AdminPassword123');
      await demoAdmin.save();
    }

    // 3. Create NGO representative accounts
    let redCrossUser = await User.findOne({ email: 'redcross.mandi@example.org' });
    if (!redCrossUser) {
      redCrossUser = new User({ name: 'Red Cross Mandi Rep', email: 'redcross.mandi@example.org', role: 'ngo' });
      await redCrossUser.setPassword('NgoPassword123');
      await redCrossUser.save();
    }

    let sahyogUser = await User.findOne({ email: 'sahyog.mandi@example.org' });
    if (!sahyogUser) {
      sahyogUser = new User({ name: 'Sahyog Mandi Rep', email: 'sahyog.mandi@example.org', role: 'ngo' });
      await sahyogUser.setPassword('NgoPassword123');
      await sahyogUser.save();
    }

    let sakarUser = await User.findOne({ email: 'sakar.mandi@example.org' });
    if (!sakarUser) {
      sakarUser = new User({ name: 'Sakar Society Rep', email: 'sakar.mandi@example.org', role: 'ngo' });
      await sakarUser.setPassword('NgoPassword123');
      await sakarUser.save();
    }

    let goonjUser = await User.findOne({ email: 'goonj.delhi@example.org' });
    if (!goonjUser) {
      goonjUser = new User({ name: 'Goonj Delhi Rep', email: 'goonj.delhi@example.org', role: 'ngo' });
      await goonjUser.setPassword('NgoPassword123');
      await goonjUser.save();
    }

    // 4. Seed Curated Real NGOs strictly verified against official public sources
    await NGOProfile.create([
      {
        user: redCrossUser._id,
        createdBy: redCrossUser._id,
        organizationName: 'Indian Red Cross Society, District Branch Mandi',
        name: 'Indian Red Cross Society, District Branch Mandi',
        description: 'Statutory humanitarian body providing emergency relief, medical assistance, and humanitarian support to vulnerable families across Mandi district.',
        category: 'Disaster Relief',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        address: 'District Red Cross Bhawan, DC Office Complex, Mandi, Himachal Pradesh - 175001',
        logo: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
        images: ['https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80'],
        officialWebsite: 'https://mandi.hp.gov.in',
        website: 'https://mandi.hp.gov.in',
        contact: '01905-225220',
        phone: '01905-225220',
        email: null, // Official district directory lists telephone desk
        registrationNumber: 'Statutory Body under Indian Red Cross Society Act XV of 1920 (Mandi District Branch)',
        sourceUrl: 'https://mandi.hp.gov.in',
        verificationSource: 'District Administration Mandi, Government of Himachal Pradesh Official Portal',
        verificationStatus: 'verified',
        lastVerifiedAt: new Date('2026-03-15T00:00:00.000Z'),
        acceptedDonationTypes: ['Disaster Relief', 'Medical Aid'],
        notAcceptedDonationTypes: ['Damaged goods', 'Expired medicines'],
        urgentlyNeededItems: [], // No current verified urgent item drive published on official portal; marked as Not specified
        requirements: [], // No specific packaging requirements officially documented
        pickupAvailable: false, // Doorstep pickup is not an official service
        dropOffAvailable: true,
        pickupAreas: [],
        isPublished: true
      },
      {
        user: sahyogUser._id,
        createdBy: sahyogUser._id,
        organizationName: 'Sahyog Bal Shrawan and Viklang Kalyan Samiti',
        name: 'Sahyog Bal Shrawan and Viklang Kalyan Samiti',
        description: 'Welfare society providing residential education, vocational rehabilitation, and essential supplies for speech, hearing impaired and specially-abled children.',
        category: 'Community',
        city: 'Mandi',
        state: 'Himachal Pradesh',
        address: '244/7, National Street, Near PNB, Moti Bazar, Mandi, Himachal Pradesh - 175001',
        logo: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        images: ['https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'],
        officialWebsite: 'http://sahyog.org',
        website: 'http://sahyog.org',
        contact: '+91 94180 23539',
        phone: '+91 94180 23539',
        email: 'nsharma@sahyog.org',
        registrationNumber: 'Reg No. 22/92 (HP Societies Registration Act)',
        sourceUrl: 'https://mandi.hp.gov.in',
        verificationSource: 'District Administration Mandi Portal (hpmandi.nic.in) & HP Social Justice Department',
        verificationStatus: 'verified',
        lastVerifiedAt: new Date('2026-03-15T00:00:00.000Z'),
        acceptedDonationTypes: ['Educational Supplies', 'Books', 'Disability Aid'],
        notAcceptedDonationTypes: ['Commercial products', 'Damaged items'],
        urgentlyNeededItems: [], // No active urgent item drive documented; marked as Not specified
        requirements: [],
        pickupAvailable: false,
        dropOffAvailable: true,
        pickupAreas: [],
        isPublished: true
      },
      {
        user: sakarUser._id,
        createdBy: sakarUser._id,
        organizationName: 'Sakar Society for Differently Abled Persons',
        name: 'Sakar Society for Differently Abled Persons',
        description: 'Dedicated day-care and therapy center supporting children and adults with intellectual and developmental challenges through education and specialized therapies.',
        category: 'Community',
        city: 'Sundernagar',
        state: 'Himachal Pradesh',
        address: 'Village Dodhwan, Gram Panchayat Kapahi, Tehsil Sundernagar, District Mandi, Himachal Pradesh - 175018',
        logo: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80',
        images: ['https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80'],
        officialWebsite: 'https://www.sakarsnr.com',
        website: 'https://www.sakarsnr.com',
        contact: '+91 98160-18605',
        phone: '+91 98160-18605',
        email: 'sakarsociety@yahoo.in',
        registrationNumber: 'Society Reg. No. 518/2008 (HP Societies Registration Act)',
        sourceUrl: 'https://www.sakarsnr.com',
        verificationSource: 'District Mandi Administration Directory (mandi.hp.gov.in) & Sakar Society Official Portal',
        verificationStatus: 'verified',
        lastVerifiedAt: new Date('2026-03-15T00:00:00.000Z'),
        acceptedDonationTypes: ['Educational Supplies', 'Therapy Materials'],
        notAcceptedDonationTypes: ['Heavy industrial items', 'Perishable foods'],
        urgentlyNeededItems: [], // No active urgent item drive documented; marked as Not specified
        requirements: [],
        pickupAvailable: false,
        dropOffAvailable: true,
        pickupAreas: [],
        isPublished: true
      },
      {
        user: goonjUser._id,
        createdBy: goonjUser._id,
        organizationName: 'Goonj',
        name: 'Goonj',
        description: 'Renowned non-profit undertaking nationwide material mobilization, channelizing surplus urban resources like clothing, blankets, and school kits into rural disaster relief and community development.',
        category: 'Clothes',
        city: 'New Delhi',
        state: 'Delhi',
        address: 'J-93, Sarita Vihar, New Delhi - 110076',
        logo: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
        images: ['https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80'],
        officialWebsite: 'https://goonj.org',
        website: 'https://goonj.org',
        officialDonationUrl: 'https://goonj.org/donate',
        contact: '011-26972351',
        phone: '011-26972351',
        email: 'mail@goonj.org',
        registrationNumber: 'S-34658/1999 (NITI Aayog NGO Darpan ID: DL/2017/0152504)',
        sourceUrl: 'https://goonj.org',
        verificationSource: 'NITI Aayog NGO Darpan & Official Goonj Portal',
        verificationStatus: 'verified',
        lastVerifiedAt: new Date('2026-03-15T00:00:00.000Z'),
        acceptedDonationTypes: ['Clothes', 'Blankets', 'Woolens', 'Stationery', 'Dry Rations'],
        notAcceptedDonationTypes: ['Torn or soiled clothing', 'Single shoes', 'Perishable food'],
        urgentlyNeededItems: [], // Marked as Not specified unless active live drive is verified
        requirements: ['Clean and usable items; please pack properly before dropping off at collection center'],
        pickupAvailable: false, // Relies on dropping centers, not doorstep pickup
        dropOffAvailable: true,
        pickupAreas: [],
        isPublished: true
      }
    ]);

    console.log('Development database seeded successfully with 4 real curated verified NGOs from public records.');
  } catch (err) {
    console.error('Error seeding development database:', err);
  }
};

module.exports = { seedDevDataIfEmpty };
