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
import { CopilotStep, useCopilot, walkthroughable } from 'react-native-copilot';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import SwipeCard from '../../components/SwipeCard';

import MatchCelebration from '../../components/MatchCelebration';

import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../hooks/useAuth';

import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

import { findExperienceVerification, verificationService } from '../../services/verificationService';

import { ExperienceItem, ExperienceVerification } from '../../types';

import { CandidateProfile, DiscoveryFilters, JobListing, MatchScore, Profile, ProfileVideo } from '../../types';

import DiscoveryFilterModal from '../../components/DiscoveryFilterModal';

import MatchScorePill from '../../components/MatchScorePill';
import CompanyJobSelector from '../../components/company-job-selector';
import { discoveryService, notificationService, profileVideoService, safetyService } from '../../services';

import { candidatePassesFilters, defaultDiscoveryFilters, scoreCandidateForJob } from '../../utils/matching';
import { isTutorialPausedForFilter, openTutorialTab, setTutorialPausedForFilter } from '../../utils/tutorial-flow';

const CopilotView = walkthroughable(View);

function CandidateCardVideo({ video }: { video: ProfileVideo }) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(playbackUrl ? { uri: playbackUrl } : null, (instance) => {
    instance.loop = false;
    instance.muted = false;
  });

  const backgroundPlayer = useVideoPlayer(playbackUrl ? { uri: playbackUrl } : null, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  useEffect(() => {
    let mounted = true;
    setPlaybackUrl(null);
    setVideoLoading(true);

    profileVideoService
      .getPlaybackUrl(video.id)
      .then((url) => {
        if (mounted) setPlaybackUrl(url);
      })
      .catch(() => {
        if (mounted) setPlaybackUrl(null);
      })
      .finally(() => {
        if (mounted) setVideoLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [video.id]);

  if (!playbackUrl) {
    return (
      <View style={styles.videoFallback}>
        {videoLoading ? (
          <ActivityIndicator color={COLORS.primarySoft} />
        ) : (
          <Ionicons name="videocam-off-outline" size={42} color={COLORS.textMuted} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.cardVideoWrap}>
      <View pointerEvents="none" style={styles.cardVideoBlurLayer}>
        <VideoView
          style={styles.cardVideoBlur}
          player={backgroundPlayer}
          contentFit="cover"
          nativeControls={false}
        />
        <BlurView intensity={46} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(5,7,17,0.72)', 'rgba(5,7,17,0.30)', 'rgba(5,7,17,0.72)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <VideoView
        style={styles.cardVideo}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
      {!isPlaying && (
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.cardVideoPlayOverlay}
          onPress={() => {
            player.play();
            backgroundPlayer.play();
            setIsPlaying(true);
          }}
        >
          <View style={styles.cardVideoPlayButton}>
            <Ionicons name="play" size={30} color={COLORS.white} />
          </View>
          <Text style={styles.cardVideoPlayText}>Pusti video</Text>
        </TouchableOpacity>
      )}
      {isPlaying && (
        <TouchableOpacity
          activeOpacity={0.84}
          style={styles.cardVideoPauseButton}
          onPress={() => {
            player.pause();
            backgroundPlayer.pause();
            setIsPlaying(false);
          }}
        >
          <Ionicons name="pause" size={18} color={COLORS.white} />
          <Text style={styles.cardVideoPauseText}>Pauziraj</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}


export default function CompanySwipeScreen({ navigation }: any) {

  const { user, profile } = useAuth();

  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { copilotEvents, start, stop } = useCopilot();
  const candidateCardHeight = Math.min(
    760,
    Math.max(460, Math.round((height - insets.top - insets.bottom) * 0.6))
  );


  const [candidates, setCandidates] = useState<any[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(false);

  const [matchVisible, setMatchVisible] = useState(false);

  const [matchName, setMatchName] = useState<string | null>(null);

  const [candidateModalVisible, setCandidateModalVisible] = useState(false);

  const [matchedCandidate, setMatchedCandidate] = useState<any | null>(null);

  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterTutorialActive, setFilterTutorialActive] = useState(false);
  const [activeJobs, setActiveJobs] = useState<JobListing[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobSelectorVisible, setJobSelectorVisible] = useState(false);
  const selectedJob = activeJobs.find((job) => job.id === selectedJobId) || null;
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
    const handleStepChange = (step: { name?: string } | undefined) => {
      const isFilterStep = step?.name === 'korak-Filteri kandidata';
      setFilterTutorialActive(isFilterStep);
      if (isFilterStep) {
        setTutorialPausedForFilter(true);
        setFiltersVisible(true);
        setTimeout(() => { void stop(); }, 0);
      }
    };
    const handleStop = () => {
      if (isTutorialPausedForFilter()) return;
      setFilterTutorialActive(false);
      setFiltersVisible(false);
    };
    copilotEvents.on('stepChange', handleStepChange);
    copilotEvents.on('stop', handleStop);
    return () => {
      copilotEvents.off('stepChange', handleStepChange);
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, stop]);

  const continueFromFilterTutorial = () => {
    setFilterTutorialActive(false);
    setFiltersVisible(false);
    setTutorialPausedForFilter(false);
    openTutorialTab('Jobs');
    navigation.getParent()?.navigate('Jobs');
    setTimeout(() => { void start('korak-Oglasi i analitika'); }, 500);
  };


  const matchOverlay = (

    <MatchCelebration

      visible={matchVisible && !!matchedCandidate}

      candidateAvatar={matchedCandidate?.avatar_url}

      candidateName={matchName}

      companyAvatar={profile?.avatar_url}
      companyName={profile?.full_name}
      jobTitle={selectedJob?.title}
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



  const fetchCandidates = async (job: JobListing) => {
    if (!user) return;


    setLoading(true);

    const blockedIds = await safetyService.fetchBlockedIds(user.id);



    const { data: swipedData } = await supabase

      .from('swipes')

      .select('target_id')
      .eq('swiper_id', user.id)
      .eq('target_type', 'candidate')
      .eq('job_id', job.id);


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

    if (blockedIds.length > 0) {
      const quotedBlockedIds = blockedIds.map((id) => `"${id}"`).join(',');
      query = query.not('id', 'in', `(${quotedBlockedIds})`);
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
    let videoRows: ProfileVideo[] = [];



    if (candidateIds.length > 0) {

      verificationRows = await verificationService.fetchPublicVerifiedExperiences(candidateIds).catch(() => []);
      const { data: videoData } = await supabase
        .from('profile_videos')
        .select('*')
        .in('user_id', candidateIds)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      videoRows = (videoData || []) as ProfileVideo[];

    }

    setCandidates(candidateRows.map((candidate) => {
      const candidateVerifications = verificationRows.filter((item) => item.candidate_id === candidate.id);
      const profileVideo = videoRows.find((item) => item.user_id === candidate.id) || null;
      const matchScore: MatchScore = scoreCandidateForJob(
        candidate.candidate_profiles as CandidateProfile,
        candidate as Profile,
        job,
        candidateVerifications.length > 0
      );
      return {

        ...candidate,

        experience_verifications: candidateVerifications,

        has_verified_experience: candidateVerifications.length > 0,

        profile_video: profileVideo,

        matchScore,

      };

    }));

    setCurrentIndex(0);

    setLoading(false);

  };



  const loadDiscovery = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('company_id', user.id)
      .eq('status', 'active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
        Alert.alert('Greška oglasi', error.message);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const jobs = ((data || []) as JobListing[]).filter((job) => !job.expires_at || new Date(job.expires_at).getTime() > now);
    setActiveJobs(jobs);
    if (!jobs.length) {
      setSelectedJobId(null);
      setCandidates([]);
      setLoading(false);
      return;
    }

    const storedJobId = await discoveryService.loadSelectedCompanyJob(user.id);
    const job = jobs.find((item) => item.id === selectedJobId)
      || jobs.find((item) => item.id === storedJobId)
      || jobs[0];
    const savedFilters = await discoveryService.loadFilters(user.id, 'company', job.id);
    setSelectedJobId(job.id);
    setFilters(savedFilters);
    await discoveryService.saveSelectedCompanyJob(user.id, job.id);
    await fetchCandidates(job);
  };

  const selectJob = async (job: JobListing) => {
    if (!user || job.id === selectedJobId) {
      setJobSelectorVisible(false);
      return;
    }
    setJobSelectorVisible(false);
    setCandidateModalVisible(false);
    setSelectedJobId(job.id);
    setCurrentIndex(0);
    const savedFilters = await discoveryService.loadFilters(user.id, 'company', job.id);
    setFilters(savedFilters);
    await discoveryService.saveSelectedCompanyJob(user.id, job.id);
    await fetchCandidates(job);
  };

  useFocusEffect(
    useCallback(() => {
      if (isTutorialPausedForFilter()) return;
      loadDiscovery();
    }, [user?.id])
  );


  const createMatchIfExists = async (candidateId: string) => {
    if (!user || !selectedJob) return;


    const { data: companyJobs, error: jobsError } = await supabase

      .from('job_listings')

      .select('id, expires_at')
      .eq('id', selectedJob.id)
      .eq('company_id', user.id)
      .eq('status', 'active')

      .eq('is_active', true);



    if (jobsError) {

      console.warn('Company match job check failed:', jobsError.message);

      return;

    }



    const paidCompanyJobs = (companyJobs || []).filter((job: any) => !job.expires_at || new Date(job.expires_at).getTime() > Date.now());

    const jobIds = paidCompanyJobs.map((job) => job.id) || [];



    if (jobIds.length === 0) {

      return;

    }



    const { data: allCandidateJobs, error: allJobsError } = await supabase

      .from('swipes')

      .select('*')
      .eq('swiper_id', candidateId)
      .eq('target_type', 'job')
      .eq('target_id', selectedJob.id)
      .eq('job_id', selectedJob.id)
      .eq('direction', 'right');


    if (allJobsError) {

      console.warn('Company match like check failed:', allJobsError.message);

    }



    const candidateLike = Array.isArray(allCandidateJobs)

      ? allCandidateJobs.find((swipe) => jobIds.includes(swipe.target_id))

      : null;



    if (!candidateLike) {



      return;

    }



    const { data: existingMatch } = await supabase

      .from('matches')

      .select('*')

      .eq('candidate_id', candidateId)

      .eq('company_id', user.id)

      .eq('job_id', candidateLike.target_id)

      .maybeSingle();



    if (existingMatch) {

      return;

    }



    const { data: matchData, error: matchError } = await supabase.from('matches').insert({
      candidate_id: candidateId,
      company_id: user.id,
      job_id: candidateLike.target_id,
    }).select('id').single();


    if (matchError) {

      console.warn('Match insert failed:', matchError.message, { candidateId, companyId: user.id, jobId: candidateLike.target_id });

      return;

    }



    setMatchedCandidate(currentCandidate);
    setMatchName(currentCandidate?.display_name || currentCandidate?.full_name || 'Kandidat');
    setMatchVisible(true);
    notificationService.dispatchPending().catch(() => null);
  };


  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!user || !currentCandidate || !selectedJob) return;


    const candidateId = currentCandidate.id;



    const { data: swipeData, error } = await supabase.from('swipes').upsert(

      {

        swiper_id: user.id,

        target_id: candidateId,
        target_type: 'candidate',
        direction,
        job_id: selectedJob.id,
        decided_at: new Date().toISOString(),
      },

      {

        onConflict: 'swiper_id,target_id,target_type,job_id',
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

      await fetchCandidates(selectedJob);
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

  if (!selectedJob) {
    return (
      <View style={styles.center}>
        <View style={styles.noJobIcon}>
          <Ionicons name="briefcase-outline" size={30} color="#a9b3ff" />
        </View>
        <Text style={styles.title}>Prvo aktiviraj oglas</Text>
        <Text style={styles.noJobText}>Kandidati se sada pregledaju posebno za svaki aktivan oglas.</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => navigation.getParent()?.navigate('Jobs')}>
          <Text style={styles.refreshButtonText}>Otvori moje oglase</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentCandidate) {
    return (

      <View style={styles.center}>

        <Text style={styles.title}>Nema više kandidata</Text>



        <View style={styles.emptySelectorWrap}>
          <CompanyJobSelector
            jobs={activeJobs}
            selectedJob={selectedJob}
            visible={jobSelectorVisible}
            onOpen={() => setJobSelectorVisible(true)}
            onClose={() => setJobSelectorVisible(false)}
            onSelect={selectJob}
          />
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchCandidates(selectedJob)}>
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

            if (user) discoveryService.saveFilters(user.id, 'company', next, selectedJob.id);
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



        <CopilotStep
          order={2}
          name="korak-Filteri kandidata"
          text="Broj pokazuje gde se nalaziš u listi kandidata za izabrani oglas. Otvori filtere da suziš prikaz prema lokaciji, iskustvu, veštinama i procentu poklapanja."
        >
        <CopilotView collapsable={false} style={styles.countPill}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFiltersVisible(true)}>
            <Ionicons name="options" size={18} color="#a9b3ff" />
          </TouchableOpacity>
          <Text style={styles.countText}>{currentIndex + 1}/{visibleCandidates.length}</Text>
        </CopilotView>
        </CopilotStep>
      </View>

      <CopilotStep
        order={1}
        name="korak-Kandidati po oglasu"
        text="Prvo izaberi oglas za koji tražiš radnika. Kandidati, njihov procenat poklapanja i tvoje odluke uvek se čuvaju odvojeno za svaki oglas. Zatim prevuci kandidata desno za interesovanje ili levo za preskakanje."
      >
      <CopilotView collapsable={false} style={styles.selectorWrap}>
        <CompanyJobSelector
          jobs={activeJobs}
          selectedJob={selectedJob}
          visible={jobSelectorVisible}
          onOpen={() => setJobSelectorVisible(true)}
          onClose={() => setJobSelectorVisible(false)}
          onSelect={selectJob}
        />
      </CopilotView>
      </CopilotStep>

      <Text style={styles.swipeHint}>Prevucite desno za lajk, levo za preskakanje</Text>


      <SwipeCard
        onSwipeLeft={() => handleSwipe('left')}
        onSwipeRight={() => handleSwipe('right')}
        cardHeight={candidateCardHeight}
        bottomSpacing={0}
      >
        <View style={styles.card}>
          <View style={styles.cardTouch}>

            <View style={styles.cardMedia}>
            {currentCandidate.profile_video ? (

              <CandidateCardVideo video={currentCandidate.profile_video} />

            ) : currentCandidate.avatar_url ? (

              <Image source={{ uri: currentCandidate.avatar_url }} style={styles.avatarImage} resizeMode="cover" />

            ) : (

              <Text style={styles.avatarFallback}>👤</Text>

            )}
            </View>



            <TouchableOpacity onPress={openCandidateProfile} activeOpacity={0.9} style={styles.infoPressable}>
              <LinearGradient
                colors={['rgba(17,21,34,0.98)', '#080a10']}
                style={styles.infoPanel}
              >
              <View style={styles.cardTop}>

                <Text style={styles.roleTag}>{candidateProfile?.skills?.slice(0, 2).join(' • ') || 'Profil kandidata'}</Text>

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
                <View style={styles.detailsHint}>
                  <Text style={styles.detailsHintText}>Dodirni ovde za detalje</Text>
                  <Ionicons name="chevron-forward" size={15} color={COLORS.primarySoft} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

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

                <Text style={styles.profileModalSubTitle}>{currentCandidate?.candidate_profiles?.skills?.slice(0, 3).join(' • ') || 'Profil kandidata'}</Text>

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



      {matchOverlay}
      <DiscoveryFilterModal
        visible={filtersVisible}
        mode="company"
        value={filters}
        tutorialActive={filterTutorialActive}
        onTutorialNext={continueFromFilterTutorial}
        onClose={filterTutorialActive ? continueFromFilterTutorial : () => setFiltersVisible(false)}
        onApply={(next) => {
          setFilters(next);
          setCurrentIndex(0);
          if (user) discoveryService.saveFilters(user.id, 'company', next, selectedJob.id);
          if (filterTutorialActive) continueFromFilterTutorial();
          else setFiltersVisible(false);
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

    paddingBottom: 96,
    alignItems: 'center',

  },

  headerRow: {

    width: '100%',

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'flex-start',

    marginBottom: 12,
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
  selectorWrap: { width: '100%', alignItems: 'center', marginBottom: 12 },
  emptySelectorWrap: { width: '100%', maxWidth: 520, paddingHorizontal: 18, marginBottom: 14 },
  center: { flex: 1, backgroundColor: '#090909', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  noJobIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(108,99,255,0.14)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.28)', marginBottom: 16 },
  noJobText: { color: '#a8b0c8', maxWidth: 360, textAlign: 'center', lineHeight: 20, marginTop: -8, marginBottom: 18 },
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
    backgroundColor: '#080a10',

  },

  cardMedia: {
    flex: 1,
    minHeight: 210,
    backgroundColor: '#05060a',
  },

  infoPressable: {
    flexShrink: 0,
  },

  infoPanel: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardVideoWrap: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#050711',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardVideoBlurLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.82,
    overflow: 'hidden',
  },
  cardVideoBlur: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.18 }],
  },
  cardVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  cardVideoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(3,4,9,0.08)',
    zIndex: 3,
  },
  cardVideoPlayButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    backgroundColor: 'rgba(124,92,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    ...Platform.select({
      web: { boxShadow: '0px 18px 40px rgba(0,0,0,0.34)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
  },
  cardVideoPlayText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.34)',
    overflow: 'hidden',
  },
  cardVideoPauseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(7,9,16,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 4,
  },
  cardVideoPauseText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  detailsHint: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(199,210,254,0.24)',
  },
  detailsHintText: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  cardTop: {
    flexDirection: 'column',

    justifyContent: 'flex-start',

    alignItems: 'flex-start',

    marginBottom: 8,
    gap: 6,
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

    marginBottom: 12,
    fontSize: 14,

    lineHeight: 20,

    opacity: 0.85,

  },
  avatarFallback: {
    ...StyleSheet.absoluteFillObject,
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

