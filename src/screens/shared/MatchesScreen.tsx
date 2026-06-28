import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { matchService } from '../../services';
import { COLORS } from '../../constants';
import { formatDateTime } from '../../utils/helpers';

export default function MatchesScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const { width } = useWindowDimensions();

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(async () => {
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const matchesData = await matchService.fetchMatches(user.id, profile.user_type);
      const matchIds = matchesData.map((m) => m.id);
      let unreadMap: Record<string, number> = {};

      if (matchIds.length > 0) {
        const { data: unreadMessages } = await supabase
          .from('messages')
          .select('match_id')
          .in('match_id', matchIds)
          .neq('sender_id', user.id)
          .eq('read', false);

        unreadMap = (unreadMessages || []).reduce((acc: any, msg: any) => {
          acc[msg.match_id] = (acc[msg.match_id] || 0) + 1;
          return acc;
        }, {});
      }

      const prepared = matchesData.map((match: any) => {
        const isCandidate = profile.user_type === 'candidate';
        const otherProfile = isCandidate ? match.company_profiles : match.profiles;
        const jobData = match.job_listings;

        return {
          ...match,
          otherName: otherProfile?.company_name || otherProfile?.full_name || 'Kontakt',
          otherMeta: otherProfile?.industry || otherProfile?.location || '',
          jobTitle: jobData?.title || 'Oglas',
          jobLocation: jobData?.location || '',
          unreadCount: unreadMap[match.id] || 0,
        };
      });

      setMatches(prepared);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.log('MATCHES ERROR:', error);
      Alert.alert('Greška', 'Nije moguće učitati mečeve');
      setMatches([]);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, profile?.user_type]);

  useFocusEffect(
    useCallback(() => {
      fetchMatches();
    }, [fetchMatches])
  );

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase
      .channel(`matches-list-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.user_type, fetchMatches]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.dark, '#111827', COLORS.dark]} style={StyleSheet.absoluteFill} />
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.header}>Mečevi</Text>
          <Text style={styles.subtitle}>Konverzacije gde su obe strane rekle da.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="chatbubbles" size={26} color={COLORS.primarySoft} />
        </View>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: width > 760 ? (width - 760) / 2 : 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchMatches();
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={28} color={COLORS.primarySoft} />
            </View>
            <Text style={styles.emptyTitle}>Još nema mečeva</Text>
            <Text style={styles.emptyText}>
              Kad obe strane kliknu "Sviđa mi se", pojaviše se ovde.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.unreadCount > 0 && styles.unreadCard]}
            onPress={() => navigation.navigate('Chat', { match: item })}
            activeOpacity={0.86}
          >
            <View style={styles.cardTop}>
              <View style={styles.avatarBubble}>
                <Ionicons name="person" size={18} color={COLORS.primarySoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.otherName}</Text>
                {!!item.otherMeta && <Text style={styles.meta}>{item.otherMeta}</Text>}
              </View>

              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.jobPill}>
              <Ionicons name="briefcase" size={15} color={COLORS.accent} />
              <Text style={styles.jobTitle}>{item.jobTitle}</Text>
            </View>

            {!!item.jobLocation && <Text style={styles.meta}>Lokacija posla: {item.jobLocation}</Text>}
            {!!item.pipeline_stage && (
              <View style={styles.pipelinePill}>
                <Ionicons name="git-branch-outline" size={14} color={COLORS.primarySoft} />
                <Text style={styles.pipelineText}>
                  {({ new: 'Novi match', contacted: 'Kontaktiran', interview: 'Intervju', offer: 'Ponuda', rejected: 'Proces završen' } as Record<string, string>)[item.pipeline_stage] || item.pipeline_stage}
                </Text>
              </View>
            )}
            {!!item.interview_at && <Text style={styles.interviewText}>Intervju: {formatDateTime(item.interview_at)}</Text>}

            {item.unreadCount > 0 ? (
              <Text style={styles.unreadText}>Nova poruka čeka odgovor</Text>
            ) : (
              <Text style={styles.matchDate}>Nema novih poruka - {formatDateTime(item.created_at)}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  center: {
    flex: 1,
    backgroundColor: COLORS.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  subtitle: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
  },
  list: { paddingBottom: 118 },
  empty: { alignItems: 'center', marginTop: 86, paddingHorizontal: 24 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: COLORS.white, fontSize: 22, fontWeight: '900' },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(16, 19, 29, 0.92)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
    boxShadow: '0px 18px 40px rgba(0, 0, 0, 0.20)',
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  unreadCard: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(124, 92, 255, 0.18)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  avatarBubble: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: COLORS.white, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  meta: { color: COLORS.textMuted, marginTop: 5, fontSize: 13, lineHeight: 18 },
  pipelinePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(108,99,255,0.12)', borderWidth: 1, borderColor: 'rgba(157,167,255,0.20)' },
  pipelineText: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '900' },
  interviewText: { color: COLORS.gold, marginTop: 8, fontSize: 12, fontWeight: '800' },
  jobPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(54, 209, 220, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(54, 209, 220, 0.28)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  jobTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  matchDate: { color: '#7F89A8', marginTop: 10, fontSize: 12, lineHeight: 18 },
  unreadText: {
    color: COLORS.mint,
    marginTop: 10,
    fontSize: 13,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: COLORS.secondary,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  badgeText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
});
