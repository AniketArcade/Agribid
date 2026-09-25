// Demo data loaded on first run (and on "Reset demo data").
// Demo login credentials live here so the prototype is explorable without signing up.
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const DEMO_ACCOUNTS = {
  farmer: { phone: '9000000001', password: 'farmer123' },
  buyer: { phone: '9000000002', password: 'buyer123' },
  authority: { phone: 'AUTH001', password: 'authority123' },
};

export function seed() {
  const now = Date.now();
  const users = [
    {
      id: 'f1', role: 'farmer', ...DEMO_ACCOUNTS.farmer, createdAt: now - 20 * DAY,
      name: 'Ramesh Patel', place: 'Sanand', state: 'Gujarat', district: 'Ahmedabad',
      lands: [{ id: 'l1', location: 'Survey No. 112, Sanand', area: 'Near canal road', acres: 6.5 }],
      profileComplete: true,
    },
    {
      id: 'f2', role: 'farmer', phone: '9000000003', password: 'farmer123', createdAt: now - 12 * DAY,
      name: 'Gurpreet Singh', place: 'Khanna', state: 'Punjab', district: 'Ludhiana',
      lands: [{ id: 'l2', location: 'Village Khanna Kalan', area: 'Plot 4', acres: 12 }],
      profileComplete: true,
    },
    {
      id: 'f3', role: 'farmer', phone: '9000000004', password: 'farmer123', createdAt: now - 8 * DAY,
      name: 'Sunita Pawar', place: 'Lasalgaon', state: 'Maharashtra', district: 'Nashik',
      lands: [{ id: 'l3', location: 'Gat No. 58, Lasalgaon', area: 'East field', acres: 4 }],
      profileComplete: true,
    },
    {
      id: 'b1', role: 'buyer', ...DEMO_ACCOUNTS.buyer, createdAt: now - 30 * DAY,
      name: 'Anil Mehta', traderName: 'Mehta Agro Traders', location: 'APMC Market Yard',
      state: 'Gujarat', district: 'Rajkot', license: 'GJ-APMC-44821',
      interests: ['Wheat', 'Groundnut', 'Cotton'], profileComplete: true,
    },
    {
      id: 'b2', role: 'buyer', phone: '9000000005', password: 'buyer123', createdAt: now - 25 * DAY,
      name: 'Kavita Rao', traderName: 'Rao Foods Pvt Ltd', location: 'Industrial Area',
      state: 'Maharashtra', district: 'Pune', license: '', interests: ['Onion', 'Potato'],
      profileComplete: true,
    },
    {
      id: 'a1', role: 'authority', ...DEMO_ACCOUNTS.authority, createdAt: now - 60 * DAY,
      name: 'District Agriculture Office', profileComplete: true,
    },
  ];

  const bid = (id, buyerId, amount, ago) => ({ id, buyerId, amount, at: now - ago });

  const listings = [
    {
      id: 'p1', farmerId: 'f2', crop: 'Wheat', variety: 'HD-2967', quantity: 80, unit: 'Quintal',
      basePrice: 2275, grade: 'A (Premium)', availableFrom: now, endsAt: now + 2 * DAY,
      description: 'Freshly harvested, cleaned and sun-dried. Moisture under 12%.',
      status: 'open', createdAt: now - DAY,
      bids: [bid('bd1', 'b2', 2300, 20 * HOUR), bid('bd2', 'b1', 2340, 5 * HOUR)],
    },
    {
      id: 'p2', farmerId: 'f3', crop: 'Onion', variety: 'Red Nashik', quantity: 45, unit: 'Quintal',
      basePrice: 1800, grade: 'B (Standard)', availableFrom: now, endsAt: now + 9 * HOUR,
      description: 'Medium size bulbs, stored in ventilated chawl.',
      status: 'open', createdAt: now - 2 * DAY,
      bids: [bid('bd3', 'b2', 1850, 30 * HOUR)],
    },
    {
      id: 'p3', farmerId: 'f1', crop: 'Groundnut', variety: 'GG-20', quantity: 30, unit: 'Quintal',
      basePrice: 6300, grade: 'A (Premium)', availableFrom: now + 3 * DAY, endsAt: now + 4 * DAY,
      description: 'Bold kernels, bagged in 40 kg jute bags.',
      status: 'open', createdAt: now - 3 * HOUR, bids: [],
    },
    {
      id: 'p4', farmerId: 'f2', crop: 'Paddy (Rice)', variety: 'PR-126', quantity: 120, unit: 'Quintal',
      basePrice: 2183, grade: 'B (Standard)', availableFrom: now, endsAt: now + 3 * DAY,
      description: 'Pickup from farm gate, loading labour available.',
      status: 'open', createdAt: now - 5 * HOUR, bids: [],
    },
    {
      id: 'p5', farmerId: 'f1', crop: 'Cotton', variety: 'Shankar-6', quantity: 25, unit: 'Quintal',
      basePrice: 7020, grade: 'A (Premium)', availableFrom: now - 6 * DAY, endsAt: now - 2 * DAY,
      description: 'Long staple, clean pick.', status: 'sold', createdAt: now - 7 * DAY,
      bids: [bid('bd4', 'b1', 7100, 5 * DAY), bid('bd5', 'b1', 7250, 3 * DAY)], acceptedBidId: 'bd5',
    },
  ];

  return { users, listings };
}
