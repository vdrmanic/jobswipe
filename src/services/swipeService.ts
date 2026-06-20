import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';
import { SwipeAction } from '../types';

export const swipeService = {
  async recordSwipe(swipe: SwipeAction) {
    try {
      const { error } = await supabase.from('swipes').insert(swipe);
      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchSwipedIds(
    userId: string,
    targetType: 'job' | 'candidate',
  ): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('swipes')
        .select('target_id')
        .eq('swiper_id', userId)
        .eq('target_type', targetType);

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
};
