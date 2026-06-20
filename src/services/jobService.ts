import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { JobListing } from '../types';

export const jobService = {
  async fetchJobs(filters?: {
    location?: string;
    skillsRequired?: string[];
    isActive?: boolean;
  }) {
    try {
      let query = supabase
        .from('job_listings')
        .select('*, company_profiles(company_name, industry, logo_url)');

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchJobById(jobId: string) {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .select('*, company_profiles(*)')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchCompanyJobs(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },

  async createJob(jobData: Omit<JobListing, 'id' | 'created_at'>) {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .insert(jobData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async updateJob(jobId: string, updates: Partial<JobListing>) {
    try {
      const { error } = await supabase
        .from('job_listings')
        .update(updates)
        .eq('id', jobId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async deleteJob(jobId: string) {
    try {
      const { error } = await supabase
        .from('job_listings')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },
};
