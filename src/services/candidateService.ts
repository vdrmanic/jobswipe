import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { CandidateProfile } from '../types';

export const candidateService = {
  async fetchCandidateProfile(candidateId: string) {
    try {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async updateCandidateProfile(
    candidateId: string,
    updates: Partial<CandidateProfile>,
  ) {
    try {
      const { error } = await supabase
        .from('candidate_profiles')
        .update(updates)
        .eq('id', candidateId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchCandidates(filters?: {
    location?: string;
    experienceLevel?: string;
    skills?: string[];
    limit?: number;
  }) {
    try {
      let query = supabase
        .from('candidate_profiles')
        .select('*, profiles(id, full_name, avatar_url, bio, location)');

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },

  async searchCandidates(query: string) {
    try {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*, profiles(id, full_name, avatar_url, bio)')
        .ilike('skills', `%${query}%`)
        .limit(20);

      if (error) throw error;
      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },
};
