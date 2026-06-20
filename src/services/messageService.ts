import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';

export const messageService = {
  async fetchMessages(matchId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    } catch (error) {
      throw handleError(error);
    }
  },

  async sendMessage(matchId: string, senderId: string, content: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: senderId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async markMessagesAsRead(matchId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('match_id', matchId)
        .neq('sender_id', userId)
        .eq('read', false);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchUnreadCount(userId: string, userType: 'candidate' | 'company') {
    try {
      const column = userType === 'candidate' ? 'candidate_id' : 'company_id';

      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id')
        .eq(column, userId);

      if (matchesError) throw matchesError;

      const matchIds = matches?.map((m) => m.id) || [];
      if (matchIds.length === 0) return 0;

      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('match_id', matchIds)
        .neq('sender_id', userId)
        .eq('read', false);

      if (countError) throw countError;
      return count || 0;
    } catch (error) {
      throw handleError(error);
    }
  },
};
