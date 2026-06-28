import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants';
import { supabase } from '../../lib/supabase';
import { JobListing, PipelineStage } from '../../types';

const stages: { key: PipelineStage; label: string; color: string }[] = [
  { key: 'new', label: 'Novi', color: '#9da7ff' },
  { key: 'contacted', label: 'Kontaktirani', color: '#67d7ff' },
  { key: 'interview', label: 'Intervju', color: '#f8c45c' },
  { key: 'offer', label: 'Ponuda', color: '#65e6a7' },
  { key: 'rejected', label: 'Odbijeni', color: '#ff7d8b' },
];

export default function JobDashboardScreen({ route, navigation }: any) {
  const job = route.params.job as JobListing;
  const [tab, setTab] = useState<'pipeline' | 'analytics'>('pipeline');
  const [selectedStage, setSelectedStage] = useState<PipelineStage>('new');
  const [matches, setMatches] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ views: 0, decisions: 0, likes: 0, matches: 0 });
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    const [matchResult, swipeResult, viewResult] = await Promise.all([
      supabase.from('matches').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
      supabase.from('swipes').select('direction, target_type').eq('job_id', job.id),
      supabase.from('job_view_events').select('id', { count: 'exact', head: true }).eq('job_id', job.id),
    ]);

    if (matchResult.error || swipeResult.error || viewResult.error) {
      Alert.alert('Greška', matchResult.error?.message || swipeResult.error?.message || viewResult.error?.message || 'Podaci nisu dostupni.');
      setLoading(false);
      return;
    }

    const candidateIds = (matchResult.data || []).map((match) => match.candidate_id);
    let profiles: any[] = [];
    if (candidateIds.length) {
      const [profileResult, candidateProfileResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, location').in('id', candidateIds),
        supabase.from('candidate_profiles').select('id, position, skills').in('id', candidateIds),
      ]);
      if (profileResult.error) {
        Alert.alert('Greška profila', profileResult.error.message);
      }
      const candidateProfileMap = new Map((candidateProfileResult.data || []).map((candidateProfile) => [candidateProfile.id, candidateProfile]));
      profiles = (profileResult.data || []).map((profile) => ({
        ...profile,
        candidate_profiles: candidateProfileMap.get(profile.id),
      }));
    }

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    setMatches((matchResult.data || []).map((match) => ({ ...match, candidate: profileMap.get(match.candidate_id) })));
    const companyDecisions = (swipeResult.data || []).filter((swipe) => swipe.target_type === 'candidate');
    setAnalytics({
      views: viewResult.count || 0,
      decisions: companyDecisions.length,
      likes: companyDecisions.filter((swipe) => swipe.direction === 'right').length,
      matches: (matchResult.data || []).length,
    });
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadDashboard(); }, [job.id]));

  const moveCandidate = async (matchId: string, pipelineStage: PipelineStage) => {
    const { error } = await supabase.from('matches').update({ pipeline_stage: pipelineStage }).eq('id', matchId);
    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }
    setMatches((current) => current.map((match) => match.id === matchId ? { ...match, pipeline_stage: pipelineStage } : match));
    setSelectedStage(pipelineStage);
  };

  const visibleMatches = matches.filter((match) => (match.pipeline_stage || 'new') === selectedStage);
  const maxMetric = Math.max(analytics.views, analytics.decisions, analytics.likes, analytics.matches, 1);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primarySoft} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PREGLED OGLASA</Text>
          <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['pipeline', 'analytics'] as const).map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}>
            <Ionicons name={item === 'pipeline' ? 'people-outline' : 'stats-chart-outline'} size={18} color={tab === item ? COLORS.white : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'pipeline' ? 'Kandidati' : 'Analitika'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'pipeline' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
            {stages.map((stage) => {
              const count = matches.filter((match) => (match.pipeline_stage || 'new') === stage.key).length;
              return (
                <TouchableOpacity key={stage.key} style={[styles.stageChip, selectedStage === stage.key && { borderColor: stage.color, backgroundColor: `${stage.color}18` }]} onPress={() => setSelectedStage(stage.key)}>
                  <Text style={[styles.stageText, selectedStage === stage.key && { color: stage.color }]}>{stage.label}</Text>
                  <View style={styles.stageCount}><Text style={styles.stageCountText}>{count}</Text></View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {visibleMatches.length ? visibleMatches.map((match) => {
            const candidate = match.candidate;
            return (
              <View key={match.id} style={styles.candidateCard}>
                {candidate?.avatar_url ? <Image source={{ uri: candidate.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Ionicons name="person" size={24} color={COLORS.primarySoft} /></View>}
                <View style={styles.candidateCopy}>
                  <Text style={styles.candidateName}>{candidate?.full_name || 'Kandidat'}</Text>
                  <Text style={styles.candidateMeta}>{candidate?.location || candidate?.candidate_profiles?.skills?.slice(0, 2).join(' • ') || 'Profil kandidata'}</Text>
                </View>
                <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { match: { ...match, otherName: candidate?.full_name, jobTitle: job.title, job_listings: job } })}>
                  <Ionicons name="chatbubble-outline" size={18} color={COLORS.primarySoft} />
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moveRow}>
                  {stages.filter((stage) => stage.key !== (match.pipeline_stage || 'new')).map((stage) => (
                    <TouchableOpacity key={stage.key} style={styles.moveButton} onPress={() => moveCandidate(match.id, stage.key)}>
                      <Text style={styles.moveText}>{stage.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          }) : (
            <View style={styles.empty}><Ionicons name="file-tray-outline" size={34} color={COLORS.textMuted} /><Text style={styles.emptyTitle}>Nema kandidata u ovoj fazi</Text></View>
          )}
        </>
      ) : (
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>Učinak oglasa</Text>
          {[
            ['Pregledi', analytics.views, '#9da7ff'],
            ['Pregledani kandidati', analytics.decisions, '#67d7ff'],
            ['Lajkovi firme', analytics.likes, '#ff79bb'],
            ['Matchevi', analytics.matches, '#65e6a7'],
          ].map(([label, value, color]) => (
            <View key={String(label)} style={styles.metric}>
              <View style={styles.metricHeader}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>
              <View style={styles.metricTrack}><View style={[styles.metricFill, { width: `${Math.max(4, (Number(value) / maxMetric) * 100)}%`, backgroundColor: String(color) }]} /></View>
            </View>
          ))}
          <View style={styles.conversionBox}>
            <Text style={styles.conversionValue}>{analytics.views ? Math.round((analytics.matches / analytics.views) * 100) : 0}%</Text>
            <Text style={styles.conversionLabel}>konverzija pregleda u match</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dark },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: COLORS.white, fontSize: 25, fontWeight: '900', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 18, padding: 5, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textMuted, fontWeight: '800' },
  tabTextActive: { color: COLORS.white },
  stageRow: { gap: 8, paddingVertical: 2 },
  stageChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  stageText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '900' },
  stageCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  stageCountText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  candidateCard: { padding: 15, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  avatar: { width: 50, height: 50, borderRadius: 16 },
  avatarFallback: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  candidateCopy: { flex: 1, minWidth: 150 },
  candidateName: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  candidateMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
  chatButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  moveRow: { gap: 7, width: '100%' },
  moveButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  moveText: { color: COLORS.textSoft, fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 10, padding: 42, borderRadius: 22, backgroundColor: COLORS.card },
  emptyTitle: { color: COLORS.textMuted, fontWeight: '800' },
  analyticsCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, gap: 18 },
  analyticsTitle: { color: COLORS.white, fontSize: 20, fontWeight: '900' },
  metric: { gap: 7 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: COLORS.textSoft, fontSize: 13, fontWeight: '700' },
  metricValue: { color: COLORS.white, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricTrack: { height: 9, borderRadius: 999, backgroundColor: COLORS.glass, overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 999 },
  conversionBox: { alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: 'rgba(108,99,255,0.12)' },
  conversionValue: { color: COLORS.white, fontSize: 34, fontWeight: '900' },
  conversionLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
});
