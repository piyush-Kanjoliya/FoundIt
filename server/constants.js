const academic = ['SJT', 'TT', 'PRP', 'SMV', 'MB', 'GDN', 'CDMM'];
const mensHostels = Array.from(
  {length: 20},
  (_, i) => `MH-${String.fromCharCode(65 + i)}`
);
const ladiesHostels = Array.from(
  {length: 10},
  (_, i) => `LH-${String.fromCharCode(65 + i)}`
);
const amenities = ['Gazebo', 'Food Mall', 'DC', 'Central Library', 'Sports Complex'];

export const VENUES = [...academic, ...mensHostels, ...ladiesHostels, ...amenities];

export const VENUE_GROUPS = [
  {id: 'academic', label: 'Academic', venues: academic},
  {id: 'mens_hostel', label: "Men's Hostels", venues: mensHostels},
  {id: 'ladies_hostel', label: "Ladies' Hostels", venues: ladiesHostels},
  {id: 'food', label: 'Food', venues: ['Gazebo', 'Food Mall', 'DC']},
  {id: 'library', label: 'Library', venues: ['Central Library']},
  {id: 'sports', label: 'Sports', venues: ['Sports Complex']},
];

export const CATEGORIES = [
  'ID Cards',
  'Room Keys',
  'Calculators',
  'Lab Equipment',
  'Earphones',
  'Wallets',
];

export const CHECKPOINTS = [
  'SJT Ground Floor Reception',
  'TT Reception',
  'PRP Reception',
  'Central Library Security Desk',
  'Men’s Hostel Security Desk',
  'Ladies’ Hostel Security Desk',
  'Sports Complex Reception',
];
