import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SwipeCard from '../../components/SwipeCard';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { JobListing } from '../../types';

type JobWithCompany = JobListing & {
  companyName?: string;
  companyIndustry?: string | null;
  companyAvatar?: string | null;
};

export default function CandidateSwipeScreen({navigation}: any) {
  const { user, profile } = useAuth();

  const [jobs, setJobs] = useState<JobWithCompany[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [matchedJob, setMatchedJob] = useState<JobWithCompany | null>(null);
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const distanceCacheRef = useRef({ candidateLocation: '', jobLocation: '' });
  const [jobLocationCoords, setJobLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [jobMapLoading, setJobMapLoading] = useState(false);
  const [jobMapImageError, setJobMapImageError] = useState(false);
  const [jobMapProviderIndex, setJobMapProviderIndex] = useState(0);
  const [jobMapLayout, setJobMapLayout] = useState({ width: 320, height: 260 });
  const matchAnim = useRef(new Animated.Value(0)).current;
  const jobPinAnimation = useRef(new Animated.Value(0)).current;

  const currentJob = jobs[currentIndex];

  const JOB_TILE_ZOOM = 16;
  const JOB_TILE_SIZE = 256;
  const TILE_GRID_SIZE = 3;
  const tileSubdomains = ['a', 'b', 'c'];

  const tileProviders = [
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.fr/osmfr/${JOB_TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.fr/hot/${JOB_TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.de/tiles/osmde/${JOB_TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.org/${JOB_TILE_ZOOM}/${x}/${y}.png`;
    },
  ];

  const lonToTileX = (lon: number, zoom: number) =>
    ((lon + 180) / 360) * Math.pow(2, zoom);

  const latToTileY = (lat: number, zoom: number) => {
    const rad = (lat * Math.PI) / 180;
    return (
      (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2
    ) * Math.pow(2, zoom);
  };

  const getJobTileUrl = (x: number, y: number) =>
    tileProviders[jobMapProviderIndex](x, y);

  const geocodeLocation = async (query: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=1&accept-language=sr-Latn&q=${encodeURIComponent(
          query
        )}`,
        {
          headers: {
            'Accept-Language': 'sr-Latn',
          },
        }
      );
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleJobMapError = () => {
    if (jobMapProviderIndex < tileProviders.length - 1) {
      setJobMapProviderIndex((index) => index + 1);
      return;
    }
    setJobMapImageError(true);
  };

  const renderJobMap = (lat: number, lng: number) => {
    const x = lonToTileX(lng, JOB_TILE_ZOOM);
    const y = latToTileY(lat, JOB_TILE_ZOOM);
    const centerTileX = Math.floor(x);
    const centerTileY = Math.floor(y);
    const halfGrid = Math.floor(TILE_GRID_SIZE / 2);
    const leftTile = centerTileX - halfGrid;
    const topTile = centerTileY - halfGrid;
    const gridWidth = TILE_GRID_SIZE * JOB_TILE_SIZE;
    const gridHeight = TILE_GRID_SIZE * JOB_TILE_SIZE;
    const centerPixelX = (x - leftTile) * JOB_TILE_SIZE;
    const centerPixelY = (y - topTile) * JOB_TILE_SIZE;
    const translateX = jobMapLayout.width
      ? -(centerPixelX - jobMapLayout.width / 2)
      : 0;
    const translateY = jobMapLayout.height
      ? -(centerPixelY - jobMapLayout.height / 2)
      : 0;

    const tiles = [];
    for (let row = 0; row < TILE_GRID_SIZE; row += 1) {
      for (let col = 0; col < TILE_GRID_SIZE; col += 1) {
        const tileX = leftTile + col;
        const tileY = topTile + row;
        tiles.push(
          <Image
            key={`${tileX}-${tileY}`}
            source={{ uri: getJobTileUrl(tileX, tileY) }}
            style={[
              styles.jobMapTile,
              {
                left: col * JOB_TILE_SIZE,
                top: row * JOB_TILE_SIZE,
              },
            ]}
            resizeMode="cover"
            onError={handleJobMapError}
          />
        );
      }
    }

    return (
      <View
        style={styles.jobMapWrapper}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width !== jobMapLayout.width || height !== jobMapLayout.height) {
            setJobMapLayout({ width, height });
          }
        }}
      >
        {jobMapLayout.width > 0 && jobMapLayout.height > 0 ? (
          <View
            style={[
              styles.jobMapTileGrid,
              {
                width: gridWidth,
                height: gridHeight,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          >
            {tiles}
          </View>
        ) : null}
        <Animated.View
          style={[
            styles.jobMapMarker,
            { transform: [{ translateY: jobPinAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] },
          ]}
        >
          <View style={styles.jobMapMarkerDot} />
          <View style={styles.jobMapMarkerTail} />
        </Animated.View>
      </View>
    );
  };

  useEffect(() => {
    let active = true;
    if (!jobLocationCoords) return undefined;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(jobPinAnimation, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(jobPinAnimation, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();

    return () => {
      active = false;
      anim.stop();
    };
  }, [jobLocationCoords, jobPinAnimation]);

  const matchOverlay = matchVisible && matchedJob ? (
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
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.matchAvatar} />
            ) : (
              <Text style={styles.matchAvatarIcon}>👤</Text>
            )}
          </View>
          <Text style={styles.matchLabel}>Kandidat</Text>
          <Text style={styles.matchPersonName}>{profile?.full_name || 'Ti'}</Text>
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
            {matchedJob.companyAvatar ? (
              <Image source={{ uri: matchedJob.companyAvatar }} style={styles.matchAvatar} />
            ) : (
              <Text style={styles.matchAvatarIcon}>🏢</Text>
            )}
          </View>
          <Text style={styles.matchLabel}>Firma</Text>
          <Text style={styles.matchPersonName}>{matchedJob.companyName}</Text>
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

  const openCompanyProfile = () => {
  if (!currentJob) return;

  navigation.navigate('ViewProfile', {
    profileId: currentJob.company_id,
    userType: 'company',
    returnTo: 'SwipeMain',
  });
};


  const fetchJobs = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: swipedData, error: swipesError } = await supabase
      .from('swipes')
      .select('target_id')
      .eq('swiper_id', user.id)
      .eq('target_type', 'job');

    if (swipesError) {
      Alert.alert('Greška swipes', swipesError.message);
      setLoading(false);
      return;
    }

    const swipedIds = swipedData?.map((s) => s.target_id) || [];

    let query = supabase
      .from('job_listings')
      .select('*')
      .eq('status', 'active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (swipedIds.length > 0) {
      const quotedIds = swipedIds.map((id) => `"${id}"`).join(',');
      query = query.not('id', 'in', `(${quotedIds})`);
    }

    const { data: jobsData, error: jobsError } = await query;

    if (jobsError) {
      Alert.alert('Greška jobs', jobsError.message);
      setLoading(false);
      return;
    }

    const companyIds = [...new Set((jobsData || []).map((job) => job.company_id))];

    let companyMap: Record<
      string,
      { company_name: string | null; industry: string | null; avatar_url: string | null }
    > = {};

    if (companyIds.length > 0) {
      const { data: companiesData, error: companiesError } = await supabase
        .from('company_profiles')
        .select('id, company_name, industry')
        .in('id', companyIds);

      if (companiesError) {
        Alert.alert('Greška companies', companiesError.message);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', companyIds);

      if (profilesError) {
        Alert.alert('Greška profiles', profilesError.message);
        setLoading(false);
        return;
      }

      const avatarMap = (profilesData || []).reduce((acc: any, p: any) => {
        acc[p.id] = p.avatar_url;
        return acc;
      }, {});

      companyMap = (companiesData || []).reduce((acc, company) => {
        acc[company.id] = {
          company_name: company.company_name,
          industry: company.industry,
          avatar_url: avatarMap[company.id] || null,
        };
        return acc;
      }, {} as Record<string, { company_name: string | null; industry: string | null; avatar_url: string | null }>);
    }

    const preparedJobs: JobWithCompany[] = (jobsData || []).map((job) => ({
      ...job,
      companyName: companyMap[job.company_id]?.company_name || 'Firma',
      companyIndustry: companyMap[job.company_id]?.industry || null,
      companyAvatar: companyMap[job.company_id]?.avatar_url || null,
    }));

    setJobs(preparedJobs);
    setCurrentIndex(0);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [user?.id])
  );

  useEffect(() => {
    let active = true;

    const computeDistance = async () => {
      if (!profile?.location || !currentJob?.location) {
        setDistanceLabel(null);
        return;
      }

      if (
        profile.location === distanceCacheRef.current.candidateLocation &&
        currentJob.location === distanceCacheRef.current.jobLocation
      ) {
        return;
      }

      const [candidateCoords, jobCoords] = await Promise.all([
        geocodeLocation(profile.location),
        geocodeLocation(currentJob.location),
      ]);

      if (!active) return;
      if (!candidateCoords || !jobCoords) {
        setDistanceLabel(null);
        return;
      }

      const toRad = (value: number) => (value * Math.PI) / 180;
      const dLat = toRad(jobCoords.lat - candidateCoords.lat);
      const dLon = toRad(jobCoords.lon - candidateCoords.lon);
      const lat1 = toRad(candidateCoords.lat);
      const lat2 = toRad(jobCoords.lat);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const km = 6371 * c;
      const label = km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km * 10) / 10} km`;

      distanceCacheRef.current = {
        candidateLocation: profile.location,
        jobLocation: currentJob.location,
      };
      setDistanceLabel(label);
    };

    computeDistance();

    return () => {
      active = false;
    };
  }, [currentJob?.location, profile?.location]);

  useEffect(() => {
    let active = true;

    const loadJobMap = async () => {
      if (!currentJob?.location) {
        setJobLocationCoords(null);
        return;
      }

      setJobMapLoading(true);
      setJobMapImageError(false);

      const coords = await geocodeLocation(currentJob.location);
      if (!active) return;
      setJobLocationCoords(coords);
      setJobMapLoading(false);
    };

    loadJobMap();

    return () => {
      active = false;
    };
  }, [currentJob?.location]);

  const createMatchIfExists = async () => {
    if (!user || !currentJob) return false;

    const candidateId = user.id;
    const companyId = currentJob.company_id;
    const jobId = currentJob.id;

    const { data: companyLikeData, error: companyLikeError } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', companyId)
      .eq('target_type', 'candidate')
      .eq('target_id', candidateId)
      .eq('direction', 'right')
      .limit(1);

    if (companyLikeError) {
      console.warn('Candidate match check failed:', companyLikeError.message);
      Alert.alert('Greška match', companyLikeError.message);
      return false;
    }

    const companyLike = Array.isArray(companyLikeData) ? companyLikeData[0] : companyLikeData;

    if (!companyLike) {
      console.log('Candidate match check: company has not liked this candidate yet', { candidateId, companyId, jobId });
      return false;
    }

    console.log('Candidate match check success:', { candidateId, companyId, jobId, companyLike });

    const { data: existingMatch, error: existingMatchError } = await supabase
      .from('matches')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('company_id', companyId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (existingMatchError) {
      Alert.alert('Greška match', existingMatchError.message);
      return false;
    }

    if (existingMatch) {
      return false;
    }

    const { error: matchError } = await supabase.from('matches').insert({
      candidate_id: candidateId,
      company_id: companyId,
      job_id: jobId,
    });

    if (matchError) {
      console.warn('Candidate match insert failed:', matchError.message, { candidateId, companyId, jobId });
      Alert.alert('Greška match', matchError.message);
      return false;
    }

    console.log('Candidate match created:', { candidateId, companyId, jobId });
    setMatchedJob(currentJob);
    setMatchName(currentJob?.companyName || 'Firma');
    setMatchVisible(true);
    matchAnim.setValue(0);
    Animated.sequence([
      Animated.timing(matchAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: false }),
      Animated.delay(1800),
      Animated.timing(matchAnim, { toValue: 0, duration: 300, easing: Easing.in(Easing.exp), useNativeDriver: false }),
    ]).start(() => {
      setMatchVisible(false);
      setMatchedJob(null);
    });

    return true;
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!user || !currentJob) return;

    const { data: swipeData, error } = await supabase.from('swipes').upsert(
      {
        swiper_id: user.id,
        target_id: currentJob.id,
        target_type: 'job',
        direction,
      },
      {
        onConflict: 'swiper_id,target_id',
      }
    ).select();

    console.log('Candidate swipe saved:', { swipeData, currentJob: currentJob.id, direction });

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    if (direction === 'right') {
      await createMatchIfExists();
    }

    setCurrentIndex((prev) => prev + 1);

    // Ako nema više poslova, osvezi listu
    if (currentIndex + 1 >= jobs.length) {
      setLoading(true);
      await fetchJobs();
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Korisnik nije učitan</Text>
        <Text style={styles.emptyText}>Probaj refresh aplikacije.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.emptyText}>Učitavanje oglasa...</Text>
        {matchOverlay}
      </View>
    );
  }

  if (!currentJob) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nema više oglasa 👀</Text>
        <Text style={styles.emptyText}>Vrati se kasnije kada firme dodaju nove poslove.</Text>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchJobs}>
          <Text style={styles.refreshButtonText}>Osveži</Text>
        </TouchableOpacity>
        {matchOverlay}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Poslovi</Text>
          <Text style={styles.subHeader}>Istraži poslove</Text>
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countText}>{currentIndex + 1}/{jobs.length}</Text>
        </View>
      </View>

      <SwipeCard onSwipeLeft={() => handleSwipe('left')} onSwipeRight={() => handleSwipe('right')}>
        <View style={styles.card}>
          <TouchableOpacity onPress={openCompanyProfile} activeOpacity={0.85} style={styles.cardTouch}>
            <View style={styles.cardTop}>
              {currentJob.companyAvatar ? (
                <Image source={{ uri: currentJob.companyAvatar }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>🏢</Text>
                </View>
              )}

              <View style={styles.companyInfo}>
                <Text style={styles.company}>{currentJob.companyName}</Text>
                {!!currentJob.companyIndustry && <Text style={styles.locationText}>{currentJob.companyIndustry}</Text>}
                {!!currentJob.job_type && <Text style={styles.profileHint}>{currentJob.job_type}</Text>}
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.title}>{currentJob.title}</Text>
              <Text style={styles.meta}>
                📍 {currentJob.location || 'Lokacija nije navedena'}
                {distanceLabel ? ` • ${distanceLabel}` : ''}
              </Text>

              {currentJob.location ? (
                <View style={styles.jobMapCard}>
                  <Text style={styles.jobMapLabel}>Mapa lokacije</Text>
                  {jobMapLoading ? (
                    <View style={styles.jobMapFallback}>
                      <ActivityIndicator color="#6C63FF" />
                      <Text style={styles.jobMapFallbackText}>Učitavanje mape...</Text>
                    </View>
                  ) : jobLocationCoords && !jobMapImageError ? (
                    renderJobMap(jobLocationCoords.lat, jobLocationCoords.lon)
                  ) : (
                    <View style={styles.jobMapFallback}>
                      <Text style={styles.jobMapFallbackText}>
                        Nije moguće prikazati mapu za ovu lokaciju.
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}

              {!!currentJob.skills_required?.length && (
                <View style={styles.skillsSection}>
                  <Text style={styles.skillsSectionTitle}>Potrebne veštine</Text>
                  <View style={styles.tags}>
                    {currentJob.skills_required.map((skill, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!!currentJob.description && (
                <Text style={styles.description} numberOfLines={4}>
                  {currentJob.description}
                </Text>
              )}

              <View pointerEvents="none" style={styles.overlayAccent} />
            </View>
          </TouchableOpacity>
        </View>
      </SwipeCard>

      {/* Action buttons placed outside the card to avoid overlap */}
      <View style={[styles.actionsOverlay, { pointerEvents: 'box-none' }] }>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonLeft]} onPress={() => handleSwipe('left')}>
          <Text style={styles.actionEmoji}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonCenter]} onPress={openCompanyProfile}>
          <Text style={styles.actionEmoji}>ℹ️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonRight]} onPress={() => handleSwipe('right')}>
          <Text style={styles.actionEmoji}>♥</Text>
        </TouchableOpacity>
      </View>

      {matchVisible && matchedJob && (
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
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.matchAvatar} />
                ) : (
                  <Text style={styles.matchAvatarIcon}>👤</Text>
                )}
              </View>
              <Text style={styles.matchLabel}>Kandidat</Text>
              <Text style={styles.matchPersonName}>{profile?.full_name || 'Ti'}</Text>
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
                {matchedJob.companyAvatar ? (
                  <Image source={{ uri: matchedJob.companyAvatar }} style={styles.matchAvatar} />
                ) : (
                  <Text style={styles.matchAvatarIcon}>🏢</Text>
                )}
              </View>
              <Text style={styles.matchLabel}>Firma</Text>
              <Text style={styles.matchPersonName}>{matchedJob.companyName}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 12, paddingTop: 12, alignItems: 'center' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    height: 600,
    backgroundColor: '#0d0d0d',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.28)',
    boxShadow: '0px 0px 24px rgba(108, 99, 255, 0.2)',
    shadowColor: '#0f1226',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
    padding: 18,
    justifyContent: 'space-between',
  },
  logoImage: {
    width: 84,
    height: 84,
    borderRadius: 22,
    marginRight: 14,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brand: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  brandAccent: {
    color: '#ff3b6b',
  },
  topIcon: {
    color: '#aaa',
    fontSize: 22,
  },
  imageLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignSelf: 'center',
    marginBottom: 28,
  },
  infoPanel: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18,
    padding: 16,
  },
  logoFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  logoFallbackText: {
    color: '#777',
    fontSize: 40,
  },
  profileHint: {
    color: '#777',
    fontSize: 13,
    marginTop: 6,
  },
  companyInfo: {
    flex: 1,
  },
  company: {
    color: '#a8f0ff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  locationText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 1,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  overlayAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    backgroundColor: 'rgba(108,99,255,0.14)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  meta: { color: '#bbb', fontSize: 12, marginBottom: 6 },
  description: { color: '#ddd', fontSize: 12, lineHeight: 18, marginTop: 4 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardContent: {
    paddingBottom: 14,
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  cardTouch: {
    flex: 1,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillsSection: {
    marginTop: 12,
  },
  skillsSectionTitle: {
    color: '#a8b2ff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tag: {
    backgroundColor: '#1a1633',
    borderColor: '#6C63FF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: '#6C63FF', fontWeight: '600' },
  jobMapCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#272737',
    backgroundColor: '#111118',
    overflow: 'hidden',
    padding: 0,
  },
  jobMapLabel: {
    color: '#a8b2ff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  jobMapWrapper: {
    width: '100%',
    minHeight: 260,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#12121b',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobMapTileGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#12121b',
  },
  jobMapTile: {
    position: 'absolute',
    width: 256,
    height: 256,
    backgroundColor: '#12121b',
  },
  jobStaticMapImage: {
    width: '100%',
    height: 260,
  },
  jobMapMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 32,
    height: 44,
    justifyContent: 'flex-end',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -44 }],
  },
  jobMapMarkerDot: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: '#ff4d4d',
    borderWidth: 3,
    borderColor: '#fff',
  },
  jobMapMarkerTail: {
    width: 5,
    height: 12,
    backgroundColor: '#ff4d4d',
    borderRadius: 2,
    marginTop: -1,
  },
  jobMapFallback: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    backgroundColor: '#171724',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  jobMapFallbackText: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  counter: { color: '#666', textAlign: 'center', marginTop: 12 },
  emptyTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  refreshButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 12,
  },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
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
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#222',
    backgroundColor: 'rgba(15,15,20,0.95)',
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.6)',
    marginHorizontal: 10,
    elevation: 12,
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.6,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
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
  actionsRow: {
    display: 'none',
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeHint: {
    color: '#777',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
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
  matchHeart: {
    fontSize: 72,
    marginBottom: 12,
  },
  matchTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  matchName: { color: '#fff', marginTop: 8, fontSize: 16, fontWeight: '700' },
  matchSubtitle: { color: '#cbd5e1', marginTop: 8, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});