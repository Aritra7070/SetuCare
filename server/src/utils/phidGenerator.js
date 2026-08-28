const Patient = require('../models/Patient');

/**
 * Clean district code mapping for Maharashtra
 */
const DISTRICT_CODE_MAP = {
  nashik: 'NSK',
  pune: 'PUN',
  gadchiroli: 'GDC',
  thane: 'THN',
  mumbai: 'MUM',
  satara: 'STR',
  kolhapur: 'KOP',
  ahmednagar: 'AHM',
  aurangabad: 'AUR',
  chhatrapatisambhajinagar: 'CSN',
  solapur: 'SOL',
  amravati: 'AMR',
  nagpur: 'NAG',
};

/**
 * Get clean 3-letter district abbreviation
 */
const getDistrictCode = (districtName) => {
  if (!districtName) return 'MAH';
  const clean = districtName.toLowerCase().replace(/[^a-z]/g, '');
  if (DISTRICT_CODE_MAP[clean]) {
    return DISTRICT_CODE_MAP[clean];
  }
  return clean.substring(0, 3).toUpperCase();
};

/**
 * Generate human-transcribable 6-character random alphanumeric string
 * (Omits ambiguous characters like 0/O, 1/I to prevent reading errors)
 */
const generateRandomBase36 = (length = 6) => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
};

/**
 * Generate a unique collision-checked Patient Health ID (PHID)
 * Format: MH-<districtCode>-<facilityShortCode>-<random6>
 * Example: MH-NSK-SC01-7X2K9P
 */
const generateUniquePHID = async (facilityDoc) => {
  const stateCode = 'MH';
  const districtCode = getDistrictCode(facilityDoc?.district);
  
  // Extract or formulate facility short code
  let facilityShortCode = facilityDoc?.shortCode;
  if (!facilityShortCode) {
    if (facilityDoc?.name) {
      const parts = facilityDoc.name.split(' ').map((p) => p[0]);
      facilityShortCode = parts.join('').substring(0, 4).toUpperCase();
    } else {
      facilityShortCode = 'FAC01';
    }
  }

  // Sanitize facility short code for PHID (replace hyphens/spaces with clean text)
  const cleanFacilityCode = facilityShortCode.replace(/[^A-Z0-9]/gi, '');

  let phid = '';
  let isUnique = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  while (!isUnique && attempts < MAX_ATTEMPTS) {
    attempts++;
    const randomPart = generateRandomBase36(6);
    phid = `${stateCode}-${districtCode}-${cleanFacilityCode}-${randomPart}`;

    const existing = await Patient.findOne({ phid });
    if (!existing) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique PHID after maximum collision retries.');
  }

  return phid;
};

module.exports = {
  generateUniquePHID,
  getDistrictCode,
  generateRandomBase36,
};
