/**
 * Canonical Symptom Tag Vocabulary — SetuCare Stepped-Care Network
 *
 * These IDs are the authoritative controlled vocabulary shared by:
 *   - Encounter model enum validation (server)
 *   - Encounter creation form (client — see symptomVocabulary.js)
 *   - Step 7 triage rule engine (reads these IDs to pattern-match risk rules)
 *
 * ADD NEW TAGS HERE ONLY — never rename or remove an existing ID once encounters
 * exist in production (old documents will fail enum validation on re-save).
 */
const SYMPTOM_TAGS = [
  // General / सामान्य
  'fever',
  'chills',
  'fatigue',
  'headache',
  'dizziness',
  'bodyache',

  // Respiratory / श्वसन
  'cough_severe',
  'breathlessness',
  'chest_congestion',
  'hemoptysis',

  // Cardiovascular / हृदय व रक्तदाब
  'chest_pain',
  'palpitations',
  'high_bp_symptoms',
  'syncope',

  // Gastrointestinal / पचनसंस्था
  'diarrhea',
  'vomiting',
  'abdominal_pain',
  'dehydration',

  // Maternal & Pregnancy / गरोदरपण व माता आरोग्य
  'anc_high_bp',
  'anc_bleeding',
  'anc_reduced_movement',
  'anc_swelling',
  'anc_blurred_vision',

  // Pediatric / बाल आरोग्य
  'ped_high_fever',
  'ped_refusing_feeds',
  'ped_fast_breathing',
  'ped_convulsions',
];

module.exports = { SYMPTOM_TAGS };
