import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const LANGUAGE_STORAGE_KEY = 'fluxo:lang';

/** Maps any browser language to a supported one ("pt", "pt-PT" → "pt-BR"). */
export function normalizeLanguage(lng: string | undefined): Language {
  return lng?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, 'pt-BR': { translation: ptBR } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => normalizeLanguage(lng),
    },
    returnNull: false,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = normalizeLanguage(lng);
});

export default i18n;
