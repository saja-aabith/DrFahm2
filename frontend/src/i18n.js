import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import ar from './locales/ar/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    detection: {
      // Only read from localStorage — never auto-detect from browser OS language.
      // First visit defaults to 'en' via fallbackLng.
      order: ['localStorage'],
      lookupLocalStorage: 'drfahm_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;