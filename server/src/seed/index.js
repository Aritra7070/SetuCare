const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedFacilityHierarchy = require('./facilities');
const seedUsers = require('./users');

const runAllSeeds = async () => {
  console.log('====================================================');
  console.log('  SetuCare — Full Database Seed                     ');
  console.log('====================================================');

  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare'
  );
  console.log('[Seed] Connected to MongoDB Atlas\n');

  // Order matters: users depend on facilities existing first
  await seedFacilityHierarchy();
  await seedUsers();

  await mongoose.disconnect();
  console.log('====================================================');
  console.log('  All seeds complete. Ready to demo.                ');
  console.log('====================================================');
  process.exit(0);
};

runAllSeeds().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
