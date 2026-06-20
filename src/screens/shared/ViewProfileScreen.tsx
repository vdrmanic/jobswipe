import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ExperienceItem, ExperienceVerification } from '../../types';
import { findExperienceVerification, verificationService } from '../../services/verificationService';
import { COLORS } from '../../constants';

type InfoCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
};

function InfoCard({ icon, label, value }: InfoCardProps) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primarySoft} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text selectable style={styles.infoValue}>{value || 'Nije navedeno'}</Text>
      </View>
    </View>
  );
}

export default function ViewProfileScreen({ route, navigation }: any) {
  const { profileId, userType } = route.params;
  const { width } = useWindowDimensions();
  const [baseProfile, setBaseProfile] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<ExperienceVerification[]>([]);

  const isCompany = userType === 'company';
  const isWide = width >= 760;

  const fetchProfile = async () => {
    setLoading(true);

    const [{ data: profileData }, { data: detailsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supabase
        .from(isCompany ? 'company_profiles' : 'candidate_profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle(),
    ]);

    const verificationRows = isCompany
      ? []
      : await verificationService.fetchPublicVerifiedExperiences([profileId]).catch(() => []);

    setBaseProfile(profileData);
    setDetails(detailsData);
    setVerifications(verificationRows);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [profileId, userType])
  );

  const goBack = () => {
    if (route.params?.returnTo) {
      navigation.navigate(route.params.returnTo);
    } else {
      navigation.goBack();
    }
  };

  const openWebsite = async () => {
    if (!details?.website) return;
    const url = /^https?:\/\//i.test(details.website) ? details.website : `https://${details.website}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
        <Text style={styles.loadingText}>Ucitavanje profila...</Text>
      </View>
    );
  }

  const displayName = isCompany
    ? details?.company_name || baseProfile?.full_name || 'Firma'
    : baseProfile?.full_name || 'Kandidat';
  const avatarUrl = baseProfile?.avatar_url || details?.logo_url;

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.inner}
    >
      <View style={styles.pageInner}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.76} style={styles.backButton}>
          <Ionicons name="arrow-back" size={19} color={COLORS.textSoft} />
          <Text style={styles.backText}>Nazad na oglase</Text>
        </TouchableOpacity>

        <LinearGradient
          colors={isCompany ? ['#21184B', '#12172A', '#0B0E17'] : ['#162B3B', '#15182B', '#0B0E17']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />

          <View style={[styles.heroContent, isWide && styles.heroContentWide]}>
            <LinearGradient colors={[COLORS.primary, COLORS.accent]} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name={isCompany ? 'business' : 'person'} size={54} color={COLORS.primarySoft} />
                )}
              </View>
            </LinearGradient>

            <View style={styles.heroCopy}>
              <View style={styles.verifiedPill}>
                <Ionicons name={isCompany ? 'briefcase' : 'person'} size={13} color={COLORS.mint} />
                <Text style={styles.verifiedPillText}>{isCompany ? 'PROFIL POSLODAVCA' : 'PROFIL KANDIDATA'}</Text>
              </View>
              <Text selectable style={styles.name}>{displayName}</Text>
              <Text style={styles.tagline}>
                {isCompany
                  ? details?.industry || 'Tim koji trazi sledeceg sjajnog clana'
                  : details?.position || 'Otvoren/a za novu poslovnu priliku'}
              </Text>

              <View style={styles.quickFacts}>
                {!!baseProfile?.location && (
                  <View style={styles.quickFact}>
                    <Ionicons name="location" size={15} color={COLORS.accent} />
                    <Text style={styles.quickFactText}>{baseProfile.location}</Text>
                  </View>
                )}
                {!!details?.company_size && (
                  <View style={styles.quickFact}>
                    <Ionicons name="people" size={15} color={COLORS.primarySoft} />
                    <Text style={styles.quickFactText}>{details.company_size}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>

        {isCompany ? (
          <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
            <View style={styles.mainColumn}>
              <View style={styles.section}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionHeadingIcon}>
                    <Ionicons name="sparkles" size={19} color={COLORS.gold} />
                  </View>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionEyebrow}>UPOZNAJ TIM</Text>
                    <Text style={styles.sectionTitle}>O kompaniji</Text>
                  </View>
                </View>
                <Text selectable style={styles.bio}>
                  {baseProfile?.bio || 'Kompanija jos nije dodala detaljan opis, ali njihov aktivan oglas moze ti reci vise o timu i ulozi.'}
                </Text>
              </View>

              <LinearGradient colors={['rgba(124,92,255,0.19)', 'rgba(54,209,220,0.08)']} style={styles.whyCard}>
                <View style={styles.whyIcon}>
                  <Ionicons name="rocket" size={24} color={COLORS.primarySoft} />
                </View>
                <View style={styles.whyCopy}>
                  <Text style={styles.whyTitle}>Mozda je ovo tvoj sledeci tim</Text>
                  <Text style={styles.whyText}>
                    Pregledaj kulturu, lokaciju i osnovne podatke, pa se vrati na oglas kada budes spreman za swipe.
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.sideColumn}>
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>BRZI PREGLED</Text>
                <Text style={styles.sectionTitle}>Kompanija ukratko</Text>
                <View style={styles.infoList}>
                  <InfoCard icon="business-outline" label="Naziv" value={details?.company_name} />
                  <InfoCard icon="layers-outline" label="Industrija" value={details?.industry} />
                  <InfoCard icon="people-outline" label="Velicina tima" value={details?.company_size} />
                  <InfoCard icon="location-outline" label="Lokacija" value={baseProfile?.location} />
                </View>

                {!!details?.website && (
                  <TouchableOpacity onPress={openWebsite} activeOpacity={0.84} style={styles.websiteButton}>
                    <Ionicons name="globe-outline" size={19} color={COLORS.white} />
                    <Text style={styles.websiteButtonText}>Poseti website</Text>
                    <Ionicons name="open-outline" size={17} color={COLORS.primarySoft} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.candidateContent}>
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>PROFIL</Text>
              <Text style={styles.sectionTitle}>O kandidatu</Text>
              <Text selectable style={styles.bio}>{baseProfile?.bio || 'Kandidat jos nije dodao opis.'}</Text>
            </View>

            {!!details?.skills?.length && (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>KOMPETENCIJE</Text>
                <Text style={styles.sectionTitle}>Vestine</Text>
                <View style={styles.tags}>
                  {details.skills.map((skill: string, index: number) => (
                    <View key={`${skill}-${index}`} style={styles.tag}>
                      <Ionicons name="checkmark-circle" size={15} color={COLORS.mint} />
                      <Text style={styles.tagText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>KARIJERA</Text>
              <Text style={styles.sectionTitle}>Iskustvo</Text>
              <View style={styles.experienceList}>
                {details?.experience_items?.length ? (
                  details.experience_items.map((item: ExperienceItem, index: number) => {
                    const verification = findExperienceVerification(verifications, item, index);
                    return (
                      <View key={index} style={styles.experienceCard}>
                        <View style={styles.timelineDot} />
                        <View style={styles.experienceCopy}>
                          <View style={styles.experienceHeader}>
                            <View style={styles.experienceHeading}>
                              <Text style={styles.experienceTitle}>{item.position}</Text>
                              {!!item.company && <Text style={styles.experienceCompany}>{item.company}</Text>}
                            </View>
                            {verification?.status === 'verified' && (
                              <View style={styles.experienceVerified}>
                                <Ionicons name="shield-checkmark" size={13} color={COLORS.mint} />
                                <Text style={styles.experienceVerifiedText}>Verifikovano</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.experienceDuration}>{item.duration}</Text>
                          {!!item.description && <Text style={styles.experienceDescription}>{item.description}</Text>}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>Iskustvo jos nije dodato.</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  inner: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 120 },
  pageInner: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: 16 },
  center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.textMuted, fontWeight: '700' },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  backText: { color: COLORS.textSoft, fontSize: 14, fontWeight: '800' },
  hero: {
    minHeight: 286,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    padding: 26,
  },
  heroOrbOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -70, top: -100, backgroundColor: 'rgba(124,92,255,0.22)' },
  heroOrbTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, left: -80, bottom: -130, backgroundColor: 'rgba(54,209,220,0.15)' },
  heroContent: { alignItems: 'center', gap: 20 },
  heroContentWide: { flexDirection: 'row', alignItems: 'center', gap: 28, paddingHorizontal: 14 },
  avatarRing: { width: 132, height: 132, borderRadius: 42, padding: 3, boxShadow: '0px 20px 40px rgba(0,0,0,0.32)' },
  avatarInner: { flex: 1, borderRadius: 39, borderWidth: 4, borderColor: COLORS.darkGray, backgroundColor: COLORS.cardRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  heroCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(74,222,128,0.10)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.24)' },
  verifiedPillText: { color: COLORS.mint, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  name: { color: COLORS.white, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.9, marginTop: 13 },
  tagline: { color: COLORS.textSoft, fontSize: 16, lineHeight: 23, marginTop: 5 },
  quickFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  quickFact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: COLORS.border },
  quickFactText: { color: COLORS.textSoft, fontSize: 12, fontWeight: '700' },
  contentGrid: { gap: 16 },
  contentGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1.25, gap: 16 },
  sideColumn: { flex: 0.75 },
  candidateContent: { gap: 16 },
  section: { padding: 22, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, boxShadow: '0px 16px 36px rgba(0,0,0,0.16)' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHeadingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,196,92,0.11)' },
  sectionHeadingCopy: { flex: 1 },
  sectionEyebrow: { color: COLORS.primarySoft, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.15 },
  sectionTitle: { color: COLORS.white, fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 3 },
  bio: { color: COLORS.textMuted, fontSize: 15, lineHeight: 24, marginTop: 16 },
  whyCard: { flexDirection: 'row', gap: 14, padding: 20, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(124,92,255,0.26)' },
  whyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.19)' },
  whyCopy: { flex: 1 },
  whyTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  whyText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  infoList: { gap: 9, marginTop: 16 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 16, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  infoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.15)' },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { color: COLORS.lightGray, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  infoValue: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  websiteButton: { minHeight: 52, marginTop: 14, paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: COLORS.primary },
  websiteButtonText: { color: COLORS.white, fontWeight: '900', flex: 1, textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.20)' },
  tagText: { color: COLORS.textSoft, fontSize: 12, fontWeight: '800' },
  experienceList: { gap: 10, marginTop: 16 },
  experienceCard: { flexDirection: 'row', gap: 13, padding: 15, borderRadius: 18, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  timelineDot: { width: 11, height: 11, borderRadius: 6, marginTop: 6, backgroundColor: COLORS.primary, boxShadow: '0px 0px 12px rgba(124,92,255,0.7)' },
  experienceCopy: { flex: 1 },
  experienceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  experienceHeading: { flex: 1 },
  experienceTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  experienceCompany: { color: COLORS.textSoft, fontSize: 13, fontWeight: '700', marginTop: 3 },
  experienceVerified: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(74,222,128,0.10)' },
  experienceVerifiedText: { color: COLORS.mint, fontSize: 9, fontWeight: '900' },
  experienceDuration: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '800', marginTop: 8 },
  experienceDescription: { color: COLORS.textMuted, lineHeight: 20, marginTop: 7 },
  emptyText: { color: COLORS.textMuted },
});
