import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../../components/SwipeCard';
import MatchCelebration from '../../components/MatchCelebration';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { JobListing } from '../../types';
import { COLORS } from '../../constants';

type JobWithCompany = JobListing & {
  companyName?: string;
  companyIndustry?: string | null;
  companyAvatar?: string | null;
};

const LOCAL_CITY_COORDS: Array<{ keys: string[]; lat: number; lon: number }> = [
  { keys: ['beograd', 'belgrade', 'novi beograd', 'zemun'], lat: 44.8125, lon: 20.4612 },
  { keys: ['novi sad'], lat: 45.2671, lon: 19.8335 },
  { keys: ['nis', 'niš'], lat: 43.3209, lon: 21.8958 },
  { keys: ['kragujevac'], lat: 44.0128, lon: 20.9114 },
  { keys: ['subotica'], lat: 46.1005, lon: 19.6651 },
  { keys: ['zrenjanin'], lat: 45.3836, lon: 20.3819 },
  { keys: ['pancevo', 'pančevo'], lat: 44.8706, lon: 20.6403 },
  { keys: ['cacak', 'čačak'], lat: 43.8914, lon: 20.3497 },
  { keys: ['kraljevo'], lat: 43.7234, lon: 20.6870 },
  { keys: ['novi pazar'], lat: 43.1367, lon: 20.5122 },
  { keys: ['leskovac'], lat: 42.9981, lon: 21.9461 },
  { keys: ['valjevo'], lat: 44.2751, lon: 19.8982 },
  { keys: ['smederevo'], lat: 44.6659, lon: 20.9335 },
  { keys: ['kruševac', 'krusevac'], lat: 43.5800, lon: 21.3267 },
  { keys: ['vranje'], lat: 42.5542, lon: 21.8972 },
  { keys: ['šabac', 'sabac'], lat: 44.7489, lon: 19.6908 },
  { keys: ['užice', 'uzice'], lat: 43.8558, lon: 19.8425 },
  { keys: ['sombor'], lat: 45.7742, lon: 19.1122 },
  { keys: ['zaječar', 'zajecar'], lat: 43.9015, lon: 22.2738 },
  { keys: ['jagodina'], lat: 43.9771, lon: 21.2612 },
  { keys: ['slatine', 'mirgorodska'], lat: 43.4995, lon: 16.3338 },
  { keys: ['split'], lat: 43.5081, lon: 16.4402 },
  { keys: ['trogir'], lat: 43.5164, lon: 16.2502 },
  { keys: ['zagreb'], lat: 45.8150, lon: 15.9819 },
  { keys: ['rijeka'], lat: 45.3271, lon: 14.4422 },
  { keys: ['osijek'], lat: 45.5549, lon: 18.6955 },
  { keys: ['zadar'], lat: 44.1194, lon: 15.2314 },
  { keys: ['remote', 'remote posao', 'rad od kuce', 'rad od kuće'], lat: 44.8125, lon: 20.4612 },
];

const getLocalCoords = (query: string) => {
  const normalized = query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = LOCAL_CITY_COORDS.find((item) =>
    item.keys.some((key) => normalized.includes(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
  );

  return match ? { lat: match.lat, lon: match.lon } : null;
};

export default function CandidateSwipeScreen({navigation}: any) {
  const { user, profile } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [jobs, setJobs] = useState<JobWithCompany[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [matchedJob, setMatchedJob] = useState<JobWithCompany | null>(null);
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const distanceCacheRef = useRef({ candidateLocation: '', jobLocation: '' });
  const geocodeCacheRef = useRef<Record<string, { lat: number; lon: number } | null>>({});
  const [jobLocationCoords, setJobLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [jobMapLoading, setJobMapLoading] = useState(false);
  const [jobMapImageError, setJobMapImageError] = useState(false);
  const [jobMapProviderIndex, setJobMapProviderIndex] = useState(0);
  const [jobMapLayout, setJobMapLayout] = useState({ width: 320, height: 260 });
  const failedMapProvidersRef = useRef<Set<number>>(new Set());
  const matchAnim = useRef(new Animated.Value(1)).current;
  const jobPinAnimation = useRef(new Animated.Value(0)).current;

  const currentJob = jobs[currentIndex];
  const isCompact = height < 760 || width < 380;
  const visibleSkills = currentJob?.skills_required?.slice(0, isCompact ? 4 : 6) || [];
  const hiddenSkillCount = Math.max((currentJob?.skills_required?.length || 0) - visibleSkills.length, 0);
  const deckProgress = jobs.length > 0 ? Math.min((currentIndex + 1) / jobs.length, 1) : 0;

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
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return null;

    if (normalizedQuery in geocodeCacheRef.current) {
      return geocodeCacheRef.current[normalizedQuery];
    }

    const isWeb = Platform.OS === 'web';
    const webHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const publicUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=1&accept-language=sr-Latn&q=${encodeURIComponent(query)}`;
    const attempts = isWeb
      ? [
          { url: `http://${webHost}:8787/geocode?q=${encodeURIComponent(query)}`, proxied: true },
          { url: publicUrl, proxied: false },
        ]
      : [{ url: publicUrl, proxied: false }];

    for (const attempt of attempts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(attempt.url, {
          signal: controller.signal,
          headers: attempt.proxied ? undefined : { 'Accept-Language': 'sr-Latn' },
        });
        if (!response.ok) continue;

        const data = await response.json();
        const result = attempt.proxied ? data : Array.isArray(data) ? data[0] : null;
        if (result?.lat && result?.lon) {
          const coords = { lat: Number(result.lat), lon: Number(result.lon) };
          geocodeCacheRef.current[normalizedQuery] = coords;
          return coords;
        }
      } catch {
        // Try the next endpoint, then use the local city fallback below.
      } finally {
        clearTimeout(timeout);
      }
    }

    // A street address often contains a house number. We can still resolve its
    // city locally when the upstream geocoder is unavailable.
    const fallbackCoords = getLocalCoords(query);
    if (fallbackCoords) geocodeCacheRef.current[normalizedQuery] = fallbackCoords;
    return fallbackCoords;
  };

  const handleJobMapError = (providerIndex: number) => {
    // A map renders nine tiles at once. Advance a failed provider only once,
    // otherwise simultaneous image errors skip every fallback provider.
    if (failedMapProvidersRef.current.has(providerIndex)) return;
    failedMapProvidersRef.current.add(providerIndex);

    if (providerIndex < tileProviders.length - 1) {
      setJobMapProviderIndex((index) => Math.max(index, providerIndex + 1));
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
    const tileSize = jobMapLayout.width
      ? Math.max(Math.min(jobMapLayout.width / TILE_GRID_SIZE, JOB_TILE_SIZE), 180)
      : JOB_TILE_SIZE;
    const gridWidth = TILE_GRID_SIZE * tileSize;
    const gridHeight = TILE_GRID_SIZE * tileSize;
    const centerPixelX = (x - leftTile) * tileSize;
    const centerPixelY = (y - topTile) * tileSize;
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
                left: col * tileSize,
                top: row * tileSize,
                width: tileSize,
                height: tileSize,
              },
            ]}
            resizeMode="cover"
            onError={() => handleJobMapError(jobMapProviderIndex)}
          />
        );
      }
    }

    return (
      <View
        style={[styles.jobMapWrapper, isCompact && styles.jobMapWrapperCompact]}
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

  const legacyMatchOverlay = matchVisible && matchedJob ? (
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

  const matchOverlay = (
    <MatchCelebration
      visible={matchVisible && !!matchedJob}
      candidateAvatar={profile?.avatar_url}
      candidateName={profile?.full_name}
      companyAvatar={matchedJob?.companyAvatar}
      companyName={matchName}
      onContinue={() => {
        setMatchVisible(false);
        setMatchedJob(null);
      }}
    />
  );

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
      setJobMapProviderIndex(0);
      failedMapProvidersRef.current.clear();

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
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + 28,
          paddingTop: Math.max(insets.top, 12),
          paddingHorizontal: width > 430 ? 20 : 12,
        },
      ]}
    >
      <View style={styles.discoveryHeader}>
      <View style={styles.headerRow}>
        <View style={styles.headerLead}>
          <View style={styles.headerIconBox}>
            <Ionicons name="compass" size={23} color={COLORS.primarySoft} />
          </View>
          <View style={styles.headerCopy}>
          <Text style={styles.header}>Poslovi za tebe</Text>
          <Text style={styles.subHeader}>Istraži poslove</Text>
        </View>

        </View>

        <View style={styles.countPill}>
          <Text style={styles.countText}>{currentIndex + 1}/{jobs.length}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${deckProgress * 100}%` }]} />
      </View>
      </View>

      <SwipeCard
        bottomSpacing={12}
        onSwipeLeft={() => handleSwipe('left')}
        onSwipeRight={() => handleSwipe('right')}
      >
        <LinearGradient colors={['#171B29', '#0D101A', '#080A10']} style={styles.card}>
          <TouchableOpacity onPress={openCompanyProfile} activeOpacity={0.9} style={styles.cardTouch}>
            {currentJob.location ? (
              <View style={styles.mapHero}>
                {jobMapLoading ? (
                  <View style={styles.mapHeroFallback}>
                    <ActivityIndicator color={COLORS.primarySoft} />
                    <Text style={styles.jobMapFallbackText}>Ucitavanje mape...</Text>
                  </View>
                ) : jobLocationCoords && !jobMapImageError ? (
                  renderJobMap(jobLocationCoords.lat, jobLocationCoords.lon)
                ) : (
                  <View style={styles.locationHeroFallback}>
                    <Ionicons name="location-outline" size={34} color={COLORS.primarySoft} />
                    <Text style={styles.locationHeroTitle} numberOfLines={1}>
                      {currentJob.location || 'Lokacija nije navedena'}
                    </Text>
                    <Text style={styles.locationHeroSubtitle}>Lokacija oglasa</Text>
                  </View>
                )}

                <View style={styles.mapHeroBadge}>
                  {currentJob.companyAvatar ? (
                    <Image source={{ uri: currentJob.companyAvatar }} style={styles.mapHeroLogo} />
                  ) : (
                    <Ionicons name="business" size={28} color={COLORS.primarySoft} />
                  )}
                </View>
              </View>
            ) : null}

            <LinearGradient
              colors={['rgba(7,8,13,0.02)', 'rgba(7,8,13,0.22)', 'rgba(7,8,13,0.96)']}
              locations={[0, 0.46, 1]}
              pointerEvents="none"
              style={styles.mapScrim}
            />

            <View style={[styles.cardTop, styles.hiddenMapCard]}>
              {currentJob.companyAvatar ? (
                <Image source={{ uri: currentJob.companyAvatar }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>🏢</Text>
                </View>
              )}

              <View style={styles.companyInfo}>
                <Text style={styles.company} numberOfLines={1}>{currentJob.companyName}</Text>
                {!!currentJob.companyIndustry && <Text style={styles.locationText} numberOfLines={1}>{currentJob.companyIndustry}</Text>}
                {!!currentJob.job_type && <Text style={styles.profileHint}>{currentJob.job_type}</Text>}
              </View>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.jobIdentityRow}>
                <View style={styles.companyLabel}>
                  <Ionicons name="business-outline" size={15} color={COLORS.accent} />
                  <Text style={styles.companyLabelText} numberOfLines={1}>
                    {currentJob.companyName}
                  </Text>
                </View>

                {!!currentJob.job_type && (
                  <View style={styles.jobTypePill}>
                    <Text style={styles.jobTypePillText} numberOfLines={1}>{currentJob.job_type}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.72}
                onPress={(event) => {
                  event.stopPropagation();
                  setJobModalVisible(true);
                }}
              >
                <Text style={styles.title} numberOfLines={isCompact ? 2 : 3}>{currentJob.title}</Text>
              </TouchableOpacity>
              <Text style={styles.meta}>
                📍 {currentJob.location || 'Lokacija nije navedena'}
                {distanceLabel ? ` • ${distanceLabel}` : ''}
              </Text>

              {false && jobLocationCoords ? (
                <View style={[styles.jobMapCard, styles.hiddenMapCard]}>
                  {jobMapLoading ? (
                    <View style={styles.jobMapFallback}>
                      <ActivityIndicator color="#6C63FF" />
                      <Text style={styles.jobMapFallbackText}>Učitavanje mape...</Text>
                    </View>
                  ) : jobLocationCoords && !jobMapImageError ? (
                    renderJobMap(jobLocationCoords!.lat, jobLocationCoords!.lon)
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
                <TouchableOpacity
                  style={styles.skillsSection}
                  activeOpacity={0.78}
                  onPress={(event) => {
                    event.stopPropagation();
                    setJobModalVisible(true);
                  }}
                >
                  <Text style={styles.skillsSectionTitle}>Potrebne veštine</Text>
                  <View style={styles.tags}>
                    {visibleSkills.map((skill, index) => (
                      <View key={`${skill}-${index}`} style={styles.tag}>
                        <Text style={styles.tagText} numberOfLines={1}>{skill}</Text>
                      </View>
                    ))}
                    {hiddenSkillCount > 0 && (
                      <View style={styles.moreTag}>
                        <Text style={styles.moreTagText}>+{hiddenSkillCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {!!currentJob.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {currentJob.description}
                </Text>
              )}

            </View>
          </TouchableOpacity>
        </LinearGradient>
      </SwipeCard>

      <Modal
        transparent
        animationType="fade"
        visible={jobModalVisible}
        onRequestClose={() => setJobModalVisible(false)}
      >
        <View style={styles.jobModalOverlay}>
          <View style={styles.jobModalCard}>
            <View style={styles.jobModalHeader}>
              <View style={styles.jobModalLogoBox}>
                {currentJob.companyAvatar ? (
                  <Image source={{ uri: currentJob.companyAvatar }} style={styles.jobModalLogo} />
                ) : (
                  <Ionicons name="business" size={30} color={COLORS.primarySoft} />
                )}
              </View>

              <View style={styles.jobModalHeading}>
                <Text style={styles.jobModalTitle} numberOfLines={2}>{currentJob.title}</Text>
                <Text style={styles.jobModalCompany} numberOfLines={1}>{currentJob.companyName}</Text>
              </View>

              <TouchableOpacity style={styles.jobModalCloseIcon} onPress={() => setJobModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSoft} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.jobModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.jobModalMetaRow}>
                <Ionicons name="location-outline" size={17} color={COLORS.accent} />
                <Text style={styles.jobModalMetaText}>{currentJob.location || 'Lokacija nije navedena'}</Text>
              </View>

              {!!currentJob.job_type && (
                <View style={styles.jobModalMetaRow}>
                  <Ionicons name="time-outline" size={17} color={COLORS.gold} />
                  <Text style={styles.jobModalMetaText}>{currentJob.job_type}</Text>
                </View>
              )}

              {!!currentJob.description && (
                <View style={styles.jobModalSection}>
                  <Text style={styles.jobModalSectionTitle}>Opis posla</Text>
                  <Text style={styles.jobModalDescription}>{currentJob.description}</Text>
                </View>
              )}

              {!!currentJob.skills_required?.length && (
                <View style={styles.jobModalSection}>
                  <Text style={styles.jobModalSectionTitle}>Potrebne vestine</Text>
                  <View style={styles.jobModalSkills}>
                    {currentJob.skills_required.map((skill, index) => (
                      <View key={`${skill}-modal-${index}`} style={styles.jobModalSkill}>
                        <Text style={styles.jobModalSkillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.jobModalActions}>
              <TouchableOpacity style={styles.jobModalSecondaryButton} onPress={() => setJobModalVisible(false)}>
                <Text style={styles.jobModalSecondaryText}>Zatvori</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jobModalPrimaryButton}
                onPress={() => {
                  setJobModalVisible(false);
                  openCompanyProfile();
                }}
              >
                <Text style={styles.jobModalPrimaryText}>Profil firme</Text>
                <Ionicons name="arrow-forward" size={17} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
      {matchOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080D', paddingBottom: 24, alignItems: 'center' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#10131D',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    boxShadow: '0px 22px 48px rgba(0, 0, 0, 0.28)',
    ...Platform.select({
      default: {
        shadowColor: '#0f1226',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
    elevation: 14,
  },
  cardScrollContent: {
    padding: 0,
    paddingBottom: 22,
  },
  mapHero: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  mapScrim: {
    ...StyleSheet.absoluteFill,
  },
  mapHeroFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#162033',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  locationHeroFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121827',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  locationHeroTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    maxWidth: '86%',
    textAlign: 'center',
  },
  locationHeroSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  mapHeroBadge: {
    position: 'absolute',
    left: 18,
    top: 18,
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 12, 20, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapHeroLogo: {
    width: '100%',
    height: '100%',
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#161A28',
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
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 92, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.35)',
  },
  logoFallbackText: {
    color: '#777',
    fontSize: 40,
  },
  profileHint: {
    color: '#F8C45C',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '800',
  },
  companyInfo: {
    flex: 1,
  },
  company: {
    color: '#F7F8FF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  locationText: {
    color: '#A8B0C8',
    fontSize: 13,
    marginTop: 1,
    fontWeight: '700',
  },
  title: { color: '#fff', fontSize: 25, fontWeight: '900', marginBottom: 10, lineHeight: 31 },
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
  meta: {
    color: '#DCE2F5',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  metaPillText: {
    color: '#DCE2F5',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  description: { color: '#DCE2F5', fontSize: 13, lineHeight: 20, marginTop: 4 },
  cardTop: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(8,10,16,0.90)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    boxShadow: '0px 16px 34px rgba(0,0,0,0.34)',
  },
  jobIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  companyLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  companyLabelText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
  jobTypePill: {
    maxWidth: '44%',
    backgroundColor: 'rgba(248,196,92,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248,196,92,0.30)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  jobTypePillText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  cardTouch: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-start',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  skillsSection: {
    marginTop: 8,
  },
  skillsSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tag: {
    backgroundColor: 'rgba(124, 92, 255, 0.16)',
    borderColor: 'rgba(124, 92, 255, 0.36)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '48%',
  },
  tagText: { color: '#E8E3FF', fontWeight: '800', fontSize: 11 },
  moreTag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  moreTagText: { color: '#A8B0C8', fontWeight: '900', fontSize: 12 },
  jobMapCard: {
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    padding: 12,
  },
  hiddenMapCard: {
    display: 'none',
  },
  jobMapLabel: {
    color: '#E8E3FF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  jobMapWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#12121b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobMapWrapperCompact: {
    height: '100%',
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
    height: '100%',
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
    height: 168,
    borderRadius: 14,
    backgroundColor: '#171724',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  jobMapFallbackCompact: {
    height: 128,
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
  discoveryHeader: {
    width: '100%',
    paddingBottom: 14,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(124,92,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  header: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
  },
  subHeader: {
    color: COLORS.textMuted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  countPill: {
    minWidth: 54,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: { color: COLORS.primarySoft, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  actionButton: {
    width: 62,
    height: 62,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#222',
    backgroundColor: 'rgba(255,255,255,0.06)',
    boxShadow: '0px 10px 24px rgba(0, 0, 0, 0.18)',
    marginHorizontal: 10,
    elevation: 10,
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  actionButtonLeft: {
    borderColor: '#ff5a64',
    backgroundColor: 'rgba(255, 59, 71, 0.16)',
    boxShadow: '0px 0px 18px rgba(255, 59, 71, 0.2)',
  },
  actionButtonCenter: {
    borderColor: '#4ddcff',
    backgroundColor: 'rgba(0, 217, 255, 0.16)',
    boxShadow: '0px 0px 18px rgba(0, 217, 255, 0.2)',
  },
  actionButtonRight: {
    borderColor: '#ff6fc7',
    backgroundColor: 'rgba(255, 20, 147, 0.18)',
    boxShadow: '0px 0px 18px rgba(255, 20, 147, 0.22)',
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionsRow: {
    display: 'none',
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  jobModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  jobModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    backgroundColor: '#10131D',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    boxShadow: '0px 24px 54px rgba(0,0,0,0.42)',
  },
  jobModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  jobModalLogoBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(124,92,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  jobModalLogo: {
    width: '100%',
    height: '100%',
  },
  jobModalHeading: {
    flex: 1,
  },
  jobModalTitle: {
    color: COLORS.white,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  jobModalCompany: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  jobModalCloseIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobModalContent: {
    padding: 18,
    gap: 12,
  },
  jobModalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  jobModalMetaText: {
    color: COLORS.textSoft,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  jobModalSection: {
    paddingTop: 8,
    gap: 9,
  },
  jobModalSectionTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },
  jobModalDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  jobModalSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobModalSkill: {
    backgroundColor: 'rgba(124,92,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.34)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  jobModalSkillText: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: '800',
  },
  jobModalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  jobModalSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobModalSecondaryText: {
    color: COLORS.textSoft,
    fontWeight: '900',
  },
  jobModalPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  jobModalPrimaryText: {
    color: COLORS.white,
    fontWeight: '900',
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
    ...Platform.select({
      web: {
        textShadow: '0px 8px 20px rgba(255,255,255,0.22)',
      },
      default: {
        textShadowColor: 'rgba(255,255,255,0.22)',
        textShadowOffset: { width: 0, height: 8 },
        textShadowRadius: 20,
      },
    }),
  },
  matchCard: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 26,
    alignItems: 'center',
    minWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      web: {
        boxShadow: '0px 0px 20px rgba(0, 0, 0, 0.24)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
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
