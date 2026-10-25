import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { type AppSettings, defaultAppSettings, getSettings, saveSettings } from '@/data/settings';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultAppSettings,
  updateSettings: () => {},
  loaded: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getSettings().then((stored) => {
      if (!active) return;
      setSettings(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveSettings(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
