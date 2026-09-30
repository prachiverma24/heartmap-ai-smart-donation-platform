export const demoNgos = [
  {
    _id: 'ngo-demo-1',
    name: 'Asha Community Shelter & Care',
    organizationName: 'Asha Community Shelter & Care',
    category: 'Shelter & Emergency Relief',
    description: 'Providing immediate shelter, warm meals, clean clothing, and reintegration support to unhoused families and youth across the metropolitan area.',
    address: '14 Baker Street, Central District',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.6139,
    longitude: 77.2090,
    acceptedDonationTypes: ['Clothes', 'Food', 'Other'],
    urgentlyNeededItems: ['Thermal blankets', 'Winter jackets', 'Packaged grains', 'Baby diapers'],
    verificationStatus: 'verified',
    verificationInformation: 'Verified 80G tax-exempt nonprofit registration and active physical facility inspection completed.',
    logo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    images: [
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=80'
    ],
    phone: '+91 11 2345 6789',
    email: 'contact@ashacare.org',
    website: 'https://ashacare.org',
    officialDonationUrl: 'https://ashacare.org/give',
    pickupAvailable: true,
    pickupAreas: ['Central Delhi', 'South Delhi', 'Noida'],
    dropOffAvailable: true
  },
  {
    _id: 'ngo-demo-2',
    name: 'Bright Horizons Youth & Literacy',
    organizationName: 'Bright Horizons Youth & Literacy',
    category: 'Education & Child Development',
    description: 'Empowering children from underserved communities with school libraries, digital literacy labs, study materials, and after-school mentorship.',
    address: '88 Riverfront Road, Near City Library',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    acceptedDonationTypes: ['Books', 'Electronics', 'Toys'],
    urgentlyNeededItems: ['STEM storybooks', 'Working laptops/tablets', 'Stationery kits', 'Science puzzles'],
    verificationStatus: 'verified',
    verificationInformation: 'Verified NGO DARPAN registration, annual educational audit, and school partnership certificates.',
    logo: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80',
    images: [
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=900&q=80'
    ],
    phone: '+91 80 4123 9876',
    email: 'hello@brighthorizons.in',
    website: 'https://brighthorizons.in',
    officialDonationUrl: 'https://brighthorizons.in/donate',
    pickupAvailable: true,
    pickupAreas: ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout'],
    dropOffAvailable: true
  },
  {
    _id: 'ngo-demo-3',
    name: 'Green Fork Food Rescue Network',
    organizationName: 'Green Fork Food Rescue Network',
    category: 'Food Security & Waste Reduction',
    description: 'Rescuing surplus fresh produce and non-perishable pantry items from grocers and events to feed community kitchens and marginalized neighborhoods.',
    address: '21 Harbor Way, Sector 4',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.0760,
    longitude: 72.8777,
    acceptedDonationTypes: ['Food'],
    urgentlyNeededItems: ['Lentils & pulses', 'Cooking oil', 'Rice sacks', 'Sealed spices'],
    verificationStatus: 'verified',
    verificationInformation: 'FSSAI food safety compliance verified, municipal partnership authorization on file.',
    logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    images: [
      'https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80'
    ],
    phone: '+91 22 2654 3210',
    email: 'team@greenforkrescue.org',
    website: 'https://greenforkrescue.org',
    officialDonationUrl: 'https://greenforkrescue.org/support',
    pickupAvailable: true,
    pickupAreas: ['Bandra', 'Andheri', 'Lower Parel', 'Dadar'],
    dropOffAvailable: true
  }
];

export const demoStories = [
  {
    _id: 'story-demo-1',
    title: 'Winter Warmth for Migrant Families',
    description: 'Providing heavy winter coats, thermal blankets, and clean boots to migrant worker settlements as temperatures drop.',
    fullStory: 'During harsh winter spells, hundreds of families residing in seasonal settlements lack basic heating and warm attire. Our volunteers distribute inspected, clean winter garments and blankets to keep children and elderly residents safe and warm.',
    location: { lat: 28.6139, lng: 77.2090, address: 'Northern District Relief Center, Delhi' },
    verified: true,
    totalDonations: 3450,
    goalAmount: 5000,
    media: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=900&q=80',
    dateCreated: '2026-01-10'
  },
  {
    _id: 'story-demo-2',
    title: 'Neighborhood Digital Classroom Initiative',
    description: 'Refurbishing donated laptops and tablets to set up a free after-school digital learning lab for 120 students.',
    fullStory: 'Many promising secondary students in the eastern ward lack home computers required for coding exercises, online tutorials, and research. We collect functional laptops, replace worn drives, and install open-source educational software for community study.',
    location: { lat: 12.9716, lng: 77.5946, address: 'Eastward Learning Center, Bengaluru' },
    verified: true,
    totalDonations: 4200,
    goalAmount: 6000,
    media: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
    dateCreated: '2026-01-18'
  },
  {
    _id: 'story-demo-3',
    title: 'Community Food Pantry & Meal Kit Drive',
    description: 'Supplying staple groceries and daily nutritious meal packs to elderly residents living alone without local family support.',
    fullStory: 'Every week, volunteers pack food parcels featuring high-protein grains, milk, fresh fruit, and staples. Your support helps purchase bulk pantry goods and covers eco-friendly delivery packaging to reach over 300 seniors every week.',
    location: { lat: 19.0760, lng: 72.8777, address: 'Central Community Pantry, Mumbai' },
    verified: true,
    totalDonations: 2800,
    goalAmount: 3500,
    media: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=80',
    dateCreated: '2026-02-02'
  }
];

