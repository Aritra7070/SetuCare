/**
 * Stock Seed — SetuCare Step 15
 *
 * Seeds every facility with the full global catalog.
 * At least one item per facility is seeded below threshold to ensure
 * the low-stock badge appears visibly during the demo.
 * Safe to re-run — uses upsert (findOneAndUpdate with upsert:true).
 */
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const path     = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Facility  = require('../models/Facility');
const StockItem = require('../models/StockItem');
const { STOCK_CATALOG } = require('../utils/stockCatalog');

// Per-facility overrides for demo impact — some items deliberately low/out
// Keys are facility shortCodes; values are { itemName: quantity }
const DEMO_OVERRIDES = {
  'PUN-SC01': {
    'Oxytocin':            2,  // LOW  (threshold 5)
    'Anti-D Immunoglobulin': 0, // OUT
  },
  'PUN-PHC01': {
    'Insulin':             3,  // LOW  (threshold 4)
    'Malaria RDT':         5,  // LOW  (threshold 8)
  },
  'PUN-DH01': {
    'Salbutamol Inhaler':  1,  // LOW
  },
  'NSK-DH01': {
    'Anti-TB Drug Kit':    1,  // LOW
    'Blood Glucose Strips': 10, // LOW (threshold 20)
  },
};

async function seedStock() {
  console.log('----------------------------------------------------');
  console.log(' [Seed] Seeding Step 15 Medicine/Diagnostic Stock   ');
  console.log('----------------------------------------------------');

  const isStandalone = mongoose.connection.readyState === 0;
  if (isStandalone) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setucare');
    console.log(' [Seed] Connected to MongoDB.');
  }

  const facilities = await Facility.find({ active: true });
  console.log(` [Seed] Seeding ${STOCK_CATALOG.length} items × ${facilities.length} facilities…`);

  let created = 0;
  let updated = 0;

  for (const facility of facilities) {
    const overrides = DEMO_OVERRIDES[facility.shortCode] || {};

    for (const item of STOCK_CATALOG) {
      const qty = overrides[item.name] !== undefined
        ? overrides[item.name]
        : item.defaultQty;

      const result = await StockItem.findOneAndUpdate(
        { facility: facility._id, name: item.name },
        {
          $setOnInsert: {
            facility:          facility._id,
            name:              item.name,
            itemType:          item.itemType,
            category:          item.category,
            unit:              item.unit,
            thresholdQuantity: item.threshold,
          },
          $set: {
            currentQuantity: qty,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (result.__v === undefined || result.isNew) created++;
      else updated++;
    }
  }

  const total = await StockItem.countDocuments();
  console.log(` [Seed] ✔ Done — ${total} total stock documents (created/updated: ${created + updated})`);

  // Show low/out items for verification
  const lowItems = await StockItem.find({}).populate('facility', 'name shortCode');
  const problemItems = lowItems.filter(i => i.status !== 'available');
  if (problemItems.length) {
    console.log('\n [Seed] Low/Out items (demo visibility):');
    problemItems.forEach(i => {
      console.log(`        [${i.status.toUpperCase()}] ${i.facility?.shortCode} — ${i.name}: ${i.currentQuantity} ${i.unit} (threshold: ${i.thresholdQuantity})`);
    });
  }

  if (isStandalone) {
    await mongoose.disconnect();
    console.log('\n [Seed] MongoDB disconnected.');
  }
}

if (require.main === module) {
  seedStock()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = seedStock;
