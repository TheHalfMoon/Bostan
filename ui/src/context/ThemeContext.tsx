import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** The theme actually applied to the document. */
export type Theme = "light" | "dark";
/** What the user chose. `system` follows the OS `prefers-color-scheme`. */
export type ThemePreference = Theme | "system";

interface ThemeContextValue {
  /** Resolved theme currently applied (`light` or `dark`). */
  theme: Theme;
  /** Stored preference, including `system`. */
  preference: ThemePreference;
  setTheme: (theme: Theme) => void;
  setPreference: (preference: ThemePreference) => void;
  /** Flip between light and dark (an explicit choice; leaves `system`). */
  toggleTheme: () => void;
}

// Storage key kept for continuity with existing installs; index.html reads it
// before first paint. Values: "light" | "dark" | "system" (absent = system).
export const THEME_STORAGE_KEY = "paperclip.theme";
// Browser chrome colour per theme: the v3 chrome token (title bar surface).
export const THEME_COLORS: Record<Theme, string> = { light: "#FFFFFF", dark: "#14171C" };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
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
    themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  // Only written once the user acts, so a fresh install keeps following the
  // OS without persisting anything.
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = readStoredPreference();
    if (stored !== "system") return stored;
    // index.html already resolved the OS preference before first paint.
    return resolveThemeFromDocument();
  });

  const setPreference = useCallback((next: ThemePreference) => {
    setHasExplicitChoice(true);
    setPreferenceState(next);
    setThemeState(next === "system" ? (systemTheme() ?? resolveThemeFromDocument()) : next);
  }, []);

  const setTheme = useCallback((next: Theme) => setPreference(next), [setPreference]);

  const toggleTheme = useCallback(
    () => setPreference(theme === "dark" ? "light" : "dark"),
    [theme, setPreference],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!hasExplicitChoice) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [preference, hasExplicitChoice]);

  // Under `system`, follow OS-level changes mid-session.
  useEffect(() => {
    if (preference !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, setPreference, toggleTheme }),
    [theme, preference, setTheme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
