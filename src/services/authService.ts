import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { Profile } from '../types';

export const authService = {
  async fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    } catch (error) {
      throw handleError(error);
    }
  },

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return {
        session: data.session,
        user: data.user,
      };
    } catch (error) {
      throw handleError(error);
    }
  },

  async signUp(
    email: string,
    password: string,
    fullName: string,
    userType: Profile['user_type'],
  ) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('User creation failed');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        user_type: userType,
        full_name: fullName.trim(),
      });

      if (profileError) throw profileError;

      return data.user;
    } catch (error) {
      throw handleError(error);
    }
  },

  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },
};
