/**
 * FollowUp Seed — SetuCare Step 12
 *
 * Generates initial FollowUp records for patients already enrolled in cohorts
 * by Step 11's seed. Safe to re-run — applyScheduling deduplicates internally.
 */
const mongoose  = require('mongoose');
const dotenv    = require('dotenv');
const path      = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Patient  = require('../models/Patient');
const FollowUp = require('../models/FollowUp');
const Facility = require('../models/Facility');
const { applyScheduling } = require('../utils/schedulingEngine');

async function seedFollowUps() {
  console.log('----------------------------------------------------');
  console.log(' [Seed] Generating Step 12 FollowUp Records         ');
  console.log('----------------------------------------------------');

  const isStandalone = mongoose.connection.readyState === 0;
  if (isStandalone) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
    console.log(' [Seed] Connected to MongoDB.');
  }

  const facility = await Facility.findOne({ shortCode: 'PUN-SC01' });
  if (!facility) {
    console.error(' [Seed] ✗ PUN-SC01 facility not found — run facilities seed first');
    if (isStandalone) await mongoose.disconnect();
    return;
  }

  // ── Sunita Rao: maternal milestones ──
  const sunita = await Patient.findOne({ name: /sunita rao/i });
  if (sunita) {
    await applyScheduling({ patient: sunita, cohortType: 'maternal', workerId: null, facilityId: facility._id });
    const fus = await FollowUp.find({ patient: sunita._id, status: 'pending' });
    console.log(` [Seed] ✔ Sunita Rao — ${fus.length} maternal follow-up(s):`);
    fus.forEach(f => console.log(`          ${f.title} → ${f.dueDate.toDateString()}`));
  } else {
    console.warn(' [Seed] ⚠ Sunita Rao not found');
  }

  // ── Bikram Kumar Pradran: chronic 30-day check-in ──
  const bikram = await Patient.findOne({ name: /bikram/i });
  if (bikram) {
    await applyScheduling({ patient: bikram, cohortType: 'chronic', workerId: null, facilityId: facility._id });
    const fus = await FollowUp.find({ patient: bikram._id, status: 'pending' });
    console.log(` [Seed] ✔ Bikram Kumar Pradran — ${fus.length} chronic follow-up(s):`);
    fus.forEach(f => console.log(`          ${f.title} → ${f.dueDate.toDateString()}`));
  } else {
    console.warn(' [Seed] ⚠ Bikram not found');
  }

  // ── Arjun Pawar (age 3): child 180-day check ──
  const arjun = await Patient.findOne({ name: /arjun pawar/i });
  if (arjun) {
    await applyScheduling({ patient: arjun, cohortType: 'child', workerId: null, facilityId: facility._id });
    const fus = await FollowUp.find({ patient: arjun._id, status: 'pending' });
    console.log(` [Seed] ✔ Arjun Pawar — ${fus.length} child follow-up(s):`);
    fus.forEach(f => console.log(`          ${f.title} → ${f.dueDate.toDateString()}`));
  } else {
    console.warn(' [Seed] ⚠ Arjun Pawar not found');
  }

  const total = await FollowUp.countDocuments();
  console.log(`\n [Seed] Done. Total FollowUp records in DB: ${total}\n`);

  if (isStandalone) {
    await mongoose.disconnect();
    console.log(' [Seed] MongoDB disconnected.');
  }
}

if (require.main === module) {
  seedFollowUps()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = seedFollowUps;
