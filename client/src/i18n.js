/**
 * SetuCare i18n — Step 18
 *
 * Three locales: en (English), hi (Hindi), mr (Marathi)
 * Static bundled JSON — no lazy loading, no translation-loading state.
 *
 * Language resolution order at login (applied in authStore after fetchMe):
 *   1. User.preferredLanguage (server-persisted explicit choice)
 *   2. Role default  — frontline_worker → mr, everyone else → en
 *   3. Browser language (via LanguageDetector)
 *   4. 'en' fallback
 *
 * All 9 namespaces are merged into one resource bundle per locale so every
 * component can call useTranslation() without specifying a namespace.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },

    // Default fallback — overridden per-user after login (see authStore)
    fallbackLng: 'en',

    // Role defaults applied before LanguageDetector fires
    // (actual logic lives in authStore.applyLanguageFromUser)
    supportedLngs: ['en', 'hi', 'mr'],

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      // Check localStorage first (persisted switcher choice), then browser
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'setucare_lang',
    },

    // Keep structured keys intact — we use dot notation manually
    keySeparator: '.',
    nsSeparator: false, // single namespace per locale
  });

/**
 * Role-based language default.
 * frontline_worker → Marathi (ASHA PRD requirement)
 * All others → English
 */
export function getDefaultLanguageForRole(role) {
  return role === 'frontline_worker' ? 'mr' : 'en';
}

/**
 * Apply language from a user object — called by authStore after login.
 * Resolution: explicit preferredLanguage > role default > keep current.
 */
export function applyLanguageFromUser(user) {
  if (!user) return;
  const target = user.preferredLanguage || getDefaultLanguageForRole(user.role);
  if (i18n.language !== target) {
    i18n.changeLanguage(target);
  }
}

export default i18n;
