"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type AuthModalMode = "login" | null;

type AuthModalContextValue = {
  mode: AuthModalMode;
  openLogin: () => void;
  openSignup: () => void; // navigates via consumers — kept for API compat
  close: () => void;
  switchMode: (mode: "login") => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode>(null);

  const openLogin = useCallback(() => setMode("login"), []);
  const openSignup = useCallback(() => setMode(null), []);
  const close = useCallback(() => setMode(null), []);
  const switchMode = useCallback((next: "login") => setMode(next), []);

  const value = useMemo(
    () => ({ mode, openLogin, openSignup, close, switchMode }),
    [mode, openLogin, openSignup, close, switchMode],
  );

  return (
    <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
