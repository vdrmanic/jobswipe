import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { ExperienceItem, ExperienceVerification, ProfileVideo } from '../../types';
import { findExperienceVerification, verificationService } from '../../services/verificationService';
import { useNotifications } from '../../hooks/useNotifications';
import { continueProfileTutorialInEditor, subscribeProfileTutorial } from '../../utils/tutorial-flow';
import { profileVideoService } from '../../services/profileVideoService';
import { swipeService } from '../../services/swipeService';
import ProfileVideoCard from '../../components/ProfileVideoCard';

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { unread } = useNotifications();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifications, setVerifications] = useState<ExperienceVerification[]>([]);
  const [profileVideos, setProfileVideos] = useState<ProfileVideo[]>([]);
  const [isVerificationAdmin, setIsVerificationAdmin] = useState(false);
  const [profileTutorialVisible, setProfileTutorialVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const isCompany = profile?.user_type === 'company';

  useEffect(() => {
    return subscribeProfileTutorial(() => setProfileTutorialVisible(true));
  }, []);

  const openEditProfileTutorial = () => {
    setProfileTutorialVisible(false);
    continueProfileTutorialInEditor();
    navigation.navigate('EditProfile', { tutorial: true });
  };

  const fetchDetails = async () => {
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const table = isCompany ? 'company_profiles' : 'candidate_profiles';
    const { data } = await supabase.from(table).select('*').eq('id', user.id).maybeSingle();

    const [admin, verificationRows, videoRows] = await Promise.all([
      verificationService.isAdmin(user.id),
      isCompany
        ? Promise.resolve([] as ExperienceVerification[])
        : verificationService.fetchCandidateVerifications(user.id).catch(() => []),
      isCompany ? Promise.resolve([]) : profileVideoService.fetchProfileVideos(user.id).catch(() => []),
    ]);

    setDetails(data);
    setIsVerificationAdmin(admin);
    setVerifications(verificationRows);
    setProfileVideos(videoRows);
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

  const removeProfileVideo = async (videoId: string) => {
    try {
      await profileVideoService.deleteVideo(videoId);
      setProfileVideos((current) => current.filter((item) => item.id !== videoId));
    } catch (error: any) {
      Alert.alert('Video nije obrisan', error?.message || 'Pokušaj ponovo.');
    }
  };

  const resetCandidateDecisions = async () => {
    setResetBusy(true);
    try {
      const count = await swipeService.resetCandidateDecisions();
      setResetModalVisible(false);
      Alert.alert(
        count > 0 ? 'Odluke su resetovane' : 'Nema odluka za reset',
        count > 0
          ? `Resetovano je ${count} odluka starijih od 30 dana. Ti oglasi sada mogu opet da se pojave.`
          : 'Još nema tvojih odluka starijih od 30 dana.'
      );
    } catch (error: any) {
      Alert.alert('Reset nije uspeo', error?.message || 'Pokušaj ponovo.');
    } finally {
      setResetBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  const displayName = isCompany ? details?.company_name || 'Firma' : profile?.full_name || 'Kandidat';
  const avatarSource = isCompany ? details?.logo_url || profile?.avatar_url : profile?.avatar_url;
  const companyFields = [
    details?.company_name,
    details?.industry,
    details?.company_size,
    details?.website,
    profile?.location,
    profile?.bio,
    avatarSource,
  ];
  const completedCompanyFields = companyFields.filter(Boolean).length;
  const companyCompletion = Math.round((completedCompanyFields / companyFields.length) * 100);
  const companyProfileItems = [
    { icon: 'business-outline' as const, label: 'Naziv firme', value: details?.company_name, accent: '#7C5CFF' },
    { icon: 'layers-outline' as const, label: 'Industrija', value: details?.industry, accent: '#36D1DC' },
    { icon: 'people-outline' as const, label: 'Veličina firme', value: details?.company_size, accent: '#F8C45C' },
    { icon: 'globe-outline' as const, label: 'Website', value: details?.website, accent: '#86EFAC' },
    { icon: 'location-outline' as const, label: 'Lokacija', value: profile?.location, accent: '#FF4BA0' },
  ];

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
              <TouchableOpacity
                style={[styles.iconButton, profileTutorialVisible && styles.tutorialEditButton]}
                onPress={profileTutorialVisible ? openEditProfileTutorial : () => navigation.navigate('EditProfile')}
              >
                <Ionicons name="create-outline" size={22} color={COLORS.primarySoft} />
              </TouchableOpacity>
            </View>
          </View>

          {isCompany ? (
            <LinearGradient colors={['rgba(124,92,255,0.34)', 'rgba(54,209,220,0.13)', 'rgba(8,10,18,0.96)']} style={[styles.heroCard, styles.companyHeroCard]}>
              <View style={styles.companyHeroTop}>
                <View style={styles.companyLogoWrap}>
                  {avatarSource ? (
                    <Image source={{ uri: avatarSource }} style={styles.companyLogoImage} />
                  ) : (
                    <Ionicons name="business" size={42} color={COLORS.primarySoft} />
                  )}
                </View>
                <View style={styles.companyHeroCopy}>
                  <Text style={styles.companyEyebrow}>JAVNI PROFIL FIRME</Text>
                  <Text style={styles.companyName}>{displayName}</Text>
                  <View style={styles.companyHeroMetaRow}>
                    <View style={styles.companyMiniPill}>
                      <Ionicons name="sparkles-outline" size={13} color="#DCD7FF" />
                      <Text style={styles.companyMiniPillText}>Firma</Text>
                    </View>
                    {!!details?.industry && (
                      <View style={styles.companyMiniPill}>
                        <Ionicons name="layers-outline" size={13} color="#DCD7FF" />
                        <Text style={styles.companyMiniPillText}>{details.industry}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.companyProgressCard}>
                <View style={styles.companyProgressTop}>
                  <Text style={styles.companyProgressLabel}>Popunjenost profila</Text>
                  <Text style={styles.companyProgressValue}>{companyCompletion}%</Text>
                </View>
                <View style={styles.companyProgressTrack}>
                  <View style={[styles.companyProgressFill, { width: `${companyCompletion}%` }]} />
                </View>
                <Text style={styles.companyProgressHint}>
                  Što je profil potpuniji, kandidati lakše razumeju ko ste i zašto da se jave.
                </Text>
              </View>

              <View style={styles.companyQuickGrid}>
                <View style={styles.companyQuickCard}>
                  <Ionicons name="location-outline" size={18} color="#FF4BA0" />
                  <Text style={styles.companyQuickLabel}>Lokacija</Text>
                  <Text style={styles.companyQuickValue} numberOfLines={1}>{profile?.location || 'Dodaj lokaciju'}</Text>
                </View>
                <View style={styles.companyQuickCard}>
                  <Ionicons name="people-outline" size={18} color="#36D1DC" />
                  <Text style={styles.companyQuickLabel}>Tim</Text>
                  <Text style={styles.companyQuickValue} numberOfLines={1}>{details?.company_size || 'Nije navedeno'}</Text>
                </View>
              </View>

              {!!profile?.bio && <Text style={styles.companyBio}>{profile.bio}</Text>}
            </LinearGradient>
          ) : (
            <LinearGradient colors={['rgba(124,92,255,0.26)', 'rgba(54,209,220,0.12)']} style={styles.heroCard}>
              <View style={styles.avatarWrap}>
                {avatarSource ? (
                  <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={46} color={COLORS.primarySoft} />
                )}
              </View>

              <Text style={styles.name}>{displayName}</Text>
              <View style={styles.typePill}>
                <Ionicons name="sparkles-outline" size={14} color={COLORS.primarySoft} />
                <Text style={styles.type}>Kandidat</Text>
              </View>

              {!!profile?.location && (
                <Text style={styles.meta}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textMuted} /> {profile.location}
                </Text>
              )}

              {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            </LinearGradient>
          )}

          {!isCompany && !!profileVideos.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Video predstavljanje</Text>
              <View style={styles.videoList}>
                {profileVideos.map((video) => (
                  <ProfileVideoCard key={video.id} video={video} canDelete onDelete={removeProfileVideo} />
                ))}
              </View>
            </View>
          )}

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
            <View style={[styles.section, styles.companySection]}>
              <View style={styles.companySectionHeader}>
                <View>
                  <Text style={styles.companySectionKicker}>PODACI FIRME</Text>
                  <Text style={styles.sectionTitle}>Kako te kandidati vide</Text>
                </View>
                <View style={styles.companySectionBadge}>
                  <Text style={styles.companySectionBadgeText}>{completedCompanyFields}/{companyFields.length}</Text>
                </View>
              </View>

              <View style={styles.companyInfoGrid}>
                {companyProfileItems.map((item) => (
                  <CompanyInfoCard key={item.label} {...item} />
                ))}
              </View>

              <TouchableOpacity style={styles.companyPreviewCard} onPress={() => navigation.navigate('EditProfile')}>
                <View style={styles.companyPreviewIcon}>
                  <Ionicons name="create-outline" size={22} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.companyPreviewTitle}>Uredi javni nastup</Text>
                  <Text style={styles.companyPreviewText}>Logo, opis, lokacija i osnovni podaci se ovde najviše računaju.</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#DCD7FF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Podaci kandidata</Text>

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

          {!isCompany && (
            <View style={styles.resetCard}>
              <View style={styles.resetIcon}>
                <Ionicons name="refresh-outline" size={23} color={COLORS.primarySoft} />
              </View>
              <View style={styles.resetCopy}>
                <Text style={styles.resetTitle}>Resetuj stare odluke</Text>
                <Text style={styles.resetText}>
                  Posle 30 dana možeš da resetuješ svoje stare swipe odluke, pa isti oglasi mogu ponovo da se pojave.
                </Text>
              </View>
              <TouchableOpacity style={styles.resetButton} onPress={() => setResetModalVisible(true)}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
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
      {profileTutorialVisible && (
        <View style={styles.profileTutorialLayer} pointerEvents="box-none">
          <View style={styles.profileTutorialCard}>
            <View style={styles.profileTutorialTop}>
              <View style={styles.profileTutorialIcon}>
                <Ionicons name="person-circle-outline" size={23} color={COLORS.primarySoft} />
              </View>
              <Text style={styles.profileTutorialCounter}>POSLEDNJI KORAK</Text>
            </View>
            <Text style={styles.profileTutorialTitle}>{isCompany ? 'Profil tvoje firme' : 'Tvoj profil'}</Text>
            <Text style={styles.profileTutorialText}>
              {isCompany
                ? 'Ovde kandidati upoznaju tvoju firmu. Proveri naziv, industriju, lokaciju, opis i fotografiju, a ikonica olovke gore otvara izmenu podataka.'
                : 'Ovde firme vide tvoju poziciju, veštine, iskustvo i opis. Ikonica olovke gore otvara izmenu, a potpuniji profil daje preciznije poklapanje sa oglasima.'}
            </Text>
            <Text style={styles.profileTutorialHint}>Dugme sa olovkom gore je označeno. Dodirni njega ili nastavi odavde da vidiš gde se podaci menjaju.</Text>
            <TouchableOpacity style={styles.profileTutorialButton} onPress={openEditProfileTutorial}>
              <Text style={styles.profileTutorialButtonText}>Otvori izmenu profila</Text>
              <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Modal transparent animationType="fade" visible={resetModalVisible} onRequestClose={() => !resetBusy && setResetModalVisible(false)}>
        <View style={styles.resetModalOverlay}>
          <View style={styles.resetModal}>
            <View style={styles.resetModalIcon}>
              <Ionicons name="refresh-outline" size={28} color={COLORS.primarySoft} />
            </View>
            <Text style={styles.resetModalTitle}>Resetuj stare odluke?</Text>
            <Text style={styles.resetModalText}>
              Obrisaće se samo tvoji swipe-ovi stariji od 30 dana. Sveže odluke i postojeći mečevi ostaju netaknuti.
            </Text>
            <View style={styles.resetModalActions}>
              <TouchableOpacity style={styles.resetCancelButton} disabled={resetBusy} onPress={() => setResetModalVisible(false)}>
                <Text style={styles.resetCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.resetConfirmButton, resetBusy && { opacity: 0.65 }]} disabled={resetBusy} onPress={resetCandidateDecisions}>
                {resetBusy ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.resetConfirmText}>Resetuj</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

function CompanyInfoCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  accent: string;
}) {
  return (
    <View style={styles.companyInfoCard}>
      <View style={[styles.companyInfoIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <Ionicons name={icon} size={19} color={accent} />
      </View>
      <Text style={styles.companyInfoLabel}>{label}</Text>
      <Text style={styles.companyInfoValue} numberOfLines={2}>{value || 'Nije navedeno'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark },
  profileTutorialLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 100 },
  profileTutorialCard: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#454d76', backgroundColor: 'rgba(18,22,34,0.98)', boxShadow: '0px 18px 46px rgba(0,0,0,0.48)' },
  profileTutorialTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileTutorialIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.18)' },
  profileTutorialCounter: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' },
  profileTutorialTitle: { color: COLORS.white, fontSize: 21, fontWeight: '900', marginTop: 12 },
  profileTutorialText: { color: COLORS.textSoft, fontSize: 14, lineHeight: 21, marginTop: 7 },
  profileTutorialHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  profileTutorialButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15, borderRadius: 14, backgroundColor: COLORS.primary },
  profileTutorialButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
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
  tutorialEditButton: { borderWidth: 2, borderColor: COLORS.primarySoft, backgroundColor: 'rgba(124,92,255,0.25)', boxShadow: '0px 0px 0px 5px rgba(124,92,255,0.18), 0px 8px 26px rgba(124,92,255,0.5)' },
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
  companyHeroCard: {
    alignItems: 'stretch',
    padding: 20,
    borderColor: 'rgba(199,210,254,0.18)',
  },
  companyHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  companyLogoWrap: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companyLogoImage: { width: '100%', height: '100%' },
  companyHeroCopy: { flex: 1 },
  companyEyebrow: { color: '#A9B3FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  companyName: { color: COLORS.white, fontSize: 31, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7, marginTop: 4 },
  companyHeroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  companyMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(5,7,17,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  companyMiniPillText: { color: '#DCD7FF', fontSize: 11, fontWeight: '900' },
  companyProgressCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(5,7,17,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  companyProgressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  companyProgressLabel: { color: '#BFC7E8', fontSize: 12, fontWeight: '900' },
  companyProgressValue: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  companyProgressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 10 },
  companyProgressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primarySoft },
  companyProgressHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  companyQuickGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  companyQuickCard: {
    flex: 1,
    minHeight: 88,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  companyQuickLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', marginTop: 8, textTransform: 'uppercase' },
  companyQuickValue: { color: COLORS.white, fontSize: 14, fontWeight: '900', marginTop: 4 },
  companyBio: {
    color: '#D7DDF2',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  companySection: { backgroundColor: 'rgba(12,16,28,0.96)', borderColor: 'rgba(169,179,255,0.18)' },
  companySectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  companySectionKicker: { color: '#8F9BFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  companySectionBadge: {
    minWidth: 44,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  companySectionBadgeText: { color: '#DCD7FF', fontSize: 12, fontWeight: '900' },
  companyInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  companyInfoCard: {
    width: '48%',
    minHeight: 128,
    padding: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  companyInfoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  companyInfoLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 12 },
  companyInfoValue: { color: COLORS.white, fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 },
  companyPreviewCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.30)',
  },
  companyPreviewIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  companyPreviewTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  companyPreviewText: { color: '#B9C2DE', fontSize: 12, lineHeight: 18, marginTop: 3 },
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
  videoList: { gap: 12 },
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
  resetCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(124,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
    marginBottom: 16,
  },
  resetIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.18)',
  },
  resetCopy: { flex: 1 },
  resetTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  resetText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  resetButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  resetButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  resetModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.74)', justifyContent: 'center', padding: 20 },
  resetModal: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 26,
    backgroundColor: 'rgba(16,19,29,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.24)',
    gap: 12,
  },
  resetModalIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  resetModalTitle: { color: COLORS.white, fontSize: 23, fontWeight: '900' },
  resetModalText: { color: COLORS.textSoft, fontSize: 14, lineHeight: 21 },
  resetModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resetCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetCancelText: { color: COLORS.textSoft, fontWeight: '900' },
  resetConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  resetConfirmText: { color: COLORS.white, fontWeight: '900' },
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
