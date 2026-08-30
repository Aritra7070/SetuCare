export const INDIAN_LANGUAGES = [
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'as', label: 'অসমীয়া (Assamese)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'brx', label: 'बड़ो (Bodo)' },
  { code: 'doi', label: 'डोगरी (Dogri)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ks', label: 'کٲشُر (Kashmiri)' },
  { code: 'kok', label: 'कोंकणी (Konkani)' },
  { code: 'mai', label: 'मैथिली (Maithili)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'mni', label: 'মৈতৈলোন্ (Manipuri)' },
  { code: 'ne', label: 'नेपाली (Nepali)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'sa', label: 'संस्कृतम् (Sanskrit)' },
  { code: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)' },
  { code: 'sd', label: 'سنڌي (Sindhi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ur', label: 'اردو (Urdu)' },
  { code: 'en', label: 'English' },
];

export const getLanguageLabel = (code) =>
  INDIAN_LANGUAGES.find((language) => language.code === code)?.label || 'English';
