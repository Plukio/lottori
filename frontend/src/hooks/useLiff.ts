"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LiffModule = typeof import("@line/liff");

interface LiffProfile {
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
}

interface LiffState {
  isReady: boolean;
  isLoggedIn: boolean;
  profile?: LiffProfile;
  idToken?: string;
  error?: string;
  login: () => void;
  logout: () => void;
  refreshAuth: () => Promise<void> | void;
}

export function useLiff(): LiffState {
  const [liff, setLiff] = useState<LiffModule["default"]>();
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<LiffProfile>();
  const [error, setError] = useState<string>();
  const [idToken, setIdToken] = useState<string>();

  const hydrateSession = useCallback(
    async (liffModule: LiffModule["default"]) => {
      if (!liffModule.isLoggedIn()) {
        setIsLoggedIn(false);
        setProfile(undefined);
        setIdToken(undefined);
        return;
      }

      setIsLoggedIn(true);
      const profileResponse = await liffModule.getProfile();
      setProfile({
        userId: profileResponse.userId,
        displayName: profileResponse.displayName,
        pictureUrl: profileResponse.pictureUrl,
      });
      setIdToken(liffModule.getIDToken() ?? undefined);
    },
    []
  );

  const init = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_LIFF_ID) {
      setError("Missing NEXT_PUBLIC_LIFF_ID");
      setIsReady(true);
      return;
    }

    try {
      const { default: liffModule } = await import("@line/liff");
      setLiff(liffModule);
      await liffModule.init({
        liffId: process.env.NEXT_PUBLIC_LIFF_ID,
      });

      await hydrateSession(liffModule);
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to init LIFF");
      setIsReady(true);
    }
  }, [hydrateSession]);

  useEffect(() => {
    init();
  }, [init]);

  const login = useCallback(() => {
    if (!liff) return;
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  }, [liff]);

  const logout = useCallback(() => {
    if (!liff) return;
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  }, [liff]);

  const refreshAuth = useCallback(async () => {
    if (!liff) return;
    await hydrateSession(liff);
  }, [hydrateSession, liff]);

  return useMemo(
    () => ({
      isReady,
      isLoggedIn,
      profile,
      idToken,
      error,
      login,
      logout,
      refreshAuth,
    }),
    [isReady, isLoggedIn, profile, idToken, error, login, logout, refreshAuth]
  );
}

