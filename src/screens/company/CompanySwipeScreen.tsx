import { useCallback, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import SwipeCard from '../../components/SwipeCard';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function CompanySwipeScreen({ navigation }: any) {
  const { user, profile } = useAuth();

  const [candidates, setCandidates] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [candidateModalVisible, setCandidateModalVisible] = useState(false);
  const [matchedCandidate, setMatchedCandidate] = useState<any | null>(null);
  const matchAnim = useRef(new Animated.Value(0)).current;

  const currentCandidate = candidates[currentIndex];

  const matchOverlay = matchVisible && matchedCandidate ? (
    <Animated.View style={[styles.matchOverlay, { opacity: matchAnim }]}>
      <View style={styles.matchOverlayBlur} />

      <Animated.View style={styles.matchPeopleRow}>
        <Animated.View
          style={[
            styles.matchPerson,
            {
              transform: [
                {
                  translateX: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }),
                },
              ],
              opacity: matchAnim,
            },
          ]}
        >
          <View style={styles.matchAvatarBox}>
            {matchedCandidate.avatar_url ? (
              <Image source={{ uri: matchedCandidate.avatar_url }} style={styles.matchAvatar} />
            ) : (
              <Text style={styles.matchAvatarIcon}>👤</Text>
            )}
          </View>
          <Text style={styles.matchLabel}>Kandidat</Text>
          <Text style={styles.matchPersonName}>{matchedCandidate.display_name || matchedCandidate.full_name || 'Kandidat'}</Text>
        </Animated.View>

        <Animated.Text
          style={[
            styles.matchHandshake,
            {
              transform: [
                {
                  scale: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }),
                },
              ],
              opacity: matchAnim,
            },
          ]}
        >
          🤝
        </Animated.Text>

        <Animated.View
          style={[
            styles.matchPerson,
            {
              transform: [
                {
                  translateX: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                },
              ],
              opacity: matchAnim,
            },
          ]}
        >
          <View style={styles.matchAvatarBox}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.matchAvatar} />
            ) : (
              <Text style={styles.matchAvatarIcon}>🏢</Text>
            )}
          </View>
          <Text style={styles.matchLabel}>Firma</Text>
          <Text style={styles.matchPersonName}>{profile?.full_name || 'Firma'}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.matchCard,
          {
            transform: [
              {
                scale: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
              },
              {
                translateY: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
              },
            ],
            opacity: matchAnim,
          },
        ]}
      >
        <Text style={styles.matchTitle}>Nova veza!</Text>
        <Text style={styles.matchName}>{matchName}</Text>
        <Text style={styles.matchSubtitle}>Kandidat i firma su se povezali.</Text>
      </Animated.View>
    </Animated.View>
  ) : null;

  const openCandidateProfile = () => {
    if (!currentCandidate) return;
    setCandidateModalVisible(true);
  };
  const navigateToProfile = () => {
    if (!currentCandidate) return;
    navigation.navigate('ViewProfile', {
      profileId: currentCandidate.id,
      userType: 'candidate',
      returnTo: 'SwipeMain',
    });
  };

  const fetchCandidates = async () => {
    if (!user) return;

    setLoading(true);

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

    setCandidates(data || []);
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
    matchAnim.setValue(0);
    Animated.sequence([
      Animated.timing(matchAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: false }),
      Animated.delay(1800),
      Animated.timing(matchAnim, { toValue: 0, duration: 300, easing: Easing.in(Easing.exp), useNativeDriver: false }),
    ]).start(() => {
      setMatchVisible(false);
      setMatchedCandidate(null);
    });
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
    if (nextIndex >= candidates.length) {
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
        {matchOverlay}
      </View>
    );
  }

  const candidateProfile = currentCandidate.candidate_profiles;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Kandidati</Text>
          <Text style={styles.subHeader}>Istraži kandidate</Text>
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countText}>{currentIndex + 1}/{candidates.length}</Text>
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
                <View pointerEvents="none" style={styles.overlayAccent} />
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
                {currentCandidate.candidate_profiles.experience_items.slice(0, 2).map((item: any, idx: number) => (
                  <View key={idx} style={styles.profileExperienceCard}>
                    <View style={styles.profileExperienceHeader}>
                      <Text style={styles.profileExperienceTitle}>{item.position}</Text>
                      <Text style={styles.profileExperienceDuration}>{item.duration}</Text>
                    </View>
                    {!!item.description && <Text style={styles.profileExperienceText}>{item.description}</Text>}
                  </View>
                ))}
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
      <View style={[styles.actionsOverlay, { pointerEvents: 'box-none' }] }>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonLeft]} onPress={() => handleSwipe('left')}>
          <Text style={styles.actionEmoji}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonCenter]} onPress={openCandidateProfile}>
          <Text style={styles.actionEmoji}>ℹ️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonRight]} onPress={() => handleSwipe('right')}>
          <Text style={styles.actionEmoji}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Match animation overlay */}
      {matchVisible && matchedCandidate && (
        <Animated.View style={[styles.matchOverlay, { opacity: matchAnim }] }>
          <View style={styles.matchOverlayBlur} />

          <Animated.View style={styles.matchPeopleRow}>
            <Animated.View
              style={[
                styles.matchPerson,
                {
                  transform: [
                    {
                      translateX: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }),
                    },
                  ],
                  opacity: matchAnim,
                },
              ]}
            >
              <View style={styles.matchAvatarBox}>
                {matchedCandidate.avatar_url ? (
                  <Image source={{ uri: matchedCandidate.avatar_url }} style={styles.matchAvatar} />
                ) : (
                  <Text style={styles.matchAvatarIcon}>👤</Text>
                )}
              </View>
              <Text style={styles.matchLabel}>Kandidat</Text>
              <Text style={styles.matchPersonName}>{matchedCandidate.display_name || matchedCandidate.full_name || 'Kandidat'}</Text>
            </Animated.View>

            <Animated.Text
              style={[
                styles.matchHandshake,
                {
                  transform: [
                    {
                      scale: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }),
                    },
                  ],
                  opacity: matchAnim,
                },
              ]}
            >
              🤝
            </Animated.Text>

            <Animated.View
              style={[
                styles.matchPerson,
                {
                  transform: [
                    {
                      translateX: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                    },
                  ],
                  opacity: matchAnim,
                },
              ]}
            >
              <View style={styles.matchAvatarBox}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.matchAvatar} />
                ) : (
                  <Text style={styles.matchAvatarIcon}>🏢</Text>
                )}
              </View>
              <Text style={styles.matchLabel}>Firma</Text>
              <Text style={styles.matchPersonName}>{profile?.full_name || 'Firma'}</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.matchCard,
              {
                transform: [
                  {
                    scale: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
                  },
                  {
                    translateY: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                  },
                ],
                opacity: matchAnim,
              },
            ]}
          >
            <Text style={styles.matchTitle}>Nova veza!</Text>
            <Text style={styles.matchName}>{matchName}</Text>
            <Text style={styles.matchSubtitle}>Kandidat i firma su se povezali.</Text>
          </Animated.View>
        </Animated.View>
      )}

    </View>
  );
}
// Match animation overlay component styles rendered above
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
    paddingTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  header: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 0 },
  subHeader: { color: '#6C63FF', marginTop: 4, fontSize: 14, maxWidth: '72%', fontWeight: '600' },
  countPill: {
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    boxShadow: '0px 0px 12px rgba(108, 99, 255, 0.2)',
  },
  countText: { color: '#6C63FF', fontWeight: '700' },
  center: { flex: 1, backgroundColor: '#090909', justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 420,
    height: 600,
    backgroundColor: '#0d0d0d',
    borderRadius: 34,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.3)',
    boxShadow: '0px 0px 24px rgba(108, 99, 255, 0.2)',
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
  meta: { color: '#bbb', marginBottom: 6, fontSize: 13, lineHeight: 18 },
  bio: { color: '#ddd', marginTop: 4, lineHeight: 18, fontSize: 12, maxWidth: '100%' },
  skills: { color: '#a8f0ff', marginTop: 6, fontWeight: '600', fontSize: 12, lineHeight: 18 },
  profileHint: {
    color: '#777',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  refreshButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    boxShadow: '0px 0px 20px rgba(108, 99, 255, 0.4)',
  },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' },
  actionsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#222',
    backgroundColor: 'rgba(15,15,20,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.6)',
    marginHorizontal: 10,
    elevation: 12,
  },
  actionButtonLeft: {
    borderColor: '#FF3B47',
    backgroundColor: 'rgba(255, 59, 71, 0.2)',
    boxShadow: '0px 0px 20px rgba(255, 59, 71, 0.25)',
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
  actionEmoji: {
    fontSize: 28,
  },
  matchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 999,
    overflow: 'hidden',
  },
  matchOverlayBlur: {
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  matchPeopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  matchPerson: {
    alignItems: 'center',
    marginHorizontal: 14,
    transform: [{ perspective: 600 }, { rotateX: '4deg' }],
  },
  matchAvatarBox: {
    width: 118,
    height: 118,
    borderRadius: 60,
    backgroundColor: '#14141d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  matchAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  matchAvatarIcon: {
    fontSize: 52,
  },
  matchLabel: {
    color: '#8b8cff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  matchPersonName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  matchHandshake: {
    fontSize: 56,
    marginHorizontal: 18,
    textShadowColor: 'rgba(255,255,255,0.22)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 20,
  },
  matchCard: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 26,
    alignItems: 'center',
    minWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
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
  modalButtonPrimaryText: {
    color: '#fff',
  },
  matchHeart: {
    fontSize: 72,
    marginBottom: 12,
  },
  matchTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  matchName: { color: '#fff', marginTop: 8, fontSize: 16, fontWeight: '700' },
  matchSubtitle: { color: '#cbd5e1', marginTop: 8, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});