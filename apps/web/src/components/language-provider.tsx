"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { UiLanguage } from "@tirkha/shared";

const STORAGE_KEY = "tirkha.ui-language.v1";
type LanguageContextValue = { language: UiLanguage; setLanguage: (language: UiLanguage) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "np") setLanguageState(saved);
    } catch {
      // Keep English as the accessible default when browser storage is unavailable.
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === "en" || event.newValue === "np")) {
        setLanguageState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "np" ? "ne" : "en";
  }, [language]);

  const setLanguage = useCallback((next: UiLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The switch still works for this page view if storage is disabled.
    }
  }, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is missing from the app layout");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="mk-language-switch" role="group" aria-label="Choose language">
      <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
      <span aria-hidden="true">|</span>
      <button type="button" lang="ne" aria-pressed={language === "np"} onClick={() => setLanguage("np")}>नेपाली</button>
    </div>
  );
}
