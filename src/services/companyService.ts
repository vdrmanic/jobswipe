import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { CompanyProfile } from '../types';

export const companyService = {
  async fetchCompanyProfile(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async updateCompanyProfile(
    companyId: string,
    updates: Partial<CompanyProfile>,
  ) {
    try {
      const { error } = await supabase
        .from('company_profiles')
        .update(updates)
        .eq('id', companyId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchCompanies(limit?: number) {
    try {
      let query = supabase
        .from('company_profiles')
        .select('*, profiles(id, full_name, avatar_url, bio)');

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },

  async searchCompanies(query: string) {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*, profiles(id, full_name, avatar_url, bio)')
        .ilike('company_name', `%${query}%`)
        .limit(20);

      if (error) throw error;
      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },
};
