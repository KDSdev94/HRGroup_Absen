import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Theme = "light" | "dark";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
  toggleTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "hrgroup-attendance-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  // Listen for auth changes to switch theme preference per user
  useEffect(() => {
    // We need to import auth dynamically or pass it in, but since we have a global auth instance:
    // This assumes auth is initialized.
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (user) {
        const userKey = `${storageKey}-${user.uid}`;
        const savedTheme = localStorage.getItem(userKey) as Theme;
        if (savedTheme) {
          setThemeState(savedTheme);
        } else {
          // If no saved theme for this user, use default but don't save yet
          // or maybe inherit current? Let's use default.
          setThemeState(defaultTheme);
        }
      } else {
        // No user, revert to default or global storage
        // For now, let's just go to default to be safe
        setThemeState(defaultTheme);
      }
    });

    return () => unsubscribe();
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      const user = auth.currentUser;

      if (user) {
        const userKey = `${storageKey}-${user.uid}`;
        localStorage.setItem(userKey, newTheme);
      } else {
        localStorage.setItem(storageKey, newTheme);
      }
      setThemeState(newTheme);
    },
    toggleTheme: () => {
      const user = auth.currentUser;
      const newTheme = theme === "light" ? "dark" : "light";

      if (user) {
        const userKey = `${storageKey}-${user.uid}`;
        localStorage.setItem(userKey, newTheme);
      } else {
        localStorage.setItem(storageKey, newTheme);
      }
      setThemeState(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
