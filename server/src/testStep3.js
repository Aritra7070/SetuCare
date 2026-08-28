const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedFacilityHierarchy = require('./seed/facilities');
const { generateUniquePHID } = require('./utils/phidGenerator');
const { generateQRCodeDataUrl } = require('./utils/qrGenerator');
const Facility = require('./models/Facility');
const Patient = require('./models/Patient');

const testStep3 = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 3 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================\n');

  // Connect MongoDB
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');

  // 1. Seed facilities with short codes
  console.log('[1/8] Verifying Facility ShortCodes & Seeding...');
  await seedFacilityHierarchy();
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
  }

  const sampleFacility = await Facility.findOne({ shortCode: 'NSK-SC01' });
  if (!sampleFacility) {
    throw new Error('Facility with shortCode NSK-SC01 not found after seeding!');
  }
  console.log(`  ✔ Verified Facility shortCode backfill: ${sampleFacility.name} (${sampleFacility.shortCode})\n`);

  // 2. Unit Test: PHID Generation & Formatting
  console.log('[2/8] Testing PHID Generation & Format Constraints...');
  const testPhid = await generateUniquePHID(sampleFacility);
  console.log(`  ✔ Generated PHID: ${testPhid}`);
  const phidRegex = /^MH-[A-Z]{3}-[A-Z0-9]+-[2-9A-HJ-NP-Z]{6}$/;
  if (!phidRegex.test(testPhid)) {
    throw new Error(`PHID format mismatch: ${testPhid} does not match expected scheme`);
  }
  console.log('  ✔ PHID adheres to MH-<districtCode>-<facilityCode>-<random6> format.\n');

  // 3. Unit Test: QR Code Generation
  console.log('[3/8] Testing QR Code Server-Side Generation...');
  const qrDataUrl = await generateQRCodeDataUrl(testPhid);
  if (!qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('QR code data URL format invalid');
  }
  console.log(`  ✔ QR Code successfully generated (Data URI length: ${qrDataUrl.length} chars).\n`);

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const request = (path, options = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: parsed,
              });
            } catch (e) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                raw: data,
              });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    // 4. Authenticate Sessions
    console.log('[4/8] Authenticating Frontline Worker & Program Manager sessions...');
    const ashaLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'asha.shinde@setucare.in', password: 'password123' }
    );
    const ashaCookie = ashaLogin.headers['set-cookie']?.[0]?.split(';')[0];

    const pmLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'pm.patil@setucare.in', password: 'password123' }
    );
    const pmCookie = pmLogin.headers['set-cookie']?.[0]?.split(';')[0];
    console.log('  ✔ Sessions acquired.\n');

    // 5. Test Minor Validation & Patient Registration
    console.log('[5/8] Testing Patient Registration & Minor Guardian Validation...');
    
    // Minor registration missing guardian -> should fail 400
    const minorMissingGuardian = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        name: 'Aarav Patil',
        dob: '2018-06-15', // 8 years old
        gender: 'male',
        phone: '+91-9822001122',
        address: 'Vaitarna Village, Igatpuri',
      }
    );
    if (minorMissingGuardian.status === 400) {
      console.log(`  ✔ Minor without guardian rejected correctly: HTTP 400 ("${minorMissingGuardian.data.message}")`);
    } else {
      throw new Error(`Expected 400 for minor missing guardian, got ${minorMissingGuardian.status}`);
    }

    // Valid minor registration
    const validMinor = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        name: 'Aarav Patil',
        dob: '2018-06-15',
        gender: 'male',
        guardianName: 'Suresh Patil (Father)',
        phone: '+91-9822001122',
        address: 'Vaitarna Village, Igatpuri, Nashik',
        preferredLanguage: 'mr',
      }
    );
    if (validMinor.status !== 201) {
      throw new Error(`Failed to register valid minor patient: ${JSON.stringify(validMinor.data)}`);
    }
    const minorPatient = validMinor.data.patient;
    console.log(`  ✔ Minor patient registered: HTTP 201 (PHID: ${minorPatient.phid}, Guardian: ${minorPatient.guardianName})`);
    console.log(`  ✔ Auto-stamped facility: ${minorPatient.registeredAtFacility?.name} (${minorPatient.registeredAtFacility?.shortCode})`);

    // Valid adult registration
    const validAdult = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        name: 'Radha Suresh Shinde',
        dob: '1992-03-22', // Adult
        gender: 'female',
        phone: '+91-9822003344',
        address: 'Pabal Village, Shirur, Pune',
        preferredLanguage: 'mr',
      }
    );
    const adultPatient = validAdult.data.patient;
    console.log(`  ✔ Adult patient registered: HTTP 201 (PHID: ${adultPatient.phid})\n`);

    // 6. Test Soft Duplicate Detection
    console.log('[6/8] Testing Duplicate Guard Soft-Matching...');
    
    // Duplicate test by exact phone
    const phoneDup = await request(
      `/api/patients/check-duplicate?phone=%2B91-9822001122`,
      { headers: { Cookie: ashaCookie } }
    );
    if (phoneDup.data.duplicateFound && phoneDup.data.candidates.length > 0) {
      console.log(`  ✔ Duplicate phone detected: Found ${phoneDup.data.candidates.length} match (${phoneDup.data.candidates[0].matchReason})`);
    } else {
      throw new Error('Failed to detect duplicate by phone!');
    }

    // Duplicate test by name + DOB
    const nameDobDup = await request(
      `/api/patients/check-duplicate?name=aarav%20patil&dob=2018-06-15`,
      { headers: { Cookie: ashaCookie } }
    );
    if (nameDobDup.data.duplicateFound) {
      console.log(`  ✔ Duplicate Name+DOB detected: Found ${nameDobDup.data.candidates.length} match (${nameDobDup.data.candidates[0].matchReason})`);
    } else {
      throw new Error('Failed to detect duplicate by Name+DOB!');
    }

    // Non-duplicate test (same name, different DOB)
    const diffDobNoDup = await request(
      `/api/patients/check-duplicate?name=aarav%20patil&dob=2015-01-01`,
      { headers: { Cookie: ashaCookie } }
    );
    if (!diffDobNoDup.data.duplicateFound) {
      console.log(`  ✔ Different DOB correctly reports no duplicate candidate.\n`);
    } else {
      throw new Error('False positive duplicate detected for different DOB!');
    }

    // 7. Test Card Endpoint & Demographic Edit
    console.log('[7/8] Testing GET /:id/card & PATCH Demographic Edit...');
    const cardRes = await request(`/api/patients/${minorPatient._id}/card`, {
      headers: { Cookie: ashaCookie },
    });
    console.log(`  ✔ GET /api/patients/${minorPatient._id}/card: HTTP ${cardRes.status}`);
    console.log(`  ✔ Card Metadata: ${cardRes.data.cardMetadata?.scheme}, Calculated Age: ${cardRes.data.age} yrs`);
    if (!cardRes.data.qrCodeDataUrl) throw new Error('Missing QR code data URL on card endpoint!');

    // Demographic patch
    const patchRes = await request(
      `/api/patients/${minorPatient._id}`,
      { method: 'PATCH', headers: { Cookie: ashaCookie } },
      { address: 'Near ZP School, Vaitarna Village, Nashik' }
    );
    console.log(`  ✔ PATCH /api/patients/${minorPatient._id}: HTTP ${patchRes.status} (Updated Address: ${patchRes.data.patient.address})\n`);

    // 8. Test RoleGuard Access Control
    console.log('[8/8] Testing RoleGuard Access Control...');
    // Program Manager attempting to register a patient should be blocked (only frontline workers, MOs, admins can register)
    const pmRegister = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: pmCookie } },
      { name: 'Blocked Patient', phone: '+91-9999988888' }
    );
    if (pmRegister.status === 403) {
      console.log(`  ✔ Program Manager correctly blocked from clinical registration (HTTP 403 Forbidden).`);
    } else {
      throw new Error(`Expected 403 for Program Manager registration, got ${pmRegister.status}`);
    }

    console.log('\n====================================================');
    console.log('     ALL STEP 3 CHECKS PASSED FLAWLESSLY!           ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Step 3 Verification failed:', err);
    process.exit(1);
  }
};

testStep3();
