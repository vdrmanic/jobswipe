import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCompany = profile?.user_type === 'company';

  const fetchDetails = async () => {
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const table = isCompany ? 'company_profiles' : 'candidate_profiles';

    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    setDetails(data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [user?.id, profile?.user_type])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await fetchDetails();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.pageInner}>
        <Text style={styles.header}>Moj profil</Text>

        <View style={styles.card}>
        {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
        ) : (
        <Text style={styles.avatar}>{isCompany ? '🏢' : '👤'}</Text>
    )}

        <Text style={styles.name}>
          {isCompany ? details?.company_name || 'Firma' : profile?.full_name || 'Kandidat'}
        </Text>

        <Text style={styles.type}>{isCompany ? 'Firma' : 'Kandidat'}</Text>

        {!!profile?.location && <Text style={styles.meta}>📍 {profile.location}</Text>}

        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {isCompany ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Podaci firme</Text>

          <Info label="Naziv firme" value={details?.company_name} />
          <Info label="Industrija" value={details?.industry} />
          <Info label="Veličina firme" value={details?.company_size} />
          <Info label="Website" value={details?.website} />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Podaci kandidata</Text>

          <Info label="Pozicija koju traži" value={details?.position || 'Nije navedeno'} />

          {!!details?.skills?.length && (
            <View style={styles.tags}>
              {details.skills.map((skill: string, index: number) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitleSmall}>Iskustvo</Text>

          {details?.experience_items?.length ? (
            details.experience_items.map((item: any, index: number) => (
              <View key={index} style={styles.expCard}>
                <Text style={styles.expTitle}>{item.position}</Text>
                <Text style={styles.expDuration}>{item.duration}</Text>
                {!!item.description && <Text style={styles.expDesc}>{item.description}</Text>}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Iskustvo nije dodato.</Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EditProfile')}
      >
        <Text style={styles.editButtonText}>Izmeni profil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Odjavi se</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Nije navedeno'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingTop: 60, paddingBottom: 110, alignItems: 'center' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  card: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: { fontSize: 56, marginBottom: 10 },
  name: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  type: { color: '#6C63FF', fontWeight: 'bold', marginTop: 6, marginBottom: 10 },
  meta: { color: '#aaa', marginTop: 4 },
  bio: { color: '#ddd', textAlign: 'center', marginTop: 14, lineHeight: 22 },
  section: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  pageInner: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
    alignSelf: 'center',
  },
  avatarImage: {
  width: 110,
  height: 110,
  borderRadius: 55,
  marginBottom: 10,
},
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 14 },
  sectionTitleSmall: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 10,
  },
  infoRow: {
    width: '100%',
    borderBottomColor: '#252525',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  infoLabel: { color: '#777', marginBottom: 4 },
  infoValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 6 },
  tag: {
    backgroundColor: '#1a1633',
    borderColor: '#6C63FF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { color: '#6C63FF', fontWeight: '600' },
  expCard: {
    backgroundColor: '#101010',
    borderColor: '#292929',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  expTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  expDuration: { color: '#6C63FF', marginTop: 4 },
  expDesc: { color: '#aaa', marginTop: 8, lineHeight: 20 },
  emptyText: { color: '#888' },
  editButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  editButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  signOutButton: {
    backgroundColor: '#2a1111',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#ff5c5c', fontWeight: 'bold', fontSize: 16 },
});