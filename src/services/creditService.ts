import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { CompanyCreditTransaction, JobListing } from '../types';

export const CREDIT_DURATION_OPTIONS = [
  { credits: 1, days: 7, label: '7 dana', description: 'Jedan kredit za brzu probu oglasa.' },
  { credits: 2, days: 14, label: '14 dana', description: 'Dve nedelje vidljivosti za aktivno zapošljavanje.' },
  { credits: 3, days: 30, label: '30 dana', description: 'Najbolja opcija za ozbiljnu potragu.' },
] as const;

export const TEST_CREDIT_PACKAGES = [
  { credits: 1, label: '+1 kredit' },
  { credits: 3, label: '+3 kredita' },
  { credits: 5, label: '+5 kredita' },
  { credits: 10, label: '+10 kredita' },
] as const;

export type CreditDuration = (typeof CREDIT_DURATION_OPTIONS)[number]['credits'];
export type TestCreditPackage = (typeof TEST_CREDIT_PACKAGES)[number]['credits'];

export const creditService = {
  async getBalance() {
    try {
      const { data, error } = await supabase.rpc('get_company_credit_balance');
      if (error) throw error;
      return Number(data || 0);
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('company_credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as CompanyCreditTransaction[];
    } catch (error) {
      throw handleError(error);
    }
  },

  async addTestCredits(credits: TestCreditPackage) {
    try {
      const { data, error } = await supabase.rpc('grant_company_test_credits', {
        credit_count: credits,
      });
      if (error) throw error;
      return Number(data || 0);
    } catch (error) {
      throw handleError(error);
    }
  },

  async activateJob(jobId: string, credits: CreditDuration) {
    try {
      const { data, error } = await supabase.rpc('activate_job_with_credits', {
        target_job_id: jobId,
        credit_count: credits,
      });
      if (error) throw error;
      return data as JobListing;
    } catch (error) {
      throw handleError(error);
    }
  },

  async boostJob(jobId: string) {
    try {
      const { data, error } = await supabase.rpc('boost_job_with_credits', {
        target_job_id: jobId,
      });
      if (error) throw error;
      return data as JobListing;
    } catch (error) {
      throw handleError(error);
    }
  },

  async resumePaidJob(jobId: string) {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .update({
          status: 'active',
          is_active: true,
          is_draft: false,
        })
        .eq('id', jobId)
        .gt('expires_at', new Date().toISOString())
        .select('*')
        .single();

      if (error) throw error;
      return data as JobListing;
    } catch (error) {
      throw handleError(error);
    }
  },

  async expireOldJobs() {
    try {
      const { error } = await supabase.rpc('expire_old_job_listings');
      if (error) throw error;
    } catch {
      // Expiry is a maintenance helper; never block the UI if it fails.
    }
  },
};
