import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
/** What the user chose. "system" follows the OS `prefers-color-scheme`. */
export type ThemePreference = Theme | "system";

interface ThemeContextValue {
  /** The theme actually applied to the document. */
  theme: Theme;
  /** The stored choice: light, dark, or follow the system. */
  preference: ThemePreference;
  setTheme: (theme: Theme) => void;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "paperclip.theme";
/* Browser chrome colours: the Bostan --bostan-chrome token for each theme.
   index.html repeats these for the pre-hydration paint. */
const DARK_THEME_COLOR = "#1B1C1A";
const LIGHT_THEME_COLOR = "#F6F4EB";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readStoredPreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => resolveThemeFromDocument());
  // `null` means the user never chose: follow the OS without writing storage.
  // An explicit "system" choice also follows the OS, but is persisted so it
  // survives a later explicit light/dark choice being undone.
  const [storedPreference, setStoredPreference] = useState<ThemePreference | null>(() => readStoredPreference());
  const preference: ThemePreference = storedPreference ?? "system";
  const followsSystem = preference === "system";

  const setTheme = useCallback((nextTheme: Theme) => {
    setStoredPreference(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStoredPreference(next);
    if (next === "system") {
      const fromOs = systemTheme();
      if (fromOs) setThemeState(fromOs);
    } else {
      setThemeState(next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setStoredPreference(next);
    setThemeState(next);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (storedPreference === null) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, storedPreference);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [storedPreference]);

  // While following the system, flip alongside OS-level changes.
  useEffect(() => {
    if (!followsSystem) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [followsSystem]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setTheme,
      setPreference,
      toggleTheme,
    }),
    [theme, preference, setTheme, setPreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
