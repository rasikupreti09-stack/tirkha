import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { UiLanguage } from "@tirkha/shared";

const STORAGE_KEY = "tirkha.mobile.language.v1";

type LanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<UiLanguage>("en");
  const [ready, setReady] = useState(false);
  const userSelected = useRef(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (mounted && !userSelected.current && (stored === "en" || stored === "np")) setLanguageState(stored);
      })
      .catch(() => {
        // Language preference is optional; the app remains usable in English if storage is unavailable.
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback((next: UiLanguage) => {
    userSelected.current = true;
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Keep the in-memory selection even if the device cannot persist preferences.
    });
  }, []);

  const value = useMemo(() => ({ language, setLanguage, ready }), [language, setLanguage, ready]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
