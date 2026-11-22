import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import kn from './locales/kn.json';
import { APP_NAME } from '../config/brand.js';

export const SUPPORTED_LANGUAGES = ['en', 'kn'];
const STORAGE_KEY = 'spotit.language';

// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the app still works without it.
function readStoredLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}

function detectInitialLanguage() {
  const stored = readStoredLanguage();
  if (stored) return stored;
  const browserLanguages = navigator.languages ?? [navigator.language];
  return browserLanguages.some((lang) => lang?.toLowerCase().startsWith('kn')) ? 'kn' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    kn: { translation: kn },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false, // React already escapes output
    defaultVariables: { appName: APP_NAME },
  },
});

function applyDocumentLanguage(language) {
  document.documentElement.lang = language;
}

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language);
  storeLanguage(language);
  // Phase 2: also save the preference to the signed-in user's account.
});

export default i18n;
