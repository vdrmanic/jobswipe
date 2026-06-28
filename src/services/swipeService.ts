import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { SwipeAction } from '../types';

export const swipeService = {
  async recordSwipe(swipe: SwipeAction) {
    try {
      const swipeWithDecisionTime = {
        ...swipe,
        decided_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('swipes')
        .upsert(swipeWithDecisionTime, { onConflict: 'swiper_id,target_id,target_type,job_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchSwipedIds(
    userId: string,
    targetType: 'job' | 'candidate',
    jobId?: string,
  ): Promise<string[]> {
    try {
      let query = supabase
        .from('swipes')
        .select('target_id')
        .eq('swiper_id', userId)
        .eq('target_type', targetType);
      if (jobId) query = query.eq('job_id', jobId);
      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map((s) => s.target_id);
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchSwipeStats(userId: string, userType: 'candidate' | 'company') {
    try {
      const targetType = userType === 'candidate' ? 'job' : 'candidate';

      const { count: rightSwipes } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', userId)
        .eq('direction', 'right')
        .eq('target_type', targetType);

      const { count: leftSwipes } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', userId)
        .eq('direction', 'left')
        .eq('target_type', targetType);

      return {
        rightSwipes: rightSwipes || 0,
        leftSwipes: leftSwipes || 0,
      };
    } catch (error) {
      throw handleError(error);
    }
  },

  async resetCandidateDecisions(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('reset_candidate_swipes_after_30_days');
      if (error) throw error;
      return Number(data || 0);
    } catch (error) {
      throw handleError(error);
    }
  },

  async resetCompanyJobDecisions(jobId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('reset_company_job_swipes_after_30_days', {
        target_job_id: jobId,
      });
      if (error) throw error;
      return Number(data || 0);
    } catch (error) {
      throw handleError(error);
    }
  },
};
