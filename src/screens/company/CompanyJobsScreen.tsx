import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { JobListing } from '../../types';

export default function CompanyJobsScreen({ navigation }: any) {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Greška', error.message);
    } else {
      setJobs(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [user])
  );

  const updateJobStatus = async (jobId: string, status: 'active' | 'paused' | 'filled') => {
    const { error } = await supabase
      .from('job_listings')
      .update({
        status,
        is_active: status === 'active',
      })
      .eq('id', jobId);

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    fetchJobs();
  };

  const deleteJob = async (jobId: string) => {
    const { error } = await supabase.from('job_listings').delete().eq('id', jobId);

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    fetchJobs();
  };

  const getStatusLabel = (status?: string, isActive?: boolean) => {
    if (status === 'filled') return 'Popunjen';
    if (status === 'paused') return 'Pauziran';
    if (status === 'active' || isActive) return 'Aktivan';
    return 'Pauziran';
  };

  const getStatusStyle = (status?: string, isActive?: boolean) => {
    if (status === 'filled') return styles.filled;
    if (status === 'paused') return styles.inactive;
    if (status === 'active' || isActive) return styles.active;
    return styles.inactive;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Moji oglasi</Text>
          <Text style={styles.subtitle}>Upravljaj statusom oglasa.</Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateJob')}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchJobs();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nema oglasa</Text>
            <Text style={styles.emptyText}>Klikni + i dodaj prvi oglas.</Text>
          </View>
        }
        renderItem={({ item }: any) => (
          <View style={styles.card}>
            <Text style={styles.jobTitle}>{item.title}</Text>
            <Text style={styles.jobMeta}>📍 {item.location || 'Bez lokacije'}</Text>

            {!!item.job_type && <Text style={styles.jobMeta}>🕒 {item.job_type}</Text>}

            {!!item.description && <Text style={styles.description}>{item.description}</Text>}

            {!!item.skills_required?.length && (
              <Text style={styles.skills}>Veštine: {item.skills_required.join(', ')}</Text>
            )}

            <Text style={[styles.status, getStatusStyle(item.status, item.is_active)]}>
              {getStatusLabel(item.status, item.is_active)}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.smallButton, styles.buttonSpacing]}
                onPress={() => updateJobStatus(item.id, 'active')}
              >
                <Text style={styles.smallButtonText}>Aktiviraj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => updateJobStatus(item.id, 'paused')}
              >
                <Text style={styles.smallButtonText}>Pauziraj</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.filledButton, styles.buttonSpacing]}
                onPress={() => updateJobStatus(item.id, 'filled')}
              >
                <Text style={styles.filledButtonText}>Popunjen</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteJob(item.id)}>
                <Text style={styles.deleteButtonText}>Obriši</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  subtitle: { color: '#888', marginTop: 4 },
  addButton: {
    backgroundColor: '#6C63FF',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: -2 },
  list: { padding: 24, paddingTop: 0, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  emptyText: { color: '#888', marginTop: 8 },
  card: {
    backgroundColor: '#11131f',
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  jobTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  jobMeta: { color: '#c7c7d4', marginBottom: 8, fontSize: 13, lineHeight: 20 },
  description: { color: '#d5d5e0', marginTop: 10, lineHeight: 20 },
  skills: { color: '#8f94ff', marginTop: 12, fontWeight: '700' },
  status: {
    marginTop: 14,
    fontWeight: 'bold',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  active: { color: '#4ade80' },
  inactive: { color: '#f87171' },
  filled: { color: '#facc15' },
  actions: { flexDirection: 'row', marginTop: 14 },
  buttonSpacing: { marginRight: 10 },
  smallButton: {
    flex: 1,
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: 'bold' },
  filledButton: {
    flex: 1,
    backgroundColor: '#2a220b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  filledButtonText: { color: '#facc15', fontWeight: 'bold' },
  deleteButton: {
    flex: 1,
    backgroundColor: '#2a1111',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#ff5c5c', fontWeight: 'bold' },
});