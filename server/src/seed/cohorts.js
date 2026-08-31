/**
 * Cohort Seed — SetuCare Step 11
 *
 * Patches existing patients with maternal + chronic memberships and inserts
 * a child patient (dob < 5 years). Safe to re-run — uses upsert patterns.
 *
 * Coverage:
 *   Sunita Rao        → maternal (EDD ~3 months from now)
 *   Bikram Kumar Pradran → chronic: hypertension + diabetes
 *   Arjun Pawar (new)   → dob = 3 years ago → child cohort (computed, no stored membership)
 */

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const path     = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Patient  = require('../models/Patient');
const Facility = require('../models/Facility');
const { generateUniquePHID } = require('../utils/phidGenerator');

async function seedCohorts() {
  console.log('----------------------------------------------------');
  console.log(' [Seed] Seeding Cohort Memberships & Child Patient  ');
  console.log('----------------------------------------------------');

  const isStandalone = mongoose.connection.readyState === 0;
  if (isStandalone) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
    console.log(' [Seed] Connected to MongoDB.');
  }

  // ── 1. Maternal — Sunita Rao ──────────────────────────────────────────────
  const sunita = await Patient.findOne({ name: /sunita rao/i });
  if (sunita) {
    const hasMaternal = sunita.cohortMemberships?.some(
      m => m.cohortType === 'maternal' && m.status === 'active'
    );
    if (!hasMaternal) {
      // EDD ~90 days from now
      const edd = new Date();
      edd.setDate(edd.getDate() + 90);

      sunita.cohortMemberships = sunita.cohortMemberships || [];
      sunita.cohortMemberships.push({
        cohortType: 'maternal',
        status: 'active',
        enrolledAt: new Date(),
        metadata: { expectedDeliveryDate: edd },
      });
      await sunita.save();
      console.log(` [Seed] ✔ Maternal membership added to ${sunita.name} (EDD: ${edd.toDateString()})`);
    } else {
      console.log(` [Seed] ↻ ${sunita.name} already has active maternal membership`);
    }
  } else {
    console.warn(' [Seed] ⚠ Sunita Rao not found — skipping maternal seed');
  }

  // ── 2. Chronic — Bikram Kumar Pradran ────────────────────────────────────
  const bikram = await Patient.findOne({ name: /bikram/i });
  if (bikram) {
    const hasChronic = bikram.cohortMemberships?.some(
      m => m.cohortType === 'chronic' && m.status === 'active'
    );
    if (!hasChronic) {
      bikram.cohortMemberships = bikram.cohortMemberships || [];
      bikram.cohortMemberships.push({
        cohortType: 'chronic',
        status: 'active',
        enrolledAt: new Date(),
        metadata: { conditions: ['hypertension', 'diabetes'] },
      });
      await bikram.save();
      console.log(` [Seed] ✔ Chronic membership (hypertension, diabetes) added to ${bikram.name}`);
    } else {
      console.log(` [Seed] ↻ ${bikram.name} already has active chronic membership`);
    }
  } else {
    console.warn(' [Seed] ⚠ Bikram Kumar Pradran not found — skipping chronic seed');
  }

  // ── 3. Child patient — Arjun Pawar (age 3) ───────────────────────────────
  const existing = await Patient.findOne({ name: /arjun pawar/i });
  if (!existing) {
    const facility = await Facility.findOne({ shortCode: 'PUN-SC01' });
    if (!facility) {
      console.warn(' [Seed] ⚠ PUN-SC01 facility not found — skipping child patient');
    } else {
      const phid = await generateUniquePHID(facility);
      const dob  = new Date();
      dob.setFullYear(dob.getFullYear() - 3); // 3 years old → child cohort

      await Patient.create({
        phid,
        name: 'Arjun Pawar',
        dob,
        gender: 'male',
        guardianName: 'Ramesh Pawar',
        phone: '+91-9823456789',
        address: 'Pabal Village, Shirur, Pune',
        registeredAtFacility: facility._id,
        preferredLanguage: 'mr',
        cohortMemberships: [], // child cohort is computed from dob — not stored
      });
      console.log(` [Seed] ✔ Child patient Arjun Pawar created (PHID: ${phid}, DOB: ${dob.toDateString()})`);
    }
  } else {
    console.log(` [Seed] ↻ Arjun Pawar already exists`);
  }

  const total = await Patient.countDocuments();
  console.log(`\n [Seed] Done. Total patients in DB: ${total}\n`);

  if (isStandalone) {
    await mongoose.disconnect();
    console.log(' [Seed] MongoDB disconnected.');
  }
}

if (require.main === module) {
  seedCohorts()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = seedCohorts;
