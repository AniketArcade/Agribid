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

export const GRADES = ['Grade A', 'Grade B', 'Grade C'];

// Authority-fixed base prices now live in the crop_prices table (see
// supabase/migrations/0001_schema.sql, seeded with the same starting values
// this used to hold) — farmers cannot set their own here either.

// Converts a per-quintal price into a price for the listing's chosen unit.
export const UNIT_FACTOR = { Quintal: 1, Tonne: 10, Kg: 0.01 };

// Minimum step (₹ per unit) a new bid must beat the current highest bid by.
export const MIN_BID_INCREMENT = 10;
