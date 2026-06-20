import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { ExperienceItem, ExperienceVerification } from '../../types';
import { findExperienceVerification, verificationService } from '../../services/verificationService';
import { useNotifications } from '../../hooks/useNotifications';

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { unread } = useNotifications();

  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifications, setVerifications] = useState<ExperienceVerification[]>([]);
  const [isVerificationAdmin, setIsVerificationAdmin] = useState(false);

  const isCompany = profile?.user_type === 'company';

  const fetchDetails = async () => {
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const table = isCompany ? 'company_profiles' : 'candidate_profiles';
    const { data } = await supabase.from(table).select('*').eq('id', user.id).maybeSingle();

    const [admin, verificationRows] = await Promise.all([
      verificationService.isAdmin(user.id),
      isCompany
        ? Promise.resolve([] as ExperienceVerification[])
        : verificationService.fetchCandidateVerifications(user.id).catch(() => []),
    ]);

    setDetails(data);
    setIsVerificationAdmin(admin);
    setVerifications(verificationRows);
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
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  const displayName = isCompany ? details?.company_name || 'Firma' : profile?.full_name || 'Kandidat';

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[COLORS.dark, '#111827', COLORS.dark]} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.inner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.pageInner}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>{isCompany ? 'Company workspace' : 'Candidate workspace'}</Text>
              <Text style={styles.header}>Moj profil</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color={COLORS.primarySoft} />
                {unread > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{Math.min(unread, 99)}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('EditProfile')}>
                <Ionicons name="create-outline" size={22} color={COLORS.primarySoft} />
              </TouchableOpacity>
            </View>
          </View>

          <LinearGradient colors={['rgba(124,92,255,0.26)', 'rgba(54,209,220,0.12)']} style={styles.heroCard}>
            <View style={styles.avatarWrap}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name={isCompany ? 'business' : 'person'} size={46} color={COLORS.primarySoft} />
              )}
            </View>

            <Text style={styles.name}>{displayName}</Text>
            <View style={styles.typePill}>
              <Ionicons name={isCompany ? 'business-outline' : 'sparkles-outline'} size={14} color={COLORS.primarySoft} />
              <Text style={styles.type}>{isCompany ? 'Firma' : 'Kandidat'}</Text>
            </View>

            {!!profile?.location && (
              <Text style={styles.meta}>
                <Ionicons name="location-outline" size={14} color={COLORS.textMuted} /> {profile.location}
              </Text>
            )}

            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </LinearGradient>

          {isVerificationAdmin && (
            <><TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate('VerificationAdmin')}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#6ee7b7" />
              <View style={styles.adminButtonCopy}>
                <Text style={styles.adminButtonTitle}>Provera dokumenata</Text>
                <Text style={styles.adminButtonText}>Otvori zahteve kandidata</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate('ReportsAdmin')}>
              <Ionicons name="warning-outline" size={20} color={COLORS.secondary} />
              <View style={styles.adminButtonCopy}><Text style={styles.adminButtonTitle}>Prijave korisnika</Text><Text style={styles.adminButtonText}>Otvori moderation red</Text></View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity></>
          )}

          {isCompany ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Podaci firme</Text>
              <Info icon="business-outline" label="Naziv firme" value={details?.company_name} />
              <Info icon="layers-outline" label="Industrija" value={details?.industry} />
              <Info icon="people-outline" label="Velicina firme" value={details?.company_size} />
              <Info icon="globe-outline" label="Website" value={details?.website} />
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Podaci kandidata</Text>
              <Info icon="briefcase-outline" label="Pozicija koju trazi" value={details?.position || 'Nije navedeno'} />

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
                details.experience_items.map((item: ExperienceItem, index: number) => {
                  const verification = findExperienceVerification(verifications, item, index);
                  return (
                    <View key={index} style={styles.expCard}>
                      <View style={styles.expHeader}>
                        <View style={styles.expHeading}>
                          <Text style={styles.expTitle}>{item.position}</Text>
                          {!!item.company && <Text style={styles.expCompany}>{item.company}</Text>}
                        </View>
                        <VerificationBadge status={verification?.status} />
                      </View>
                      <Text style={styles.expDuration}>{item.duration}</Text>
                      {!!item.description && <Text style={styles.expDesc}>{item.description}</Text>}
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={() => navigation.navigate('ExperienceVerification', { experience: item, experienceIndex: index })}
                      >
                        <Ionicons
                          name={verification?.status === 'verified' ? 'shield-checkmark' : 'document-attach-outline'}
                          size={17}
                          color={verification?.status === 'verified' ? '#6ee7b7' : COLORS.primarySoft}
                        />
                        <Text style={[styles.verifyButtonText, verification?.status === 'verified' && styles.verifiedText]}>
                          {verification ? 'Detalji verifikacije' : 'Verifikuj iskustvo'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Iskustvo nije dodato.</Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.editButtonText}>Izmeni profil</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.secondary} />
            <Text style={styles.signOutText}>Odjavi se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function VerificationBadge({ status }: { status?: ExperienceVerification['status'] }) {
  if (!status) return null;
  const labels = {
    pending: 'Na proveri',
    verified: 'Verifikovano',
    rejected: 'Odbijeno',
    changes_requested: 'Dopuna potrebna',
  };
  return (
    <View style={[styles.statusBadge, styles[`status_${status}`]]}>
      <Text style={styles.statusText}>{labels[status]}</Text>
    </View>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={17} color={COLORS.primarySoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Nije navedeno'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark },
  container: { flex: 1 },
  inner: { padding: 20, paddingTop: 58, paddingBottom: 124, alignItems: 'center' },
  center: {
    flex: 1,
    backgroundColor: COLORS.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageInner: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
    alignSelf: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  header: { color: COLORS.white, fontSize: 34, fontWeight: '900', marginTop: 4 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  notificationBadge: { position: 'absolute', right: -4, top: -5, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary },
  notificationBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '900' },
  heroCard: {
    width: '100%',
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarWrap: {
    width: 114,
    height: 114,
    borderRadius: 34,
    backgroundColor: COLORS.glassStrong,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 32,
  },
  name: { color: COLORS.white, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  type: { color: COLORS.primarySoft, fontWeight: '900', fontSize: 12 },
  meta: { color: COLORS.textMuted, marginTop: 12, fontWeight: '700' },
  bio: { color: COLORS.textSoft, textAlign: 'center', marginTop: 14, lineHeight: 22 },
  section: {
    width: '100%',
    backgroundColor: 'rgba(16, 19, 29, 0.92)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: { color: COLORS.white, fontSize: 21, fontWeight: '900', marginBottom: 14 },
  sectionTitleSmall: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 10,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: COLORS.textMuted, marginBottom: 4, fontSize: 12, fontWeight: '800' },
  infoValue: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 6 },
  tag: {
    backgroundColor: 'rgba(124, 92, 255, 0.18)',
    borderColor: 'rgba(124, 92, 255, 0.36)',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagText: { color: COLORS.primarySoft, fontWeight: '800' },
  expCard: {
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  expTitle: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  expHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  expHeading: { flex: 1 },
  expCompany: { color: COLORS.textSoft, fontWeight: '800', marginTop: 3 },
  expDuration: { color: COLORS.primarySoft, marginTop: 4, fontWeight: '800' },
  expDesc: { color: COLORS.textMuted, marginTop: 8, lineHeight: 20 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  status_pending: { backgroundColor: 'rgba(250, 204, 21, 0.12)', borderColor: 'rgba(250, 204, 21, 0.4)' },
  status_verified: { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.4)' },
  status_rejected: { backgroundColor: COLORS.dangerBg, borderColor: 'rgba(255, 95, 126, 0.4)' },
  status_changes_requested: { backgroundColor: 'rgba(251, 146, 60, 0.12)', borderColor: 'rgba(251, 146, 60, 0.4)' },
  statusText: { color: COLORS.white, fontWeight: '900', fontSize: 10 },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  verifyButtonText: { color: COLORS.primarySoft, fontWeight: '900', fontSize: 13 },
  verifiedText: { color: '#6ee7b7' },
  adminButton: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(52, 211, 153, 0.09)', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.28)', borderRadius: 18, padding: 15, marginBottom: 16 },
  adminButtonCopy: { flex: 1 },
  adminButtonTitle: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
  adminButtonText: { color: COLORS.textMuted, marginTop: 2, fontSize: 12 },
  emptyText: { color: COLORS.textMuted },
  editButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  editButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  signOutButton: {
    width: '100%',
    backgroundColor: COLORS.dangerBg,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 126, 0.28)',
  },
  signOutText: { color: COLORS.secondary, fontWeight: '900', fontSize: 16 },
});
