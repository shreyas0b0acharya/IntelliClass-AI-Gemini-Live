"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLecturer: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateRole: (role: "lecturer" | "student") => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLecturer: false,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateRole: async () => {},
  deleteAccount: async () => {},
});

const PROFILE_STORAGE_KEY = "intelliclass_profile";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const { profile: profileData, user: userData } = await api.getProfile();
      if (profileData && userData && profileData.id === userData.id) {
        setProfile(profileData);
        setUser(userData);
        try {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileData));
        } catch {}
      } else {
        setProfile(null);
        setUser(null);
        try {
          localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch {}
      }
    } catch (err: unknown) {
      // Gracefully handle unauthenticated or network transitions
      setProfile(null);
      setUser(null);
      try {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      } catch {}
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile();
      } else {
        setUser(null);
        setProfile(null);
        try {
          localStorage.removeItem(PROFILE_STORAGE_KEY);
          localStorage.removeItem("intelliclass_model_preferences");
        } catch {}
      }
    } catch (err) {
      console.error("AuthContext refreshProfile error:", err);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile();
        } else {
          setUser(null);
          setProfile(null);
          try {
            localStorage.removeItem(PROFILE_STORAGE_KEY);
            localStorage.removeItem("intelliclass_model_preferences");
          } catch {}
        }
      } catch (err) {
        console.error("AuthContext init error:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT" || !session?.user) {
          setUser(null);
          setProfile(null);
          try {
            localStorage.removeItem(PROFILE_STORAGE_KEY);
            localStorage.removeItem("intelliclass_model_preferences");
          } catch {}
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await fetchProfile();
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      try {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        localStorage.removeItem("intelliclass_model_preferences");
        window.dispatchEvent(
          new CustomEvent("intelliclass_preferences_changed", { detail: null })
        );
      } catch {}
    }
  };

  const updateRole = async (newRole: "lecturer" | "student") => {
    // 1. Optimistic local update
    if (profile) {
      const updated: Profile = { ...profile, role: newRole };
      setProfile(updated);
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }

    // 2. Call backend PATCH API
    try {
      const res = await api.updateProfile({ role: newRole });
      if (res.profile) {
        setProfile(res.profile);
        try {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(res.profile));
        } catch {}
      }
    } catch (err) {
      // Revert if failed
      console.error("Failed to update role in backend:", err);
      await fetchProfile();
      throw err;
    }
  };

  const deleteAccount = async () => {
    try {
      await api.deleteAccount();
    } finally {
      await signOut();
    }
  };

  const isLecturer = profile?.role === "lecturer";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLecturer,
        isLoading,
        signOut,
        refreshProfile,
        updateRole,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
