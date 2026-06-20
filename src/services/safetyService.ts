import { supabase } from '../lib/supabase';
import { UserReport } from '../types';

export const safetyService = {
  async fetchBlockedIds(userId: string) {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id, blocked_user_id')
      .or(`blocker_id.eq.${userId},blocked_user_id.eq.${userId}`);
    if (error) return [] as string[];
    return (data || []).map((row) => row.blocker_id === userId ? row.blocked_user_id : row.blocker_id);
  },

  async block(userId: string, blockedUserId: string) {
    const { error } = await supabase.from('user_blocks').upsert({
      blocker_id: userId,
      blocked_user_id: blockedUserId,
    });
    if (error) throw error;
  },

  async report(input: { reporterId: string; reportedUserId: string; matchId?: string | null; reason: string; details?: string }) {
    const { error } = await supabase.from('user_reports').insert({
      reporter_id: input.reporterId,
      reported_user_id: input.reportedUserId,
      match_id: input.matchId || null,
      reason: input.reason,
      details: input.details?.trim() || null,
    });
    if (error) throw error;
  },

  async fetchReports(status: 'pending' | 'all' = 'pending') {
    let query = supabase.from('user_reports').select('*').order('created_at', { ascending: true });
    if (status === 'pending') query = query.eq('status', 'pending');
    const { data, error } = await query;
    if (error) throw error;
    const reports = (data || []) as UserReport[];
    const ids = [...new Set(reports.flatMap((report) => [report.reporter_id, report.reported_user_id]))];
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, full_name, user_type').in('id', ids)
      : { data: [] };
    const map = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return reports.map((report) => ({
      ...report,
      reporter: map.get(report.reporter_id),
      reported_user: map.get(report.reported_user_id),
    }));
  },

  async reviewReport(id: string, status: 'reviewed' | 'dismissed' | 'actioned', adminNote?: string) {
    const { error } = await supabase
      .from('user_reports')
      .update({ status, admin_note: adminNote?.trim() || null })
      .eq('id', id);
    if (error) throw error;
  },
};

