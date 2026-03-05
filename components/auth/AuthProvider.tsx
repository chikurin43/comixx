"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import type { AuthStatus } from "@/lib/types";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const bootstrap = async () => {
      try {
        const supabase = getBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setStatus(data.session ? "authenticated" : "unauthenticated");

        const channel = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession ?? null);
          setUser(nextSession?.user ?? null);
          setStatus(nextSession ? "authenticated" : "unauthenticated");
        });

        subscription = channel.data.subscription;
      } catch {
        setSession(null);
        setUser(null);
        setStatus("unauthenticated");
      }
    };

    void bootstrap();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      signOut: async () => {
        try {
          const supabase = getBrowserSupabaseClient();
          await supabase.auth.signOut();
        } finally {
          setSession(null);
          setUser(null);
          setStatus("unauthenticated");
        }
      },
    }),
    [status, user, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return ctx;
}
