import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

export default function ViewProfileScreen({ route, navigation }: any) {
  const { profileId, userType } = route.params;

  const [baseProfile, setBaseProfile] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isCompany = userType === 'company';

  const fetchProfile = async () => {
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    const table = isCompany ? 'company_profiles' : 'candidate_profiles';

    const { data: detailsData } = await supabase
      .from(table)
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    setBaseProfile(profileData);
    setDetails(detailsData);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [profileId, userType])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.pageInner}>
        <TouchableOpacity
          onPress={() => {
        if (route.params?.returnTo) {
        navigation.navigate(route.params.returnTo);
        } else {
        navigation.goBack();
        }
    }}
    style={styles.backButton}
    >
    <Text style={styles.backText}>‹ Nazad</Text>
    </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.avatar}>{isCompany ? '🏢' : '👤'}</Text>

        <Text style={styles.name}>
          {isCompany
            ? details?.company_name || 'Firma'
            : baseProfile?.full_name || 'Kandidat'}
        </Text>

        <Text style={styles.type}>{isCompany ? 'Firma' : 'Kandidat'}</Text>

        {!!baseProfile?.location && (
          <Text style={styles.meta}>📍 {baseProfile.location}</Text>
        )}

        {!!baseProfile?.bio && (
          <Text style={styles.bio}>{baseProfile.bio}</Text>
        )}
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
            <>
              <Text style={styles.sectionTitleSmall}>Veštine</Text>
              <View style={styles.tags}>
                {details.skills.map((skill: string, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </>
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
  inner: { padding: 24, paddingTop: 55, paddingBottom: 110, alignItems: 'center' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: { marginBottom: 18 },
  backText: { color: '#6C63FF', fontWeight: 'bold', fontSize: 16 },
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
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 14 },
  sectionTitleSmall: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 10,
  },
  infoRow: {
    borderBottomColor: '#252525',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  infoLabel: { color: '#777', marginBottom: 4 },
  infoValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
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
});