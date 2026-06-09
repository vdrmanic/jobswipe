import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>; 
  signUp: (email: string, password: string, fullName: string, userType: Profile['user_type']) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.log('FETCH PROFILE ERROR:', error.message);
      setProfile(null);
      return;
    }

    setProfile(data ?? null);
  };

  const refreshProfile = async () => {
    const currentUser = user || session?.user;
    if (currentUser) {
      await fetchProfile(currentUser.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error };
      }

      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (data.user) {
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error?.message || 'Neuspešna prijava') };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    userType: Profile['user_type']
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { error };
      }

      const userId = data.user?.id;
      if (!userId) {
        return { error: new Error('Korisnik nije kreiran. Proveri email.') };
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        user_type: userType,
        full_name: fullName.trim(),
      });

      if (profileError) {
        console.log('PROFILE INSERT ERROR:', profileError.message);
        return { error: profileError };
      }

      if (userType === 'candidate') {
        const { error: candidateError } = await supabase.from('candidate_profiles').insert({
          id: userId,
        });

        if (candidateError) {
          console.log('CANDIDATE PROFILES INSERT ERROR:', candidateError.message);
          return { error: candidateError };
        }
      } else {
        const { error: companyError } = await supabase.from('company_profiles').insert({
          id: userId,
        });

        if (companyError) {
          console.log('COMPANY PROFILES INSERT ERROR:', companyError.message);
          return { error: companyError };
        }
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfile(userId);
      }

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error?.message || 'Neuspešna registracija') };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (error: any) {
      return { error: new Error(error?.message || 'Neuspešno slanje emaila za reset') };
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (!newSession?.user) {
        setProfile(null);
        return;
      }

      setTimeout(() => {
        fetchProfile(newSession.user.id);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        resetPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);