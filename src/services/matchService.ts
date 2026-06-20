import { supabase } from '../lib/supabase';
import { handleError } from '../lib/errors';

export const matchService = {
  async fetchMatches(userId: string, userType: 'candidate' | 'company') {
    try {
      const column = userType === 'candidate' ? 'candidate_id' : 'company_id';

      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*, job_listings(id, title, location)')
        .eq(column, userId)
        .order('created_at', { ascending: false });

      if (matchesError) throw matchesError;
      const matchList = matches ?? [];

      const candidateIds = Array.from(
        new Set(matchList.map((match: any) => match.candidate_id).filter(Boolean))
      );
      const companyIds = Array.from(
        new Set(matchList.map((match: any) => match.company_id).filter(Boolean))
      );

      const [candidateProfilesResponse, companyProfilesResponse] = await Promise.all([
        candidateIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, location, avatar_url')
              .in('id', candidateIds)
          : Promise.resolve({ data: [], error: null }),
        companyIds.length > 0
          ? supabase
              .from('company_profiles')
              .select('id, company_name, industry')
              .in('id', companyIds)
          : Promise.resolve({ data: [], error: null }),
      ] as const);

      if (candidateProfilesResponse.error) throw candidateProfilesResponse.error;
      if (companyProfilesResponse.error) throw companyProfilesResponse.error;

      const candidateMap = (candidateProfilesResponse.data ?? []).reduce(
        (acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        },
        {}
      );

      const companyMap = (companyProfilesResponse.data ?? []).reduce(
        (acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        },
        {}
      );

      return matchList.map((match: any) => ({
        ...match,
        profiles: candidateMap[match.candidate_id] || null,
        company_profiles: companyMap[match.company_id] || null,
      }));
    } catch (error) {
      throw handleError(error);
    }
  },

  async fetchMatchById(matchId: string) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async createMatch(candidateId: string, companyId: string, jobId: string) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          candidate_id: candidateId,
          company_id: companyId,
          job_id: jobId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async deleteMatch(matchId: string) {
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;
    } catch (error) {
      throw handleError(error);
    }
  },
};
