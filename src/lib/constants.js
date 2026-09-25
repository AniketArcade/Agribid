export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const CROPS = [
  'Wheat', 'Paddy (Rice)', 'Maize', 'Bajra', 'Jowar', 'Soybean', 'Cotton', 'Sugarcane',
  'Mustard', 'Groundnut', 'Chana (Gram)', 'Tur (Arhar)', 'Moong', 'Urad', 'Onion', 'Potato',
  'Tomato', 'Other',
];

export const UNITS = ['Quintal', 'Tonne', 'Kg'];

export const GRADES = ['A (Premium)', 'B (Standard)', 'C (Fair)', 'Ungraded'];

// Authority-fixed base price, ₹ per quintal. Farmers cannot set their own — 'Other' crops
// have no fixed price yet, so listings for them start at 0 until an authority sets one.
export const MSP = {
  Wheat: 2275,
  'Paddy (Rice)': 2183,
  Maize: 2090,
  Bajra: 2500,
  Jowar: 3180,
  Soybean: 4600,
  Cotton: 7121,
  Sugarcane: 315,
  Mustard: 5650,
  Groundnut: 6377,
  'Chana (Gram)': 5440,
  'Tur (Arhar)': 7000,
  Moong: 8558,
  Urad: 6950,
  Onion: 1200,
  Potato: 800,
  Tomato: 700,
};

// Converts a per-quintal MSP into a price for the listing's chosen unit.
export const UNIT_FACTOR = { Quintal: 1, Tonne: 10, Kg: 0.01 };

// Minimum step (₹ per unit) a new bid must beat the current highest bid by.
export const MIN_BID_INCREMENT = 10;
