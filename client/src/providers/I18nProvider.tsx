import { useState, useEffect, ReactNode } from 'react';
import { I18nContext, Language, createTranslator } from '@/lib/i18n';
import { rememberUiLanguage, storedUiLanguage, setUiLanguage } from "@shared/ui-language";

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguage] = useState<Language>(storedUiLanguage);
  setUiLanguage(language);
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en-IN" : "mr-IN";
  }, [language]);

  const t = createTranslator(language);

  const value = {
    language,
    setLanguage: (lang: Language) => {
      setLanguage(lang);
      rememberUiLanguage(lang);
    },
    t,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}