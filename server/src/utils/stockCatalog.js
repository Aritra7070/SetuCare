/**
 * Global Fixed Stock Catalog — SetuCare Step 15
 *
 * One source of truth for every item tracked across all facilities.
 * Keyed by `name` — each facility holds its own quantity document against
 * the same item definition, enabling meaningful cross-facility comparison.
 *
 * category mirrors Step 11 cohort types intentionally:
 *   maternal  — items relevant to ANC/delivery care
 *   chronic   — items relevant to chronic-disease management
 *   general   — diagnostics + oxygen, universally applicable
 */
const STOCK_CATALOG = [
  // ── Maternal ──
  { name: 'Oxytocin',                  itemType: 'medicine',        category: 'maternal', unit: 'vials',   defaultQty: 20, threshold: 5  },
  { name: 'Magnesium Sulphate',        itemType: 'medicine',        category: 'maternal', unit: 'vials',   defaultQty: 10, threshold: 3  },
  { name: 'Anti-D Immunoglobulin',     itemType: 'medicine',        category: 'maternal', unit: 'vials',   defaultQty: 8,  threshold: 2  },
  { name: 'Iron-Folic Acid Tablets',   itemType: 'medicine',        category: 'maternal', unit: 'tablets', defaultQty: 200,threshold: 50 },

  // ── Chronic ──
  { name: 'Insulin',                   itemType: 'medicine',        category: 'chronic',  unit: 'vials',   defaultQty: 15, threshold: 4  },
  { name: 'Metformin',                 itemType: 'medicine',        category: 'chronic',  unit: 'tablets', defaultQty: 300,threshold: 60 },
  { name: 'Amlodipine',                itemType: 'medicine',        category: 'chronic',  unit: 'tablets', defaultQty: 150,threshold: 30 },
  { name: 'Salbutamol Inhaler',        itemType: 'medicine',        category: 'chronic',  unit: 'units',   defaultQty: 12, threshold: 3  },
  { name: 'Anti-TB Drug Kit',          itemType: 'medicine',        category: 'chronic',  unit: 'kits',    defaultQty: 6,  threshold: 2  },

  // ── General / Diagnostic ──
  { name: 'Hemoglobin Test Kit',       itemType: 'diagnostic_test', category: 'general',  unit: 'tests',   defaultQty: 50, threshold: 10 },
  { name: 'Malaria RDT',               itemType: 'diagnostic_test', category: 'general',  unit: 'tests',   defaultQty: 40, threshold: 8  },
  { name: 'Blood Glucose Strips',      itemType: 'diagnostic_test', category: 'general',  unit: 'strips',  defaultQty: 100,threshold: 20 },
  { name: 'Urine Dipstick',            itemType: 'diagnostic_test', category: 'general',  unit: 'strips',  defaultQty: 80, threshold: 15 },
  { name: 'Oxygen (Cylinder/Conc.)',   itemType: 'medicine',        category: 'general',  unit: 'units',   defaultQty: 3,  threshold: 1  },
];

module.exports = { STOCK_CATALOG };
