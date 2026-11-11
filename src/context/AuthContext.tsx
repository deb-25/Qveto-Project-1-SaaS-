import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  authUser: SupabaseAuthUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUsr: SupabaseAuthUser) => {
    try {
      // Check cached localStorage profile for any extended attributes (phone, job_title, etc.)
      let localCached: Partial<User> = {};
      try {
        const stored = localStorage.getItem(`teamflow_profile_${authUsr.id}`);
        if (stored) localCached = JSON.parse(stored);
      } catch {}

      const { data } = await (supabase.from('users') as any)
        .select('*')
        .eq('id', authUsr.id)
        .maybeSingle();

      const userRow = data as (User & { [key: string]: any }) | null;
      const meta = authUsr.user_metadata || {};
      const resolvedName = 
        userRow?.name || 
        localCached.name || 
        meta.name || 
        meta.full_name || 
        authUsr.email?.split('@')[0] || 
        'TeamFlow Member';
      
      const resolvedAvatar = 
        userRow?.avatar_url || 
        localCached.avatar_url || 
        meta.avatar_url || 
        meta.picture || 
        null;

      const profile: User = {
        id: authUsr.id,
        email: authUsr.email || '',
        name: resolvedName,
        avatar_url: resolvedAvatar,
        timezone: userRow?.timezone || localCached.timezone || meta.timezone || 'UTC',
        phone: userRow?.phone || localCached.phone || meta.phone || null,
        job_title: userRow?.job_title || localCached.job_title || meta.job_title || null,
        department: userRow?.department || localCached.department || meta.department || null,
        bio: userRow?.bio || localCached.bio || meta.bio || null,
        created_at: userRow?.created_at || authUsr.created_at,
      };

      // Always persist to public.users via upsert
      try {
        await (supabase.from('users') as any).upsert({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar_url: profile.avatar_url,
          timezone: profile.timezone,
          phone: profile.phone,
          job_title: profile.job_title,
          department: profile.department,
          bio: profile.bio,
        }, { onConflict: 'id' });
      } catch (upsertErr) {
        console.warn('public.users upsert notice:', upsertErr);
      }

      // Ensure Supabase Auth user_metadata is synchronized so it is visible in Supabase Authentication Dashboard!
      if (!meta.name && !meta.full_name) {
        supabase.auth.updateUser({
          data: {
            name: profile.name,
            full_name: profile.name,
            avatar_url: profile.avatar_url,
          }
        }).catch(() => {});
      }

      // Save to localStorage cache
      try {
        localStorage.setItem(`teamflow_profile_${authUsr.id}`, JSON.stringify(profile));
      } catch {}

      setUser(profile);
    } catch {
      setUser({
        id: authUsr.id,
        email: authUsr.email || '',
        name: authUsr.user_metadata?.name || authUsr.user_metadata?.full_name || authUsr.email?.split('@')[0] || 'User',
        avatar_url: authUsr.user_metadata?.avatar_url || authUsr.user_metadata?.picture || null,
        timezone: 'UTC',
        created_at: authUsr.created_at,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detect whether URL has OAuth callback fragments (#access_token=) or PKCE code (?code=)
    const isOAuthRedirect =
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('error') ||
      window.location.search.includes('code=');

    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession?.user) {
        setSession(initialSession);
        setAuthUser(initialSession.user);
        fetchProfile(initialSession.user);
      } else if (!isOAuthRedirect) {
        // Only set loading false if we're not actively parsing an incoming OAuth redirect!
        setLoading(false);
      }
    });

    // 2. Listen to ongoing auth state events (signIn, signOut, tokenRefresh, OAuth redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setAuthUser(currentSession.user);
        await fetchProfile(currentSession.user);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setAuthUser(null);
        setUser(null);
        setLoading(false);
      } else if (!isOAuthRedirect) {
        setSession(null);
        setAuthUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    // 3. Safety timeout if OAuth redirect params were in URL but exchange timed out
    let oauthTimer: any;
    if (isOAuthRedirect) {
      oauthTimer = setTimeout(() => {
        setLoading(false);
      }, 7000);
    }

    return () => {
      subscription.unsubscribe();
      if (oauthTimer) clearTimeout(oauthTimer);
    };
  }, []);

  const refreshProfile = async () => {
    if (authUser) {
      await fetchProfile(authUser);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authUser,
        session,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
