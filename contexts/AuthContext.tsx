
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  sessionReady: boolean;
  profileReady: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionReady(true);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
        setProfileReady(true);
      }
    }).catch(err => {
      console.error("Auth initialization error:", err);
      setSessionReady(true);
      setLoading(false);
      setProfileReady(true);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionReady(true);
      
      // CRITICAL: Reset profile state immediately on any auth change to avoid stale data
      setProfile(null);
      setProfileReady(false);
      
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
        setProfileReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retries = 2) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        if (retries > 0) {
          setTimeout(() => fetchProfile(userId, retries - 1), 1000);
          return;
        }
        setProfile(null);
      } else {
        setProfile(data as UserProfile);
      }
      setLoading(false);
      setProfileReady(true);
    } catch (err) {
      console.error('Unexpected error fetching profile', err);
      if (retries > 0) {
        setTimeout(() => fetchProfile(userId, retries - 1), 1000);
        return;
      }
      setProfile(null);
      setLoading(false);
      setProfileReady(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setLoading(true);
      setProfileReady(false);
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
    setProfileReady(true);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, sessionReady, profileReady, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
