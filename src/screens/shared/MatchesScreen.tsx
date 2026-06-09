import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function MatchesScreen({ navigation }: any) {
  const { user, profile } = useAuth();

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async () => {
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);

    const column = profile.user_type === 'candidate' ? 'candidate_id' : 'company_id';

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq(column, user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('MATCHES ERROR:', error);
      setMatches([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let prepared = data || [];

    const jobIds = [...new Set(prepared.map((m) => m.job_id).filter(Boolean))];
    const matchIds = prepared.map((m) => m.id);

    let jobMap: any = {};
    let unreadMap: any = {};

    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from('job_listings')
        .select('id, title, location')
        .in('id', jobIds);

      jobMap = (jobs || []).reduce((acc: any, job: any) => {
        acc[job.id] = job;
        return acc;
      }, {});
    }

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

    if (profile.user_type === 'candidate') {
      const companyIds = [...new Set(prepared.map((m) => m.company_id).filter(Boolean))];

      let companyMap: any = {};

      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('company_profiles')
          .select('id, company_name, industry')
          .in('id', companyIds);

        companyMap = (companies || []).reduce((acc: any, company: any) => {
          acc[company.id] = company;
          return acc;
        }, {});
      }

      prepared = prepared.map((m) => ({
        ...m,
        otherName: companyMap[m.company_id]?.company_name || 'Firma',
        otherMeta: companyMap[m.company_id]?.industry || '',
        jobTitle: jobMap[m.job_id]?.title || 'Oglas',
        jobLocation: jobMap[m.job_id]?.location || '',
        unreadCount: unreadMap[m.id] || 0,
      }));
    } else {
      const candidateIds = [...new Set(prepared.map((m) => m.candidate_id).filter(Boolean))];

      let candidateMap: any = {};

      if (candidateIds.length > 0) {
        const { data: candidates } = await supabase
          .from('profiles')
          .select('id, full_name, location')
          .in('id', candidateIds);

        candidateMap = (candidates || []).reduce((acc: any, candidate: any) => {
          acc[candidate.id] = candidate;
          return acc;
        }, {});
      }

      prepared = prepared.map((m) => ({
        ...m,
        otherName: candidateMap[m.candidate_id]?.full_name || 'Kandidat',
        otherMeta: candidateMap[m.candidate_id]?.location || '',
        jobTitle: jobMap[m.job_id]?.title || 'Oglas',
        jobLocation: jobMap[m.job_id]?.location || '',
        unreadCount: unreadMap[m.id] || 0,
      }));
    }

    setMatches(prepared);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMatches();
    }, [user?.id, profile?.user_type])
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
}, [user?.id, profile?.user_type]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mečevi 💬</Text>
      <Text style={styles.subtitle}>Ljudi i firme koje su se međusobno lajkovali.</Text>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchMatches();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Još nema mečeva</Text>
            <Text style={styles.emptyText}>
              Kada obe strane kliknu “Sviđa mi se”, pojaviće se ovde.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              item.unreadCount > 0 && styles.unreadCard,
            ]}
            onPress={() => navigation.navigate('Chat', { match: item })}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.otherName}</Text>
                {!!item.otherMeta && <Text style={styles.meta}>📍 {item.otherMeta}</Text>}
              </View>

              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>

            <Text style={styles.jobTitle}>💼 {item.jobTitle}</Text>

            {!!item.jobLocation && (
              <Text style={styles.meta}>Lokacija posla: {item.jobLocation}</Text>
            )}

            {item.unreadCount > 0 ? (
              <Text style={styles.unreadText}>Nova poruka</Text>
            ) : (
              <Text style={styles.matchDate}>Nema novih poruka</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  subtitle: {
    color: '#888',
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 20,
  },
  list: { paddingHorizontal: 24, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  unreadCard: {
    borderColor: '#6C63FF',
    backgroundColor: '#17142a',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  meta: { color: '#aaa', marginBottom: 6 },
  jobTitle: {
    color: '#6C63FF',
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 6,
  },
  matchDate: { color: '#666', marginTop: 10, fontSize: 12 },
  unreadText: {
    color: '#4ade80',
    marginTop: 10,
    fontSize: 13,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#6C63FF',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});