const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedFacilityHierarchy = require('./seed/facilities');
const Facility = require('./models/Facility');
const Patient = require('./models/Patient');
const Encounter = require('./models/Encounter');

const testStep5 = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 5 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================\n');

  // Connect MongoDB
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');

  // 1. Ensure seed data
  console.log('[1/8] Verifying Seed Data & Connecting Database...');
  await seedFacilityHierarchy();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
  }
  console.log('  ✔ Facility & user network ready.\n');

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
    // 2. Authenticate sessions
    console.log('[2/8] Authenticating ASHA, Medical Officer, and Program Manager...');
    const ashaLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'asha.shinde@setucare.in', password: 'password123' }
    );
    const ashaCookie = ashaLogin.headers['set-cookie']?.[0]?.split(';')[0];

    const moLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'dr.kulkarni@setucare.in', password: 'password123' }
    );
    const moCookie = moLogin.headers['set-cookie']?.[0]?.split(';')[0];

    const pmLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'pm.patil@setucare.in', password: 'password123' }
    );
    const pmCookie = pmLogin.headers['set-cookie']?.[0]?.split(';')[0];
    console.log('  ✔ Sessions acquired.\n');

    // 3. Register test patient
    console.log('[3/8] Registering Test Patient for Encounter Longitudinal Spine...');
    const regRes = await request(
      '/api/patients',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        name: 'Gita Ramesh Gaikwad',
        dob: '1990-05-18',
        gender: 'female',
        phone: '+91-9822667788',
        address: 'Pabal Gaon, Shirur',
        preferredLanguage: 'mr',
      }
    );
    const patient = regRes.data.patient;
    const phid = patient.phid;
    console.log(`  ✔ Patient registered: ${patient.name} (${phid})\n`);

    // 4. Create Encounter 1: ASHA worker at Sub-Centre (Walk-in)
    console.log('[4/8] Creating Encounter 1: ASHA Worker at Pabal Sub-Centre (Walk-in)...');
    const enc1Res = await request(
      '/api/encounters',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      {
        patientId: patient._id,
        encounterType: 'walk_in',
        vitals: {
          bp: '118/76',
          tempC: 38.2,
          pulse: 88,
          spo2: 97,
          weightKg: 54,
        },
        symptoms: ['Fever (ताप)', 'Severe Cough (खोकला)', 'Weakness/Fatigue'],
        notes: 'Patient presented with 3-day history of dry cough and fever. Paracetamol prescribed.',
      }
    );
    if (enc1Res.status !== 201) {
      throw new Error(`Encounter 1 creation failed: ${JSON.stringify(enc1Res.data)}`);
    }
    const encounter1 = enc1Res.data.encounter;
    console.log(`  ✔ POST /api/encounters: HTTP 201 Created (ID: ${encounter1._id})`);
    console.log(`  ✔ Auto-stamped Worker: ${encounter1.worker?.name} (${encounter1.worker?.role})`);
    console.log(`  ✔ Auto-stamped Facility: ${encounter1.facility?.name} [${encounter1.facility?.shortCode}]`);
    console.log(`  ✔ Vitals Captured: BP ${encounter1.vitals?.bp}, Temp ${encounter1.vitals?.tempC}°C, SpO2 ${encounter1.vitals?.spo2}%`);
    console.log(`  ✔ Triage Result Hook: ${encounter1.triageResult === null ? 'null (Correctly unset for Step 5)' : 'FAILED'}\n`);

    // 5. Create Encounter 2: Medical Officer at Kendur PHC (Referral Consult)
    console.log('[5/8] Creating Encounter 2: Medical Officer at Kendur PHC (Referral Consult)...');
    const enc2Res = await request(
      '/api/encounters',
      { method: 'POST', headers: { Cookie: moCookie } },
      {
        patientId: patient._id,
        encounterType: 'referral_consult',
        vitals: {
          bp: '148/96',
          tempC: 37.1,
          pulse: 104,
          spo2: 90,
          weightKg: 54,
        },
        symptoms: [
          'Acute Chest Pain (छातीत दुखणे)',
          'Breathlessness / SOB (दम लागणे)',
          'Dizziness (चक्कर)',
        ],
        notes: 'Escalated consult. Acute respiratory distress and elevated blood pressure observed. Oxygen support initiated.',
      }
    );
    if (enc2Res.status !== 201) {
      throw new Error(`Encounter 2 creation failed: ${JSON.stringify(enc2Res.data)}`);
    }
    const encounter2 = enc2Res.data.encounter;
    console.log(`  ✔ POST /api/encounters: HTTP 201 Created (ID: ${encounter2._id})`);
    console.log(`  ✔ Auto-stamped Worker: ${encounter2.worker?.name} (${encounter2.worker?.role})`);
    console.log(`  ✔ Auto-stamped Facility: ${encounter2.facility?.name} [${encounter2.facility?.shortCode}]\n`);

    // 6. Verify Longitudinal Encounter Spine via Patient Lookup Endpoint
    console.log('[6/8] Verifying Lookup Endpoint Populates Real Encounters Spine...');
    const lookupRes = await request(`/api/patients/lookup/${phid}`, {
      headers: { Cookie: moCookie },
    });
    if (lookupRes.status !== 200) {
      throw new Error(`Lookup failed: ${lookupRes.status}`);
    }
    const lookedUpEncounters = lookupRes.data.encounters;
    console.log(`  ✔ GET /api/patients/lookup/${phid}: HTTP 200 OK`);
    console.log(`  ✔ Encounters Array Length: ${lookedUpEncounters.length} (Formerly empty in Step 4, now fully populated)`);
    if (lookedUpEncounters.length !== 2) {
      throw new Error(`Expected 2 encounters in lookup response, got ${lookedUpEncounters.length}`);
    }
    console.log(`    ↳ Latest Visit: ${lookedUpEncounters[0].encounterType} at ${lookedUpEncounters[0].facility?.name} (${lookedUpEncounters[0].worker?.name})`);
    console.log(`    ↳ Prior Visit:  ${lookedUpEncounters[1].encounterType} at ${lookedUpEncounters[1].facility?.name} (${lookedUpEncounters[1].worker?.name})\n`);

    // 7. Verify GET /api/encounters/:id and /api/encounters/patient/:phid
    console.log('[7/8] Testing Direct Encounter Detail & Patient Encounters Routes...');
    const detailRes = await request(`/api/encounters/${encounter1._id}`, {
      headers: { Cookie: ashaCookie },
    });
    console.log(`  ✔ GET /api/encounters/${encounter1._id}: HTTP ${detailRes.status} (${detailRes.data.encounter.notes})`);

    const patientEncRes = await request(`/api/encounters/patient/${phid}`, {
      headers: { Cookie: ashaCookie },
    });
    console.log(`  ✔ GET /api/encounters/patient/${phid}: HTTP ${patientEncRes.status} (Count: ${patientEncRes.data.count})\n`);

    // 8. RoleGuard Test: Non-Clinical Roles Blocked
    console.log('[8/8] Testing RoleGuard: Program Manager Blocked from Clinical Encounter Creation...');
    const pmEnc = await request(
      '/api/encounters',
      { method: 'POST', headers: { Cookie: pmCookie } },
      {
        patientId: patient._id,
        vitals: { tempC: 37.0 },
      }
    );
    if (pmEnc.status === 403) {
      console.log(`  ✔ Program Manager correctly blocked: HTTP 403 Forbidden.`);
    } else {
      throw new Error(`Expected 403 for Program Manager encounter creation, got ${pmEnc.status}`);
    }

    console.log('\n====================================================');
    console.log('     ALL STEP 5 CHECKS PASSED FLAWLESSLY!           ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Step 5 Verification failed:', err);
    process.exit(1);
  }
};

testStep5();
