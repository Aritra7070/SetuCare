const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedFacilityHierarchy = require('./seed/facilities');
const Facility = require('./models/Facility');
const Patient = require('./models/Patient');
const ScanLog = require('./models/ScanLog');

const testStep4 = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 4 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================\n');

  // Connect MongoDB
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');

  // 1. Seed facilities
  console.log('[1/7] Ensuring Seed Data & Facilities...');
  await seedFacilityHierarchy();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
  }
  console.log('  ✔ Facility network ready.\n');

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
    // 2. Authenticate Clinical Sessions across multiple tiers
    console.log('[2/7] Authenticating 3 Tiers of Health Workers...');
    
    // Tier 1: ASHA at Pabal Sub-Centre
    const ashaLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'asha.shinde@setucare.in', password: 'password123' }
    );
    const ashaCookie = ashaLogin.headers['set-cookie']?.[0]?.split(';')[0];

    // Tier 2: Medical Officer at Kendur PHC
    const moLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'dr.kulkarni@setucare.in', password: 'password123' }
    );
    const moCookie = moLogin.headers['set-cookie']?.[0]?.split(';')[0];

    // Tier 4: Specialist at Aundh District Hospital
    const specialistLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'dr.deshmukh@setucare.in', password: 'password123' }
    );
    const specCookie = specialistLogin.headers['set-cookie']?.[0]?.split(';')[0];
    console.log('  ✔ Sessions acquired for ASHA (Tier 1), Medical Officer (Tier 2), and Specialist (Tier 4).\n');

    // 3. Register a test patient at Sub-Centre
    console.log('[3/7] Registering Patient at Tier 1 Sub-Centre...');
    const registerRes = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        name: 'Savita Tai Jadhav',
        dob: '1988-11-04',
        gender: 'female',
        phone: '+91-9822778899',
        address: 'Pabal Wasti, Shirur',
        preferredLanguage: 'mr',
      }
    );
    if (registerRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(registerRes.data)}`);
    }
    const testPatient = registerRes.data.patient;
    const testPhid = testPatient.phid;
    console.log(`  ✔ Patient Registered at ${testPatient.registeredAtFacility?.name}: ${testPatient.name} (PHID: ${testPhid})\n`);

    // 4. Test Cross-Facility Lookup by Medical Officer (Tier 2 looking up Tier 1 record)
    console.log('[4/7] Testing Cross-Facility Lookup by Medical Officer at PHC...');
    const moLookup = await request(`/api/patients/lookup/${testPhid}?source=camera_qr`, {
      headers: { Cookie: moCookie },
    });
    if (moLookup.status !== 200) {
      throw new Error(`MO lookup failed: HTTP ${moLookup.status} - ${JSON.stringify(moLookup.data)}`);
    }
    console.log(`  ✔ GET /api/patients/lookup/${testPhid} by Medical Officer: HTTP 200 OK`);
    console.log(`  ✔ Patient Name: ${moLookup.data.patient.name}, Origin Facility: ${moLookup.data.patient.registeredAtFacility?.name}`);
    console.log(`  ✔ Encounters Array Present: Array(${moLookup.data.encounters.length}) (Staged for Step 5)`);
    console.log(`  ✔ Cross-Facility Flag: ${moLookup.data.scanContext.isCrossFacility ? 'YES (Cross-Facility Access Verified)' : 'NO'}\n`);

    // 5. Test Cross-Facility Lookup by Specialist at District Hospital
    console.log('[5/7] Testing Cross-Facility Lookup by Specialist at District Hospital...');
    const specLookup = await request(`/api/patients/lookup/${testPhid.toLowerCase()}?source=manual_entry`, {
      headers: { Cookie: specCookie },
    });
    if (specLookup.status !== 200) {
      throw new Error(`Specialist lookup failed: HTTP ${specLookup.status}`);
    }
    console.log(`  ✔ Case-insensitive lookup (${testPhid.toLowerCase()}): HTTP 200 OK`);
    console.log(`  ✔ Specialist at District Hospital retrieved Sub-Centre record with zero facility restriction.\n`);

    // 6. Test Non-Existent PHID & 404 Response
    console.log('[6/7] Testing Non-Existent PHID (404 Not Found)...');
    const notFoundRes = await request('/api/patients/lookup/MH-NSK-SC01-000000', {
      headers: { Cookie: moCookie },
    });
    if (notFoundRes.status === 404) {
      console.log(`  ✔ Non-existent PHID returned HTTP 404: "${notFoundRes.data.message}" (searchedPhid: ${notFoundRes.data.searchedPhid})\n`);
    } else {
      throw new Error(`Expected 404 for invalid PHID, got ${notFoundRes.status}`);
    }

    // 7. Test Explicit Scan Log Recording
    console.log('[7/7] Testing Explicit Scan Log API & MongoDB Persistence...');
    const scanLogRes = await request(
      `/api/patients/lookup/${testPhid}/scan-log`,
      { method: 'POST', headers: { Cookie: moCookie } },
      { scanSource: 'camera_qr' }
    );
    if (scanLogRes.status !== 201) {
      throw new Error(`Scan log API failed: ${JSON.stringify(scanLogRes.data)}`);
    }
    console.log(`  ✔ POST /api/patients/lookup/${testPhid}/scan-log: HTTP 201 Created`);

    const savedLogs = await ScanLog.find({ phid: testPhid });
    console.log(`  ✔ ScanLog records verified in MongoDB: ${savedLogs.length} audit event(s) recorded.`);

    console.log('\n====================================================');
    console.log('     ALL STEP 4 CHECKS PASSED FLAWLESSLY!           ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Step 4 Verification failed:', err);
    process.exit(1);
  }
};

testStep4();
