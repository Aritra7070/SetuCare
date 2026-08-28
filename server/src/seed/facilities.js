const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Facility = require('../models/Facility');

/**
 * Idempotent Seed Function for Maharashtra Stepped-Care Facility Network with Short Codes
 */
const seedFacilityHierarchy = async () => {
  console.log('----------------------------------------------------');
  console.log(' [Seed] Seeding Maharashtra Stepped-Care Facilities ');
  console.log('----------------------------------------------------');

  try {
    const isStandalone = mongoose.connection.readyState === 0;
    if (isStandalone) {
      await mongoose.connect(
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare'
      );
      console.log(' [Seed] Connected to MongoDB.');
    }

    // Helper to upsert a facility by name and district
    const upsertFacility = async (data, parentId = null) => {
      const filter = { name: data.name, district: data.district };
      const update = {
        ...data,
        parentFacility: parentId,
        active: data.active !== undefined ? data.active : true,
      };

      const facility = await Facility.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      });

      return facility;
    };

    // ==========================================
    // 1. NASHIK DISTRICT HIERARCHY
    // ==========================================
    console.log(' -> Seeding Nashik District Stepped-Care Network with ShortCodes...');

    // Tier 4: District Hospital
    const nskDH = await upsertFacility({
      name: 'Nashik District Civil Hospital',
      shortCode: 'NSK-DH01',
      tier: 'district_hospital',
      district: 'Nashik',
      state: 'Maharashtra',
      location: { lat: 19.9975, lng: 73.7898 },
      contactPhone: '+91-253-2571234',
    });

    // Tier 3: Rural Hospitals under Nashik DH
    const igatpuriRH = await upsertFacility(
      {
        name: 'Igatpuri Rural Hospital',
        shortCode: 'NSK-RH01',
        tier: 'rural_hospital',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.6967, lng: 73.5654 },
        contactPhone: '+91-2553-244123',
      },
      nskDH._id
    );

    const sinnarRH = await upsertFacility(
      {
        name: 'Sinnar Rural Hospital',
        shortCode: 'NSK-RH02',
        tier: 'rural_hospital',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.8456, lng: 73.9982 },
        contactPhone: '+91-2551-220456',
      },
      nskDH._id
    );

    // Tier 2: PHCs under Igatpuri RH
    const ghotiPHC = await upsertFacility(
      {
        name: 'Ghoti Primary Health Centre',
        shortCode: 'NSK-PHC01',
        tier: 'phc',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.7214, lng: 73.6621 },
        contactPhone: '+91-2553-221789',
      },
      igatpuriRH._id
    );

    const trimbakPHC = await upsertFacility(
      {
        name: 'Trimbakeshwar Primary Health Centre',
        shortCode: 'NSK-PHC02',
        tier: 'phc',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.9382, lng: 73.5312 },
        contactPhone: '+91-2594-233100',
      },
      igatpuriRH._id
    );

    // Tier 1: Sub-Centres under Ghoti PHC
    await upsertFacility(
      {
        name: 'Vaitarna Sub-Centre',
        shortCode: 'NSK-SC01',
        tier: 'sub_centre',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.8032, lng: 73.5412 },
        contactPhone: '+91-2553-289001',
      },
      ghotiPHC._id
    );

    await upsertFacility(
      {
        name: 'Talegaon Sub-Centre',
        shortCode: 'NSK-SC02',
        tier: 'sub_centre',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.6741, lng: 73.6823 },
        contactPhone: '+91-2553-289002',
      },
      ghotiPHC._id
    );

    // Tier 1: Sub-Centre under Trimbakeshwar PHC
    await upsertFacility(
      {
        name: 'Anjaneri Sub-Centre',
        shortCode: 'NSK-SC03',
        tier: 'sub_centre',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.9211, lng: 73.5823 },
        contactPhone: '+91-2594-289003',
      },
      trimbakPHC._id
    );

    // Tier 2: PHCs under Sinnar RH
    const dodiPHC = await upsertFacility(
      {
        name: 'Dodi Primary Health Centre',
        shortCode: 'NSK-PHC03',
        tier: 'phc',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.7823, lng: 74.1245 },
        contactPhone: '+91-2551-244101',
      },
      sinnarRH._id
    );

    const waviPHC = await upsertFacility(
      {
        name: 'Wavi Primary Health Centre',
        shortCode: 'NSK-PHC04',
        tier: 'phc',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.7412, lng: 74.2234 },
        contactPhone: '+91-2551-244102',
      },
      sinnarRH._id
    );

    // Tier 1: Sub-Centres under Sinnar PHCs
    await upsertFacility(
      {
        name: 'Musalgaon Sub-Centre',
        shortCode: 'NSK-SC04',
        tier: 'sub_centre',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.8821, lng: 74.0234 },
        contactPhone: '+91-2551-289004',
      },
      dodiPHC._id
    );

    await upsertFacility(
      {
        name: 'Pangri Sub-Centre',
        shortCode: 'NSK-SC05',
        tier: 'sub_centre',
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.7123, lng: 74.2891 },
        contactPhone: '+91-2551-289005',
      },
      waviPHC._id
    );

    // ==========================================
    // 2. PUNE DISTRICT HIERARCHY
    // ==========================================
    console.log(' -> Seeding Pune District Stepped-Care Network with ShortCodes...');

    const puneDH = await upsertFacility({
      name: 'Aundh District Hospital',
      shortCode: 'PUN-DH01',
      tier: 'district_hospital',
      district: 'Pune',
      state: 'Maharashtra',
      location: { lat: 18.5729, lng: 73.8078 },
      contactPhone: '+91-20-25881234',
    });

    const shirurRH = await upsertFacility(
      {
        name: 'Shirur Sub-District Hospital',
        shortCode: 'PUN-RH01',
        tier: 'rural_hospital',
        district: 'Pune',
        state: 'Maharashtra',
        location: { lat: 18.8277, lng: 74.3758 },
        contactPhone: '+91-2138-222345',
      },
      puneDH._id
    );

    const kendurPHC = await upsertFacility(
      {
        name: 'Kendur Primary Health Centre',
        shortCode: 'PUN-PHC01',
        tier: 'phc',
        district: 'Pune',
        state: 'Maharashtra',
        location: { lat: 18.8021, lng: 74.2045 },
        contactPhone: '+91-2138-234567',
      },
      shirurRH._id
    );

    await upsertFacility(
      {
        name: 'Pabal Sub-Centre',
        shortCode: 'PUN-SC01',
        tier: 'sub_centre',
        district: 'Pune',
        state: 'Maharashtra',
        location: { lat: 18.8354, lng: 74.0531 },
        contactPhone: '+91-2138-245678',
      },
      kendurPHC._id
    );

    const totalCount = await Facility.countDocuments();
    console.log(`\n [Seed] ✔ Successfully seeded/updated ${totalCount} facilities with short codes.\n`);

    if (isStandalone) {
      await mongoose.disconnect();
      console.log(' [Seed] MongoDB disconnected.');
    }

    return totalCount;
  } catch (error) {
    console.error(' [Seed] Error seeding facilities:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    throw error;
  }
};

// If run directly via node
if (require.main === module) {
  seedFacilityHierarchy()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedFacilityHierarchy;
