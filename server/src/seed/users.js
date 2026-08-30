const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Facility = require('../models/Facility');

/**
 * Demo accounts that match the quick-login chips on the LoginPage.
 *
 * facilityShortCode is resolved at runtime so this file has zero hard-coded
 * ObjectIds and stays correct even after a fresh facility seed.
 */
const DEMO_USERS = [
  {
    name: 'Asha Tai Shinde',
    email: 'asha.shinde@setucare.in',
    password: 'password123',
    role: 'frontline_worker',
    facilityShortCode: 'PUN-SC01',   // Pabal Sub-Centre
    phone: '+91-9822012345',
    preferredLanguage: 'mr',
  },
  {
    name: 'Dr. Vikram Kulkarni',
    email: 'dr.kulkarni@setucare.in',
    password: 'password123',
    role: 'medical_officer',
    facilityShortCode: 'PUN-PHC01',  // Kendur PHC
    phone: '+91-9822056789',
    preferredLanguage: 'mr',
  },
  {
    name: 'Dr. Sunita Deshmukh',
    email: 'dr.deshmukh@setucare.in',
    password: 'password123',
    role: 'specialist',
    facilityShortCode: 'PUN-DH01',   // Aundh District Hospital
    phone: '+91-9822078901',
    preferredLanguage: 'en',
  },
  {
    name: 'Rajesh Patil',
    email: 'pm.patil@setucare.in',
    password: 'password123',
    role: 'program_manager',
    facilityShortCode: 'NSK-DH01',   // Nashik District Civil Hospital
    phone: '+91-9822034567',
    preferredLanguage: 'mr',
  },
  {
    name: 'System Administrator',
    email: 'admin@setucare.in',
    password: 'admin123',
    role: 'admin',
    facilityShortCode: null,         // Admin has no facility constraint
    phone: '+91-9000000001',
    preferredLanguage: 'en',
  },
];

const seedUsers = async () => {
  console.log('----------------------------------------------------');
  console.log(' [Seed] Seeding Demo User Accounts                  ');
  console.log('----------------------------------------------------');

  try {
    const isStandalone = mongoose.connection.readyState === 0;
    if (isStandalone) {
      await mongoose.connect(
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare'
      );
      console.log(' [Seed] Connected to MongoDB.');
    }

    for (const userData of DEMO_USERS) {
      const { facilityShortCode, ...fields } = userData;

      // Resolve facility ObjectId from short code
      let facilityId = null;
      if (facilityShortCode) {
        const facility = await Facility.findOne({ shortCode: facilityShortCode });
        if (!facility) {
          console.error(
            ` [Seed] ✗ Facility with shortCode "${facilityShortCode}" not found — ` +
            `run the facilities seed first. Skipping user: ${fields.email}`
          );
          continue;
        }
        facilityId = facility._id;
      }

      // Check if user already exists
      const existing = await User.findOne({ email: fields.email });

      if (existing) {
        // Update the password in case it changed, keep other fields fresh
        existing.name               = fields.name;
        existing.role               = fields.role;
        existing.phone              = fields.phone;
        existing.preferredLanguage  = fields.preferredLanguage;
        if (facilityId) existing.facility = facilityId;
        // Force password re-hash by marking it modified
        existing.password = fields.password;
        await existing.save();
        console.log(` [Seed] ↻ Updated existing user: ${fields.email} (${fields.role})`);
      } else {
        const newUser = new User({
          ...fields,
          ...(facilityId && { facility: facilityId }),
        });
        await newUser.save(); // pre('save') hook hashes password automatically
        console.log(` [Seed] ✔ Created user: ${fields.email} (${fields.role})`);
      }
    }

    const total = await User.countDocuments();
    console.log(`\n [Seed] Done. Total users in DB: ${total}\n`);

    if (isStandalone) {
      await mongoose.disconnect();
      console.log(' [Seed] MongoDB disconnected.');
    }
  } catch (error) {
    console.error(' [Seed] Error seeding users:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

// Run directly: node src/seed/users.js
if (require.main === module) {
  seedUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedUsers;
