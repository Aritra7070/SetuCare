/**
 * Standardized Clinical Symptom Vocabulary for SetuCare Stepped-Care Network
 * Structured for frontline health workers, medical officers, and emergency triage.
 */
export const SYMPTOM_CATEGORIES = [
  {
    id: 'general',
    name: 'General / सामान्य',
    symptoms: [
      { id: 'fever', en: 'Fever', mr: 'ताप' },
      { id: 'chills', en: 'Chills / Rigors', mr: 'थंडी वाजणे' },
      { id: 'fatigue', en: 'Severe Weakness / Fatigue', mr: 'अशक्तपणा' },
      { id: 'headache', en: 'Severe Headache', mr: 'डोकेदुखी' },
      { id: 'dizziness', en: 'Dizziness / Vertigo', mr: 'चक्कर येणे' },
      { id: 'bodyache', en: 'Bodyache / Myalgia', mr: 'अंगदुखी' },
    ],
  },
  {
    id: 'respiratory',
    name: 'Respiratory / श्वसन',
    symptoms: [
      { id: 'cough_severe', en: 'Severe Persistent Cough', mr: 'तीव्र खोकला' },
      { id: 'breathlessness', en: 'Breathlessness / SOB', mr: 'दम लागणे' },
      { id: 'chest_congestion', en: 'Chest Congestion / Wheezing', mr: 'छातीत कफ' },
      { id: 'hemoptysis', en: 'Coughing up Blood', mr: 'खोकल्यातून रक्त' },
    ],
  },
  {
    id: 'cardiovascular',
    name: 'Cardiovascular / हृदय व रक्तदाब',
    symptoms: [
      { id: 'chest_pain', en: 'Acute Chest Pain / Tightness', mr: 'छातीत तीव्र दुखणे' },
      { id: 'palpitations', en: 'Palpitations / Rapid Heartbeat', mr: 'छातीत धडधडणे' },
      { id: 'high_bp_symptoms', en: 'Elevated BP Symptoms', mr: 'उच्च रक्तदाब' },
      { id: 'syncope', en: 'Fainting / Syncope', mr: 'बेशुद्ध पडणे' },
    ],
  },
  {
    id: 'gastrointestinal',
    name: 'Gastrointestinal / पचनसंस्था',
    symptoms: [
      { id: 'diarrhea', en: 'Severe Diarrhea / Loose Stools', mr: 'अतिसार / जुलाब' },
      { id: 'vomiting', en: 'Persistent Vomiting', mr: 'सतत उलट्या' },
      { id: 'abdominal_pain', en: 'Acute Abdominal Pain', mr: 'पोटात तीव्र दुखणे' },
      { id: 'dehydration', en: 'Severe Dehydration Signs', mr: 'पाण्याची कमतरता' },
    ],
  },
  {
    id: 'maternal',
    name: 'Maternal & Pregnancy / गरोदरपण व माता आरोग्य',
    symptoms: [
      { id: 'anc_high_bp', en: 'Pregnancy-Induced High BP / Headache', mr: 'गरोदरपणातील उच्च रक्तदाब' },
      { id: 'anc_bleeding', en: 'Vaginal Bleeding / Spotting', mr: 'रक्तस्राव' },
      { id: 'anc_reduced_movement', en: 'Reduced Fetal Movements', mr: 'बाळाची हालचाल कमी' },
      { id: 'anc_swelling', en: 'Swelling of Face & Feet (Edema)', mr: 'चेहऱ्यावर व पायावर सूज' },
      { id: 'anc_blurred_vision', en: 'Blurred Vision / Preeclampsia Signs', mr: 'डोळ्यांसमोर अंधारी' },
    ],
  },
  {
    id: 'pediatric',
    name: 'Pediatric / बाल आरोग्य',
    symptoms: [
      { id: 'ped_high_fever', en: 'High Fever in Infant (< 1 year)', mr: 'लहान बाळाला तीव्र ताप' },
      { id: 'ped_refusing_feeds', en: 'Lethargic / Refusing Feeds', mr: 'दूध न पिणे / सुस्त असणे' },
      { id: 'ped_fast_breathing', en: 'Fast / Grunting Breathing in Child', mr: 'छाती जलद चालणे' },
      { id: 'ped_convulsions', en: 'Convulsions / Fits', mr: 'झटके येणे' },
    ],
  },
];
