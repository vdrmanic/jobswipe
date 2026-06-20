import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../../components/SwipeCard';
import MatchCelebration from '../../components/MatchCelebration';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { findExperienceVerification, verificationService } from '../../services/verificationService';
import { ExperienceItem, ExperienceVerification } from '../../types';
import { CandidateProfile, DiscoveryFilters, JobListing, MatchScore, Profile } from '../../types';
import DiscoveryFilterModal from '../../components/DiscoveryFilterModal';
import MatchScorePill from '../../components/MatchScorePill';
import { discoveryService, notificationService, safetyService } from '../../services';
import { candidatePassesFilters, defaultDiscoveryFilters, scoreCandidateForJob } from '../../utils/matching';

export default function CompanySwipeScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const actionButtonSize = Math.min(Math.max(width * 0.13, 58), 78);
  const actionButtonMargin = width > 420 ? 14 : 10;

  const [candidates, setCandidates] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [candidateModalVisible, setCandidateModalVisible] = useState(false);
  const [matchedCandidate, setMatchedCandidate] = useState<any | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const visibleCandidates = candidates.filter((candidate) =>
    candidatePassesFilters(
      candidate.candidate_profiles as CandidateProfile,
      candidate as Profile,
      filters,
      candidate.has_verified_experience,
      candidate.matchScore.score
    )
  );
  const currentCandidate = visibleCandidates[currentIndex];

  useEffect(() => {
    if (!user) return;
    discoveryService.loadFilters(user.id, 'company').then(setFilters);
  }, [user?.id]);

  const matchOverlay = (
    <MatchCelebration
      visible={matchVisible && !!matchedCandidate}
      candidateAvatar={matchedCandidate?.avatar_url}
      candidateName={matchName}
      companyAvatar={profile?.avatar_url}
      companyName={profile?.full_name}
      onContinue={() => {
        setMatchVisible(false);
        setMatchedCandidate(null);
      }}
    />
  );

  const openCandidateProfile = () => {
    if (!currentCandidate) return;
    setCandidateModalVisible(true);
  };
  const navigateToProfile = () => {
    if (!currentCandidate) return;
    const candidateId = currentCandidate.id;

    setCandidateModalVisible(false);
    requestAnimationFrame(() => {
      navigation.navigate('ViewProfile', {
        profileId: candidateId,
        userType: 'candidate',
        returnTo: 'SwipeMain',
      });
    });
  };

  const fetchCandidates = async () => {
    if (!user) return;

    setLoading(true);
    const blockedIds = await safetyService.fetchBlockedIds(user.id);

    const { data: swipedData } = await supabase
      .from('swipes')
      .select('target_id')
      .eq('swiper_id', user.id)
      .eq('target_type', 'candidate');

    const swipedIds = swipedData?.map((s) => s.target_id) || [];

    let query = supabase
      .from('profiles')
      .select(`
        *,
        candidate_profiles(*)
      `)
      .eq('user_type', 'candidate');

    if (swipedIds.length > 0) {
      const quotedIds = swipedIds.map((id) => `"${id}"`).join(',');
      query = query.not('id', 'in', `(${quotedIds})`);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert('Greška kandidati', error.message);
      setLoading(false);
      return;
    }

    const candidateRows = data || [];
    const candidateIds = candidateRows.map((candidate) => candidate.id);
    let verificationRows: ExperienceVerification[] = [];

    if (candidateIds.length > 0) {
      verificationRows = await verificationService.fetchPublicVerifiedExperiences(candidateIds).catch(() => []);
    }
    if (blockedIds.length > 0) {
      const quotedBlockedIds = blockedIds.map((id) => `"${id}"`).join(',');
      query = query.not('id', 'in', `(${quotedBlockedIds})`);
    }

    const { data: activeJobsData } = await supabase
      .from('job_listings')
      .select('*')
      .eq('company_id', user.id)
      .eq('status', 'active')
      .eq('is_active', true);
    const activeJobs = (activeJobsData || []) as JobListing[];

    setCandidates(candidateRows.map((candidate) => {
      const candidateVerifications = verificationRows.filter((item) => item.candidate_id === candidate.id);
      const scores = activeJobs.map((job) =>
        scoreCandidateForJob(
          candidate.candidate_profiles as CandidateProfile,
          candidate as Profile,
          job,
          candidateVerifications.length > 0
        )
      );
      const matchScore: MatchScore = scores.sort((a, b) => b.score - a.score)[0] || {
        score: 0,
        reasons: ['Kreiraj aktivan oglas za precizno poklapanje'],
        matchedSkills: [],
      };
      return {
        ...candidate,
        experience_verifications: candidateVerifications,
        has_verified_experience: candidateVerifications.length > 0,
        matchScore,
      };
    }));
    setCurrentIndex(0);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCandidates();
    }, [user?.id])
  );

  const createMatchIfExists = async (candidateId: string) => {
    if (!user) return;

    const { data: companyJobs, error: jobsError } = await supabase
      .from('job_listings')
      .select('id')
      .eq('company_id', user.id)
      .eq('status', 'active')
      .eq('is_active', true);

    if (jobsError) {
      Alert.alert('Greška jobs', jobsError.message);
      return;
    }

    const jobIds = companyJobs?.map((job) => job.id) || [];

    if (jobIds.length === 0) {
      Alert.alert('Nema oglasa', 'Firma nema aktivan oglas.');
      return;
    }

    const { data: allCandidateJobs, error: allJobsError } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', candidateId)
      .eq('target_type', 'job')
      .eq('direction', 'right');

    if (allJobsError) {
      console.warn('Company match debug: failed loading candidate job likes', allJobsError.message);
    } else {
      console.log('Company match debug: candidate right-job-swipes', { candidateId, allCandidateJobs, jobIds });
    }

    const candidateLike = Array.isArray(allCandidateJobs)
      ? allCandidateJobs.find((swipe) => jobIds.includes(swipe.target_id))
      : null;

    if (!candidateLike) {
      console.log('Company match check: candidate has not liked an active job yet', { candidateId, jobIds, candidateJobLikes: allCandidateJobs?.map((s) => s.target_id) });
      Alert.alert('Nema matcha', 'Kandidat nije lajkovao nijedan aktivan oglas ove firme.');
      return;
    }

    console.log('Company match check success:', { candidateId, candidateLike });

    const { data: existingMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('company_id', user.id)
      .eq('job_id', candidateLike.target_id)
      .maybeSingle();

    if (existingMatch) {
      Alert.alert('Već postoji match', 'Sa ovim kandidatom već postoji match.');
      return;
    }

    const { error: matchError } = await supabase.from('matches').insert({
      candidate_id: candidateId,
      company_id: user.id,
      job_id: candidateLike.target_id,
    });

    if (matchError) {
      console.warn('Match insert failed:', matchError.message, { candidateId, companyId: user.id, jobId: candidateLike.target_id });
      Alert.alert('Greška match', matchError.message);
      return;
    }

    console.log('Match kreiran:', { candidateId, companyId: user.id, jobId: candidateLike.target_id });
    setMatchedCandidate(currentCandidate);
    setMatchName(currentCandidate?.display_name || currentCandidate?.full_name || 'Kandidat');
    setMatchVisible(true);
    notificationService.dispatchPending().catch(() => null);
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!user || !currentCandidate) return;

    const candidateId = currentCandidate.id;

    const { data: swipeData, error } = await supabase.from('swipes').upsert(
      {
        swiper_id: user.id,
        target_id: candidateId,
        target_type: 'candidate',
        direction,
      },
      {
        onConflict: 'swiper_id,target_id',
      }
    ).select();

    console.log('Company swipe saved:', { swipeData, candidateId, direction });

    if (error) {
      Alert.alert('Greška swipe', error.message);
      return;
    }

    if (direction === 'right') {
      await createMatchIfExists(candidateId);
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    // Ako nema više kandidata, osvezi listu
    if (nextIndex >= visibleCandidates.length) {
      setLoading(true);
      await fetchCandidates();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        {matchOverlay}
      </View>
    );
  }

  if (!currentCandidate) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Nema više kandidata</Text>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchCandidates}>
          <Text style={styles.refreshButtonText}>Osveži</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emptyFilterButton} onPress={() => setFiltersVisible(true)}>
          <Ionicons name="options" size={18} color="#a9b3ff" />
          <Text style={styles.emptyFilterText}>Promeni filtere</Text>
        </TouchableOpacity>
        {matchOverlay}
        <DiscoveryFilterModal
          visible={filtersVisible}
          mode="company"
          value={filters}
          onClose={() => setFiltersVisible(false)}
          onApply={(next) => {
            setFilters(next);
            setCurrentIndex(0);
            setFiltersVisible(false);
            if (user) discoveryService.saveFilters(user.id, 'company', next);
          }}
        />
      </View>
    );
  }

  const candidateProfile = currentCandidate.candidate_profiles;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 28 }] }>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Kandidati</Text>
          <Text style={styles.subHeader}>Istraži kandidate</Text>
        </View>

        <View style={styles.countPill}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersVisible(true)}>
            <Ionicons name="options" size={18} color="#a9b3ff" />
          </TouchableOpacity>
          <Text style={styles.countText}>{currentIndex + 1}/{visibleCandidates.length}</Text>
        </View>
      </View>

      <Text style={styles.swipeHint}>Prevucite desno za lajk, levo za preskakanje</Text>

      <SwipeCard onSwipeLeft={() => handleSwipe('left')} onSwipeRight={() => handleSwipe('right')}>
        <View style={styles.card}>
          <TouchableOpacity onPress={openCandidateProfile} activeOpacity={0.9} style={styles.cardTouch}>
            {currentCandidate.avatar_url ? (
              <Image source={{ uri: currentCandidate.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarFallback}>👤</Text>
            )}

            <View style={styles.overlay}>
              <View style={styles.cardTop}>
                <Text style={styles.roleTag}>{candidateProfile?.position || 'Pozicija nije navedena'}</Text>
                <MatchScorePill result={currentCandidate.matchScore} />
                <Text style={styles.locationText}>📍 {currentCandidate.location || 'Lokacija nije navedena'}</Text>
              </View>

              <Text style={styles.name}>{currentCandidate.display_name || currentCandidate.full_name}</Text>

              {!!candidateProfile?.bio && (
                <Text style={styles.bio} numberOfLines={2}>
                  {candidateProfile.bio}
                </Text>
              )}

                {!!candidateProfile?.skills?.length && (
                  <Text style={styles.skills} numberOfLines={1}>
                    {candidateProfile.skills.slice(0, 3).join(' • ')}
                  </Text>
                )}
                {/* decorative accent bar for premium feel */}
                <View style={[styles.overlayAccent, { pointerEvents: 'none' }]} />
              </View>
          </TouchableOpacity>
        </View>
      </SwipeCard>

      <Modal transparent animationType="fade" visible={candidateModalVisible} onRequestClose={() => setCandidateModalVisible(false)}>
        <View style={styles.profileModalOverlay}>
          <View style={styles.profileModalCard}>
            <View style={styles.profileModalHeader}>
              <View style={styles.profileAvatarBox}>
                {currentCandidate?.avatar_url ? (
                  <Image source={{ uri: currentCandidate.avatar_url }} style={styles.profileAvatar} />
                ) : (
                  <Text style={styles.profileAvatarIcon}>👤</Text>
                )}
              </View>
              <View style={styles.profileModalHeaderText}>
                <Text style={styles.profileModalTitle}>{currentCandidate?.display_name || currentCandidate?.full_name || 'Kandidat'}</Text>
                <Text style={styles.profileModalSubTitle}>{currentCandidate?.candidate_profiles?.position || 'Pozicija nije navedena'}</Text>
                <Text style={styles.profileModalLocation}>📍 {currentCandidate?.location || 'Lokacija nije navedena'}</Text>
              </View>
            </View>

            {!!currentCandidate?.candidate_profiles?.bio && (
              <Text style={styles.profileModalBio}>{currentCandidate.candidate_profiles.bio}</Text>
            )}

            {!!currentCandidate?.candidate_profiles?.skills?.length && (
              <View style={styles.profileSkillsRow}>
                {currentCandidate.candidate_profiles.skills.slice(0, 6).map((skill: string, index: number) => (
                  <View key={index} style={styles.profileSkillTag}>
                    <Text style={styles.profileSkillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!currentCandidate?.candidate_profiles?.experience_items?.length && (
              <View style={styles.profileExperienceSection}>
                <Text style={styles.profileSectionTitle}>Iskustvo</Text>
                {currentCandidate.candidate_profiles.experience_items.slice(0, 2).map((item: ExperienceItem, idx: number) => {
                  const verification = findExperienceVerification(
                    currentCandidate.experience_verifications || [],
                    item,
                    idx
                  );
                  return (
                    <View key={idx} style={styles.profileExperienceCard}>
                      <View style={styles.profileExperienceHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profileExperienceTitle}>{item.position}</Text>
                          {!!item.company && <Text style={styles.profileExperienceCompany}>{item.company}</Text>}
                        </View>
                        {verification?.status === 'verified' ? (
                          <View style={styles.profileVerifiedBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#6ee7b7" />
                            <Text style={styles.profileVerifiedText}>Verifikovano</Text>
                          </View>
                        ) : (
                          <Text style={styles.profileExperienceDuration}>{item.duration}</Text>
                        )}
                      </View>
                      {verification?.status === 'verified' && (
                        <Text style={styles.profileExperienceDuration}>{item.duration}</Text>
                      )}
                      {!!item.description && <Text style={styles.profileExperienceText}>{item.description}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setCandidateModalVisible(false)}>
                <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>Zatvori</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={navigateToProfile}>
                <Text style={styles.modalButtonText}>Detaljnije</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action buttons moved outside card to avoid overlapping overlay/content */}
      <View
        style={[
          styles.actionsOverlay,
          {
            pointerEvents: 'box-none',
            bottom: insets.bottom + 18,
            paddingHorizontal: width > 420 ? 24 : 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonLeft,
            { width: actionButtonSize, height: actionButtonSize, borderRadius: actionButtonSize / 2, marginHorizontal: actionButtonMargin },
          ]}
          onPress={() => handleSwipe('left')}
        >
          <Ionicons name="close" size={30} color="#ff7a86" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonCenter,
            { width: actionButtonSize, height: actionButtonSize, borderRadius: actionButtonSize / 2, marginHorizontal: actionButtonMargin },
          ]}
          onPress={openCandidateProfile}
        >
          <Ionicons name="information" size={28} color="#7DE7FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonRight,
            { width: actionButtonSize, height: actionButtonSize, borderRadius: actionButtonSize / 2, marginHorizontal: actionButtonMargin },
          ]}
          onPress={() => handleSwipe('right')}
        >
          <Ionicons name="heart" size={30} color="#FF7AC8" />
        </TouchableOpacity>
      </View>

      {matchOverlay}
      <DiscoveryFilterModal
        visible={filtersVisible}
        mode="company"
        value={filters}
        onClose={() => setFiltersVisible(false)}
        onApply={(next) => {
          setFilters(next);
          setCurrentIndex(0);
          setFiltersVisible(false);
          if (user) discoveryService.saveFilters(user.id, 'company', next);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  header: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: 0,
  },
  subHeader: {
    color: '#a9b3ff',
    marginTop: 4,
    fontSize: 14,
    maxWidth: '72%',
    fontWeight: '600',
  },
  countPill: {
    backgroundColor: '#141623',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 12px 24px rgba(46, 52, 112, 0.16)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  countText: { color: '#8f9bff', fontWeight: '700' },
  filterButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  center: { flex: 1, backgroundColor: '#090909', justifyContent: 'center', alignItems: 'center' },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0e1220',
    borderRadius: 34,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 36px rgba(0, 0, 0, 0.22)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
  },
  cardTouch: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  overlayAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  avatarImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cardTop: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  roleTag: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#6C63FF',
    alignSelf: 'flex-start',
  },
  locationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  swipeHint: {
    color: '#cdd6f2',
    textAlign: 'center',
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  avatarFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#181818',
    color: '#777',
    fontSize: 90,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    marginTop: 0,
    ...Platform.select({
      web: { textShadow: '0px 2px 6px rgba(0,0,0,0.6)' },
      default: {
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
      },
    }),
  },
  bio: { color: '#ddd', marginTop: 4, lineHeight: 18, fontSize: 12, maxWidth: '100%' },
  skills: { color: '#a8f0ff', marginTop: 6, fontWeight: '600', fontSize: 12, lineHeight: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  refreshButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    boxShadow: '0px 0px 20px rgba(108, 99, 255, 0.4)',
  },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyFilterButton: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 13, marginTop: 8 },
  emptyFilterText: { color: '#a9b3ff', fontWeight: '900' },
  actionsOverlay: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  actionButton: {
    width: 62,
    height: 62,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#262a38',
    backgroundColor: 'rgba(255,255,255,0.06)',
    boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.18)',
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
    marginHorizontal: 10,
    elevation: 10,
  },
  actionButtonLeft: {
    borderColor: '#ff6c75',
    backgroundColor: 'rgba(255, 59, 71, 0.14)',
    boxShadow: '0px 0px 16px rgba(255, 59, 71, 0.18)',
  },
  actionButtonCenter: {
    borderColor: '#00D9FF',
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    boxShadow: '0px 0px 20px rgba(0, 217, 255, 0.25)',
  },
  actionButtonRight: {
    borderColor: '#FF1493',
    backgroundColor: 'rgba(255, 20, 147, 0.2)',
    boxShadow: '0px 0px 20px rgba(255, 20, 147, 0.3)',
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#222',
  },
  profileModalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  profileModalSubTitle: {
    color: '#a8f0ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  profileModalLocation: {
    color: '#ddd',
    fontSize: 13,
    marginBottom: 12,
  },
  profileModalBio: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  profileAvatarBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1a1a1d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
  },
  profileAvatarIcon: {
    fontSize: 32,
  },
  profileModalHeaderText: {
    flex: 1,
  },
  profileSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  profileSkillTag: {
    backgroundColor: '#1b1b2d',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  profileSkillText: {
    color: '#cdd6f4',
    fontSize: 12,
    fontWeight: '700',
  },
  profileExperienceSection: {
    marginBottom: 20,
  },
  profileSectionTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 12,
  },
  profileExperienceCard: {
    backgroundColor: '#111216',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    marginBottom: 10,
  },
  profileExperienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileExperienceTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  profileExperienceCompany: {
    color: '#d8d8e5',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  profileVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.38)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  profileVerifiedText: {
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: '900',
  },
  profileExperienceDuration: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileExperienceText: {
    color: '#c1c1d1',
    fontSize: 12,
    lineHeight: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalButtonSecondary: {
    backgroundColor: '#1b1b1f',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtonSecondaryText: {
    color: '#c1c1d1',
  },
  modalButtonPrimary: {
    backgroundColor: '#6C63FF',
  },
});
