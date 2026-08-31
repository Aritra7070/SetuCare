/**
 * Chronic Condition Tag Vocabulary — SetuCare Step 11
 *
 * Fixed controlled list shared between:
 *   - Encounter.clinicalFlags.chronicConditions enum validation (server)
 *   - Clinical Flags form multi-select (client)
 *   - Step 12 scheduling cadence keying (e.g. diabetes → quarterly, hypertension → monthly)
 *
 * Never rename or remove an existing tag once encounters exist in production.
 */
const CHRONIC_CONDITIONS = [
  'diabetes',
  'hypertension',
  'tuberculosis',
  'asthma',
  'epilepsy',
  'heart_disease',
];

const CHRONIC_CONDITION_LABELS = {
  diabetes:     'Diabetes',
  hypertension: 'Hypertension',
  tuberculosis: 'Tuberculosis (TB)',
  asthma:       'Asthma',
  epilepsy:     'Epilepsy',
  heart_disease:'Heart Disease',
};

module.exports = { CHRONIC_CONDITIONS, CHRONIC_CONDITION_LABELS };
