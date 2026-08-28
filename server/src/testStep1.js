const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  User,
  Facility,
  Patient,
  Encounter,
  Referral,
  FollowUp,
} = require('./models');

const runValidation = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 1 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================\n');

  try {
    // 1. Connect DB
    console.log('[1/6] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
    console.log('  ✔ MongoDB Connected Successfully.\n');

    // 2. Validate Models Import
    console.log('[2/6] Verifying All 6 Core Mongoose Models...');
    const models = [
      { name: 'User', model: User },
      { name: 'Facility', model: Facility },
      { name: 'Patient', model: Patient },
      { name: 'Encounter', model: Encounter },
      { name: 'Referral', model: Referral },
      { name: 'FollowUp', model: FollowUp },
    ];

    models.forEach((m) => {
      if (!m.model || !m.model.schema) {
        throw new Error(`Model ${m.name} is not a valid Mongoose model`);
      }
      console.log(`  ✔ Model '${m.name}' schema compiled properly with ${Object.keys(m.model.schema.paths).length} paths.`);
    });
    console.log('  ✔ All 6 Mongoose models validated.\n');

    // 3. Seed Maharashtra Facilities
    console.log('[3/6] Seeding Initial Health Facilities (Maharashtra Stepped Care)...');
    await Facility.deleteMany({});

    const dh = await Facility.create({
      name: 'Aundh District Hospital',
      tier: 'district_hospital',
      location: { lat: 18.5729, lng: 73.8078 },
      district: 'Pune',
      state: 'Maharashtra',
      contactPhone: '+91-20-25881234',
    });

    const rh = await Facility.create({
      name: 'Shirur Sub-District Hospital',
      tier: 'rural_hospital',
      parentFacility: dh._id,
      location: { lat: 18.8277, lng: 74.3758 },
      district: 'Pune',
      state: 'Maharashtra',
      contactPhone: '+91-2138-222345',
    });

    const phc = await Facility.create({
      name: 'Kendur Primary Health Centre',
      tier: 'phc',
      parentFacility: rh._id,
      location: { lat: 18.8021, lng: 74.2045 },
      district: 'Pune',
      state: 'Maharashtra',
      contactPhone: '+91-2138-234567',
    });

    const sc = await Facility.create({
      name: 'Pabal Sub-Centre',
      tier: 'sub_centre',
      parentFacility: phc._id,
      location: { lat: 18.8354, lng: 74.0531 },
      district: 'Pune',
      state: 'Maharashtra',
      contactPhone: '+91-2138-245678',
    });

    console.log(`  ✔ Seeded 4-tier health network: ${sc.name} -> ${phc.name} -> ${rh.name} -> ${dh.name}\n`);

    // 4. Seed Demo Users for all roles
    console.log('[4/6] Seeding Users for all 5 Clinical/System Roles...');
    await User.deleteMany({});

    const usersToSeed = [
      {
        name: 'Asha Tai Shinde',
        email: 'asha.shinde@setucare.in',
        password: 'password123',
        role: 'frontline_worker',
        facility: sc._id,
        phone: '+91-9822012345',
        preferredLanguage: 'mr',
      },
      {
        name: 'Dr. Anand Kulkarni',
        email: 'dr.kulkarni@setucare.in',
        password: 'password123',
        role: 'medical_officer',
        facility: phc._id,
        phone: '+91-9822023456',
        preferredLanguage: 'mr',
      },
      {
        name: 'Dr. Meera Deshmukh',
        email: 'dr.deshmukh@setucare.in',
        password: 'password123',
        role: 'specialist',
        facility: dh._id,
        phone: '+91-9822034567',
        preferredLanguage: 'en',
      },
      {
        name: 'Sanjay Patil',
        email: 'pm.patil@setucare.in',
        password: 'password123',
        role: 'program_manager',
        facility: dh._id,
        phone: '+91-9822045678',
        preferredLanguage: 'en',
      },
      {
        name: 'System Admin',
        email: 'admin@setucare.in',
        password: 'admin123',
        role: 'admin',
        phone: '+91-9822056789',
        preferredLanguage: 'en',
      },
    ];

    for (const u of usersToSeed) {
      const created = await User.create(u);
      console.log(`  ✔ Created user '${created.name}' (${created.role})`);
    }
    console.log('  ✔ All demo role accounts successfully created.\n');

    // 5. Test Authentication & Password Hashing
    console.log('[5/6] Testing Authentication, Password Hashing & JWT Signing...');
    const testUser = await User.findOne({ email: 'asha.shinde@setucare.in' }).select('+password');
    const isPasswordCorrect = await testUser.matchPassword('password123');
    const isWrongPasswordFailing = !(await testUser.matchPassword('wrongpassword'));

    if (!isPasswordCorrect || !isWrongPasswordFailing) {
      throw new Error('Password verification logic failed!');
    }
    console.log('  ✔ Bcrypt password hashing & verification verified.');

    // Test password not returned in default queries
    const safeUser = await User.findOne({ email: 'asha.shinde@setucare.in' });
    if (safeUser.password !== undefined) {
      throw new Error('Password field was leaked in default query!');
    }
    console.log('  ✔ select: false confirmed (password omitted from default queries).');

    // Sign & Verify JWT
    const token = jwt.sign(
      { id: safeUser._id, role: safeUser.role, facility: safeUser.facility },
      process.env.JWT_SECRET || 'setucare_jwt_secret_dev_2026_phase1_secure_key',
      { expiresIn: '7d' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'setucare_jwt_secret_dev_2026_phase1_secure_key');
    if (decoded.id !== safeUser._id.toString() || decoded.role !== 'frontline_worker') {
      throw new Error('JWT token payload mismatch!');
    }
    console.log('  ✔ JWT token signing & payload verification successful.\n');

    // 6. Test Data Schemas Instantiation
    console.log('[6/6] Instantiating and validating stub documents for all models...');

    // Patient
    const testPatient = new Patient({
      phid: 'MH-PUN-2026-0001',
      name: 'Sunita Rao',
      gender: 'female',
      phone: '+91-9876500001',
      address: 'Pabal Village, Shirur Taluka, Pune',
      registeredAtFacility: sc._id,
      preferredLanguage: 'mr',
    });
    await testPatient.validate();
    console.log('  ✔ Patient schema validation passed (PHID: MH-PUN-2026-0001).');

    // Encounter
    const testEncounter = new Encounter({
      patient: testPatient._id,
      facility: sc._id,
      worker: safeUser._id,
      vitals: { bp: '130/85', tempC: 37.2, pulse: 78, weightKg: 55, spo2: 98 },
      symptoms: ['Mild fever', 'Headache'],
      notes: 'Initial checkup at sub-centre',
      triageResult: { riskLevel: 'routine', suggestedRouting: 'PHC OPD Consult' },
      encounterType: 'walk_in',
    });
    await testEncounter.validate();
    console.log('  ✔ Encounter schema validation passed (Vitals & Triage recorded).');

    // Referral
    const testReferral = new Referral({
      patient: testPatient._id,
      sourceEncounter: testEncounter._id,
      fromFacility: sc._id,
      toFacility: phc._id,
      reason: 'Symptom persistence and BP monitoring',
      status: 'created',
    });
    await testReferral.validate();
    console.log('  ✔ Referral schema validation passed (Sub-Centre -> PHC routing).');

    // FollowUp
    const testFollowUp = new FollowUp({
      patient: testPatient._id,
      cohortType: 'maternal',
      relatedEncounter: testEncounter._id,
      assignedFacility: sc._id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    });
    await testFollowUp.validate();
    console.log('  ✔ FollowUp schema validation passed (Maternal cohort schedule).');

    console.log('\n====================================================');
    console.log('     ALL SETUCARE STEP 1 CHECKS PASSED PERFECTLY     ');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n✖ Verification failed:', err);
    process.exit(1);
  }
};

runValidation();
