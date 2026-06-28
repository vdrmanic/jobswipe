import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import PositionPicker from '../../components/PositionPicker';
import { JobListing } from '../../types';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { CREDIT_DURATION_OPTIONS, CreditDuration, creditService } from '../../services';

interface PlaceSuggestion {
  display_name: string;
  shortDisplay: string;
  osm_id: string;
  lat: string;
  lon: string;
}

interface SelectedPlace {
  address: string;
  shortAddress: string;
  lat: number;
  lng: number;
}

const formatShortAddress = (address: string) => {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(', ');
};

const skillCategories = [
  {
    key: 'it',
    label: 'IT & razvoj',
    skills: ['JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'Python', 'AWS', 'SQL', 'DevOps'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    skills: ['SEO', 'Google Ads', 'Facebook Ads', 'Copywriting', 'Content marketing', 'Email marketing', 'Analitika'],
  },
  {
    key: 'sales',
    label: 'Prodaja',
    skills: ['B2B prodaja', 'Cold calling', 'CRM', 'Pregovaranje', 'Lead generation', 'Prezentacije'],
  },
  {
    key: 'usluge',
    label: 'Usluge',
    skills: ['Rad s ljudima', 'Služenje pića', 'Organizacija', 'Hotelski servis', 'Kuhinja', 'Recepcija'],
  },
  {
    key: 'other',
    label: 'Ostalo',
    skills: ['Komunikacija', 'Timwork', 'Vođenje projekata', 'Administracija', 'Logistika'],
  },
];

const workModes = ['Na lokaciji', 'Hibridno', 'Remote'];
const seniorityLevels = ['Junior', 'Medior', 'Senior'];

export default function CreateJobScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const editingJob = route?.params?.job as JobListing | undefined;
  const isEditing = !!editingJob?.id;

  const [title, setTitle] = useState(editingJob?.title || '');
  const [location, setLocation] = useState(editingJob?.location || '');
  const [jobType, setJobType] = useState(editingJob?.job_type || '');
  const [selectedCategory, setSelectedCategory] = useState(skillCategories[0].key);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(editingJob?.skills_required || []);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [description, setDescription] = useState(editingJob?.description || '');
  const [salaryMin, setSalaryMin] = useState(editingJob?.salary_min?.toString() || '');
  const [salaryMax, setSalaryMax] = useState(editingJob?.salary_max?.toString() || '');
  const [workMode, setWorkMode] = useState(editingJob?.work_mode || '');
  const [seniority, setSeniority] = useState(editingJob?.seniority || '');
  const [schedule, setSchedule] = useState(editingJob?.schedule || '');
  const [benefits, setBenefits] = useState((editingJob?.benefits || []).join(', '));
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [publishCreditsVisible, setPublishCreditsVisible] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [draftReady, setDraftReady] = useState(isEditing);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [mapImageError, setMapImageError] = useState(false);
  const [mapProviderIndex, setMapProviderIndex] = useState(0);
  const [mapPreviewLayout, setMapPreviewLayout] = useState({ width: 0, height: 0 });
  const pinAnimation = useRef(new Animated.Value(0)).current;

  const draftKey = user ? `jobhop:job-draft:${user.id}` : null;
  const lockedPaidFields = !!editingJob?.expires_at && new Date(editingJob.expires_at).getTime() > Date.now();

  useEffect(() => {
    if (!user) return;
    creditService.getBalance().then(setCreditBalance).catch(() => setCreditBalance(0));
  }, [user?.id]);

  useEffect(() => {
    if (isEditing || !draftKey) return;
    AsyncStorage.getItem(draftKey).then((stored) => {
      if (stored) {
        const draft = JSON.parse(stored);
        setTitle(draft.title || '');
        setLocation(draft.location || '');
        setJobType(draft.jobType || '');
        setSelectedSkills(draft.selectedSkills || []);
        setDescription(draft.description || '');
        setSalaryMin(draft.salaryMin || '');
        setSalaryMax(draft.salaryMax || '');
        setWorkMode(draft.workMode || '');
        setSeniority(draft.seniority || '');
        setSchedule(draft.schedule || '');
        setBenefits(draft.benefits || '');
      }
      setDraftReady(true);
    }).catch(() => setDraftReady(true));
  }, [draftKey, isEditing]);

  useEffect(() => {
    if (isEditing || !draftKey || !draftReady) return;
    const handler = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify({ title, location, jobType, selectedSkills, description, salaryMin, salaryMax, workMode, seniority, schedule, benefits })).catch(() => null);
    }, 500);
    return () => clearTimeout(handler);
  }, [benefits, description, draftKey, draftReady, isEditing, jobType, location, salaryMax, salaryMin, schedule, selectedSkills, seniority, title, workMode]);

  const saveJob = async (asDraft = false, credits?: CreditDuration) => {
    if (!user) return;

    if (!asDraft && (!title.trim() || !location.trim())) {
      Alert.alert('Greška', 'Unesi naziv pozicije i lokaciju.');
      return;
    }

    const shouldActivateWithCredits = !asDraft && !!credits && (!isEditing || editingJob?.is_draft || !editingJob?.is_active);

    if (!asDraft && (!isEditing || editingJob?.is_draft || !editingJob?.is_active) && !credits) {
      setPublishCreditsVisible(true);
      return;
    }

    setLoading(true);

    const jobData = {
      company_id: user.id,
      title: title.trim(),
      location: location.trim(),
      job_type: jobType.trim() || null,
      skills_required: selectedSkills.length > 0 ? selectedSkills : null,
      description: description.trim() || null,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      salary_currency: 'EUR',
      work_mode: workMode || null,
      seniority: seniority || null,
      schedule: schedule.trim() || null,
      benefits: benefits.split(',').map((item) => item.trim()).filter(Boolean),
      is_draft: asDraft,
    };

    const { data: savedJob, error } = isEditing
      ? await supabase
          .from('job_listings')
          .update({
            ...jobData,
            ...(asDraft ? { is_active: false, status: 'paused' } : {}),
            ...(shouldActivateWithCredits ? { is_active: false, status: 'paused', published_at: null } : {}),
          })
          .eq('id', editingJob.id)
          .eq('company_id', user.id)
          .select('*')
          .single()
      : await supabase.from('job_listings').insert({
          ...jobData,
          is_active: false,
          status: 'paused',
          published_at: null,
        }).select('*').single();

    if (error) {
      setLoading(false);
      Alert.alert('Greška', error.message);
      return;
    }

    if (shouldActivateWithCredits && savedJob?.id && credits) {
      try {
        await creditService.activateJob(savedJob.id, credits);
      } catch (error: any) {
        setLoading(false);
        Alert.alert('Oglas je sačuvan, ali nije aktiviran', error?.message || 'Dodaj kredite pa aktiviraj oglas iz ekrana Moji oglasi.');
        navigation.goBack();
        return;
      }
    }

    setLoading(false);
    if (draftKey) await AsyncStorage.removeItem(draftKey).catch(() => null);
    setPreviewVisible(false);
    setPublishCreditsVisible(false);
    Alert.alert('Uspeh', asDraft ? 'Nacrt je sačuvan.' : shouldActivateWithCredits ? 'Oglas je objavljen i aktiviran!' : 'Izmene su sačuvane!');
    navigation.goBack();
  };

  const fetchPlaceSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPlaceSuggestions([]);
      setSuggestionsError(null);
      return;
    }

    if (Platform.OS === 'web') {
      setPlaceSuggestions([]);
      setSelectedPlace(null);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&countrycodes=rs&accept-language=sr-Latn&q=${encodeURIComponent(
          query
        )}`,
        {
          headers: {
            'Accept-Language': 'sr-Latn',
          },
        }
      );
      if (!response.ok) {
        setPlaceSuggestions([]);
        setSuggestionsError(null);
        return;
      }
      const data = await response.json();

      if (Array.isArray(data)) {
        setPlaceSuggestions(
          data.map((result: any) => ({
            display_name: result.display_name,
            shortDisplay: formatShortAddress(result.display_name),
            osm_id: result.osm_id?.toString() || `${result.place_id}`,
            lat: result.lat,
            lon: result.lon,
          }))
        );
      } else {
        setPlaceSuggestions([]);
        setSuggestionsError('Nemoguće pronaći adrese.');
      }
    } catch (error) {
      setPlaceSuggestions([]);
      setSuggestionsError('Greška pri učitavanju adresa.');
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!location.trim() || location.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    const handler = setTimeout(() => {
      fetchPlaceSuggestions(location.trim());
    }, 400);

    return () => clearTimeout(handler);
  }, [location, fetchPlaceSuggestions]);

  const fetchPlaceDetails = async (place: PlaceSuggestion) => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setMapImageError(false);
    setMapProviderIndex(0);

    try {
      setLocation(place.shortDisplay);
      setSelectedPlace({
        address: place.display_name,
        shortAddress: place.shortDisplay,
        lat: Number(place.lat),
        lng: Number(place.lon),
      });
      setPlaceSuggestions([]);
    } catch (error) {
      setSuggestionsError('Greška pri postavljanju lokacije.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPlace) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(pinAnimation, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pinAnimation, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [selectedPlace, pinAnimation]);

  const openInOpenStreetMap = () => {
    if (!selectedPlace) return;
    const url = `https://www.openstreetmap.org/?mlat=${selectedPlace.lat}&mlon=${selectedPlace.lng}#map=16/${selectedPlace.lat}/${selectedPlace.lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Greška', 'Ne mogu otvoriti OpenStreetMap link.');
    });
  };

  const TILE_ZOOM = 16;
  const TILE_SIZE = 256;
  const TILE_GRID_SIZE = 3;
  const tileSubdomains = ['a', 'b', 'c'];

  const tileProviders = [
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.fr/osmfr/${TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.fr/hot/${TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.de/tiles/osmde/${TILE_ZOOM}/${x}/${y}.png`;
    },
    (x: number, y: number) => {
      const subdomain = tileSubdomains[(x + y) % tileSubdomains.length];
      return `https://${subdomain}.tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`;
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

  const getTileUrl = (x: number, y: number) =>
    tileProviders[mapProviderIndex](x, y);

  const handleMapError = () => {
    if (mapProviderIndex < tileProviders.length - 1) {
      setMapProviderIndex((index) => index + 1);
    } else {
      setMapImageError(true);
    }
  };

  const renderStaticMap = (lat: number, lng: number) => {
    const x = lonToTileX(lng, TILE_ZOOM);
    const y = latToTileY(lat, TILE_ZOOM);
    const centerTileX = Math.floor(x);
    const centerTileY = Math.floor(y);
    const halfGrid = Math.floor(TILE_GRID_SIZE / 2);
    const leftTile = centerTileX - halfGrid;
    const topTile = centerTileY - halfGrid;
    const gridWidth = TILE_GRID_SIZE * TILE_SIZE;
    const gridHeight = TILE_GRID_SIZE * TILE_SIZE;
    const centerPixelX = (x - leftTile) * TILE_SIZE;
    const centerPixelY = (y - topTile) * TILE_SIZE;
    const translateX = mapPreviewLayout.width
      ? -(centerPixelX - mapPreviewLayout.width / 2)
      : 0;
    const translateY = mapPreviewLayout.height
      ? -(centerPixelY - mapPreviewLayout.height / 2)
      : 0;

    const bounce = pinAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    });

    const tiles = [];
    for (let row = 0; row < TILE_GRID_SIZE; row += 1) {
      for (let col = 0; col < TILE_GRID_SIZE; col += 1) {
        const tileX = leftTile + col;
        const tileY = topTile + row;
        tiles.push(
          <Image
            key={`${tileX}-${tileY}`}
            source={{ uri: getTileUrl(tileX, tileY) }}
            style={[
              styles.mapTile,
              {
                left: col * TILE_SIZE,
                top: row * TILE_SIZE,
              },
            ]}
            resizeMode="cover"
            onError={handleMapError}
          />
        );
      }
    }

    return (
      <View
        style={styles.mapPreviewImageWrapper}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (
            width !== mapPreviewLayout.width ||
            height !== mapPreviewLayout.height
          ) {
            setMapPreviewLayout({ width, height });
          }
        }}
      >
        {mapPreviewLayout.width > 0 && mapPreviewLayout.height > 0 ? (
          <View
            style={[
              styles.mapTileGrid,
              {
                width: gridWidth,
                height: gridHeight,
                transform: [
                  { translateX },
                  { translateY },
                ],
              },
            ]}
          >
            {tiles}
          </View>
        ) : null}
        <Animated.View
          style={[
            styles.mapMarker,
            { transform: [{ translateY: bounce }] },
          ]}
        >
          <View style={styles.mapMarkerDot} />
          <View style={styles.mapMarkerTail} />
        </Animated.View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Nazad">
          <Ionicons name="arrow-back" size={21} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.modePill}>
          <Ionicons name={isEditing ? 'create-outline' : 'add-circle-outline'} size={15} color="#a9b3ff" />
          <Text style={styles.modePillText}>{isEditing ? 'IZMENA OGLASA' : 'NOVI OGLAS'}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={['#7068ff', '#5148db']} style={styles.heroIcon}>
          <Ionicons name="briefcase" size={27} color="#ffffff" />
        </LinearGradient>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{isEditing ? 'Uredi svoj oglas' : 'Kreiraj novi oglas'}</Text>
          <Text style={styles.subtitle}>
            {isEditing ? 'Ažuriraj informacije koje kandidati vide.' : 'Predstavi poziciju pravim kandidatima.'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Ionicons name="cash-outline" size={19} color="#9da7ff" /></View>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Uslovi i način rada</Text>
            <Text style={styles.sectionSubtitle}>Detalji koji kandidatu pomažu da odluči</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>NAČIN RADA</Text>
        <View style={styles.optionRow}>
          {workModes.map((option) => (
            <TouchableOpacity key={option} style={[styles.optionChip, workMode === option && styles.optionChipActive]} onPress={() => setWorkMode(option)}>
              <Text style={[styles.optionText, workMode === option && styles.optionTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>SENIORITET</Text>
        <View style={styles.optionRow}>
          {seniorityLevels.map((option) => (
            <TouchableOpacity key={option} style={[styles.optionChip, seniority === option && styles.optionChipActive]} onPress={() => setSeniority(option)}>
              <Text style={[styles.optionText, seniority === option && styles.optionTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>MESEČNA PLATA (EUR)</Text>
        <View style={styles.salaryRow}>
          <TextInput style={[styles.inputRow, styles.salaryInput]} placeholder="Od" placeholderTextColor="#74798d" value={salaryMin} onChangeText={(value) => setSalaryMin(value.replace(/\D/g, ''))} maxLength={INPUT_LIMITS.salary} keyboardType="number-pad" />
          <Text style={styles.salaryDash}>—</Text>
          <TextInput style={[styles.inputRow, styles.salaryInput]} placeholder="Do" placeholderTextColor="#74798d" value={salaryMax} onChangeText={(value) => setSalaryMax(value.replace(/\D/g, ''))} maxLength={INPUT_LIMITS.salary} keyboardType="number-pad" />
        </View>
        <Text style={styles.charCounter}>{Math.max(salaryMin.length, salaryMax.length)}/{INPUT_LIMITS.salary}</Text>
        <Text style={styles.fieldLabel}>RASPORED</Text>
        <View style={styles.inputRow}>
          <Ionicons name="calendar-outline" size={18} color="#74798d" />
          <TextInput
            style={styles.inputText}
            placeholder="npr. Puno radno vreme, smene..."
            placeholderTextColor="#74798d"
            value={schedule}
            onChangeText={setSchedule}
            maxLength={INPUT_LIMITS.schedule}
          />
        </View>
        <Text style={styles.charCounter}>{schedule.length}/{INPUT_LIMITS.schedule}</Text>

        <Text style={styles.fieldLabel}>BENEFITI</Text>
        <View style={styles.inputRow}>
          <Ionicons name="gift-outline" size={18} color="#74798d" />
          <TextInput
            style={styles.inputText}
            placeholder="Privatno osiguranje, bonusi..."
            placeholderTextColor="#74798d"
            value={benefits}
            onChangeText={setBenefits}
            maxLength={INPUT_LIMITS.benefits}
          />
        </View>
        <Text style={styles.charCounter}>{benefits.length}/{INPUT_LIMITS.benefits}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Ionicons name="document-text-outline" size={19} color="#9da7ff" /></View>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Osnovni podaci</Text>
            <Text style={styles.sectionSubtitle}>Pozicija, lokacija i tip angažovanja</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>NAZIV POZICIJE</Text>
        {lockedPaidFields ? (
          <View style={styles.lockedField}>
            <Ionicons name="lock-closed-outline" size={17} color="#a9b3ff" />
            <Text style={styles.lockedFieldText}>{title || 'Pozicija nije navedena'}</Text>
          </View>
        ) : (
          <PositionPicker placeholder="Izaberi poziciju *" value={title} onChange={setTitle} maxLength={INPUT_LIMITS.jobTitle} />
        )}
        <Text style={styles.fieldLabel}>LOKACIJA</Text>
        {lockedPaidFields ? (
          <>
            <View style={styles.lockedField}>
              <Ionicons name="lock-closed-outline" size={17} color="#a9b3ff" />
              <Text style={styles.lockedFieldText}>{location || 'Lokacija nije navedena'}</Text>
            </View>
            <Text style={styles.lockedHint}>Pozicija i lokacija su zaključane dok traje plaćeni period oglasa.</Text>
          </>
        ) : (
          <>
            <View style={styles.inputRow}>
              <Ionicons name="location-outline" size={18} color="#74798d" />
              <TextInput
                style={styles.inputText}
                placeholder="Unesi adresu ili grad *"
                placeholderTextColor="#74798d"
                value={location}
                onChangeText={(value) => {
                  setLocation(value);
                  setSelectedPlace(null);
                }}
                maxLength={INPUT_LIMITS.location}
              />
            </View>
            <Text style={styles.charCounter}>{location.length}/{INPUT_LIMITS.location}</Text>
          </>
        )}

        {!lockedPaidFields && suggestionsLoading && <Text style={styles.suggestionStatus}>Učitavanje predloga...</Text>}
        {!lockedPaidFields && !!suggestionsError && <Text style={styles.errorText}>{suggestionsError}</Text>}

        {!lockedPaidFields && placeSuggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {placeSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={`${suggestion.osm_id}-${suggestion.lat}-${suggestion.lon}`}
                style={styles.suggestionItem}
                onPress={() => fetchPlaceDetails(suggestion)}
              >
                <Ionicons name="navigate-outline" size={17} color="#9da7ff" />
                <Text style={styles.suggestionText}>{suggestion.shortDisplay}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!lockedPaidFields && selectedPlace ? (
          <View style={styles.mapPreviewCard}>
            <Text style={styles.mapPreviewLabel}>IZABRANA LOKACIJA</Text>
            {!mapImageError ? (
              renderStaticMap(selectedPlace.lat, selectedPlace.lng)
            ) : (
              <View style={styles.mapPreviewFallback}>
                <Text style={styles.mapPreviewFallbackText}>Mapa trenutno nije dostupna.</Text>
                <TouchableOpacity style={styles.mapPreviewButton} onPress={openInOpenStreetMap}>
                  <Text style={styles.mapPreviewButtonText}>Otvori u OSM</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.mapPreviewAddress}>{selectedPlace.shortAddress}</Text>
          </View>
        ) : null}
        <Text style={styles.fieldLabel}>TIP ANGAZOVANJA</Text>
        <View style={styles.inputRow}>
          <Ionicons name="time-outline" size={18} color="#74798d" />
          <TextInput
            style={styles.inputText}
            placeholder="Puno radno vreme, praksa..."
            placeholderTextColor="#74798d"
            value={jobType}
            onChangeText={setJobType}
            maxLength={INPUT_LIMITS.jobType}
          />
        </View>
        <Text style={styles.charCounter}>{jobType.length}/{INPUT_LIMITS.jobType}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Ionicons name="sparkles-outline" size={19} color="#9da7ff" /></View>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Potrebne veštine</Text>
            <Text style={styles.sectionSubtitle}>Pomažu nam da pronađemo najbolja poklapanja</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.skillPickerButton} onPress={() => setSkillModalVisible(true)}>
          <View style={styles.skillPickerCopy}>
            <Text style={styles.skillPickerTitle}>{selectedSkills.length ? `${selectedSkills.length} odabrano` : 'Dodaj veštine'}</Text>
            <Text style={styles.skillPickerSubtitle} numberOfLines={2}>
              {selectedSkills.length > 0 ? selectedSkills.join(' • ') : 'Izaberi relevantne veštine iz liste'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8993d6" />
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="fade" visible={skillModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeader}>Izaberi veštine</Text>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.categoryRow}>
                {skillCategories.map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.key && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(category.key)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === category.key && styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.skillsRowModal}>
                {skillCategories
                  .find((category) => category.key === selectedCategory)
                  ?.skills.map((skill) => {
                    const selected = selectedSkills.includes(skill);
                    return (
                      <TouchableOpacity
                        key={skill}
                        style={[styles.skillChip, selected && styles.skillChipSelected]}
                        onPress={() => {
                          setSelectedSkills((prev) =>
                            prev.includes(skill)
                              ? prev.filter((item) => item !== skill)
                              : [...prev, skill]
                          );
                        }}
                      >
                        <Text style={[styles.skillText, selected && styles.skillTextSelected]}>{skill}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSkillModalVisible(false)}>
                <Text style={styles.modalCloseText}>Zatvori</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Ionicons name="reader-outline" size={19} color="#9da7ff" /></View>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Opis posla</Text>
            <Text style={styles.sectionSubtitle}>Ukratko predstavi ulogu i očekivanja</Text>
          </View>
        </View>
        <TextInput
          style={styles.textArea}
          placeholder="Napiši šta kandidat može da očekuje..."
          placeholderTextColor="#74798d"
          value={description}
          onChangeText={setDescription}
          maxLength={INPUT_LIMITS.jobDescription}
          multiline
        />
        <Text style={styles.charCounter}>{description.length}/{INPUT_LIMITS.jobDescription}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => setPreviewVisible(true)} disabled={loading}>
        <LinearGradient colors={['#746cff', '#5850df']} style={styles.buttonGradient}>
          <Ionicons name="eye-outline" size={21} color="#fff" />
          <Text style={styles.buttonText}>Pregledaj oglas</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.draftButton} onPress={() => saveJob(true)} disabled={loading}>
        {loading ? <ActivityIndicator color="#a9b3ff" /> : <Ionicons name="bookmark-outline" size={19} color="#a9b3ff" />}
        {!loading && <Text style={styles.draftButtonText}>Sačuvaj kao nacrt</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Odustani</Text>
      </TouchableOpacity>

      <Modal transparent animationType="slide" visible={previewVisible} onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View><Text style={styles.previewEyebrow}>PREGLED PRE OBJAVE</Text><Text style={styles.previewTitle}>{title || 'Naziv pozicije'}</Text></View>
              <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.previewContent}>
              <Text style={styles.previewCompany}>Kako će kandidat videti oglas</Text>
              <View style={styles.previewMetaRow}>
                {!!location && <Text style={styles.previewMeta}>📍 {location}</Text>}
                {!!workMode && <Text style={styles.previewMeta}>⌂ {workMode}</Text>}
                {!!seniority && <Text style={styles.previewMeta}>✦ {seniority}</Text>}
              </View>
              {(salaryMin || salaryMax) && <Text style={styles.previewSalary}>{salaryMin || '0'}–{salaryMax || '∞'} EUR mesečno</Text>}
              {!!description && <Text style={styles.previewDescription}>{description}</Text>}
              {!!selectedSkills.length && <View style={styles.previewSkills}>{selectedSkills.map((skill) => <View key={skill} style={styles.previewSkill}><Text style={styles.previewSkillText}>{skill}</Text></View>)}</View>}
              {!!benefits.trim() && <Text style={styles.previewBenefits}>Benefiti: {benefits}</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.button} onPress={() => saveJob(false)} disabled={loading}>
              <LinearGradient colors={['#746cff', '#5850df']} style={styles.buttonGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={21} color="#fff" />}
                {!loading && <Text style={styles.buttonText}>{isEditing ? 'Sačuvaj izmene' : 'Objavi oglas'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={publishCreditsVisible} onRequestClose={() => setPublishCreditsVisible(false)}>
        <View style={styles.creditOverlay}>
          <View style={styles.creditModal}>
            <View style={styles.creditHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.creditKicker}>KREDITI ZA OGLAS</Text>
                <Text style={styles.creditTitle}>Koliko dugo da oglas bude aktivan?</Text>
              </View>
              <TouchableOpacity style={styles.creditClose} onPress={() => setPublishCreditsVisible(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.creditCopy}>Dostupno: {creditBalance} kredita. Kandidati ne plaćaju ništa.</Text>
            {CREDIT_DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.credits}
                style={styles.creditOption}
                disabled={loading}
                onPress={() => saveJob(false, option.credits)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.creditOptionTitle}>{option.label}</Text>
                  <Text style={styles.creditOptionText}>{option.description}</Text>
                </View>
                <Text style={styles.creditOptionPrice}>{option.credits} kredit{option.credits === 1 ? '' : 'a'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090d' },
  inner: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 16,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141722',
    borderWidth: 1,
    borderColor: '#262b3c',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(137,147,214,0.24)',
  },
  modePillText: { color: '#a9b3ff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 8 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 14px 28px rgba(92,82,230,0.28)',
  },
  heroCopy: { flex: 1 },
  title: { color: '#fff', fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#9ba3bd', fontSize: 14, lineHeight: 20, marginTop: 4 },
  sectionCard: {
    backgroundColor: '#10131c',
    borderWidth: 1,
    borderColor: '#202536',
    borderRadius: 24,
    padding: 18,
    gap: 10,
    boxShadow: '0px 18px 42px rgba(0,0,0,0.18)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,99,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(137,147,214,0.22)',
  },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { color: '#f7f8ff', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#858ea9', fontSize: 12, lineHeight: 17, marginTop: 2 },
  fieldLabel: { color: '#818aa7', fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  charCounter: { color: '#74798d', fontSize: 11, fontWeight: '800', textAlign: 'right', marginTop: -2 },
  inputRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#171a25',
    borderColor: '#292e40',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  inputText: { flex: 1, color: '#ffffff', fontSize: 15, paddingVertical: 14 },
  lockedField: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(124,92,255,0.10)',
    borderColor: 'rgba(169,179,255,0.30)',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  lockedFieldText: { flex: 1, color: '#e8eaff', fontSize: 15, fontWeight: '800' },
  lockedHint: { color: '#9ba3bd', fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  optionChip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: '#171a25', borderWidth: 1, borderColor: '#2b3044' },
  optionChipActive: { backgroundColor: '#29255b', borderColor: '#7770f4' },
  optionText: { color: '#8e96ae', fontSize: 12, fontWeight: '800' },
  optionTextActive: { color: '#c7cbff' },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  salaryInput: { flex: 1, color: '#fff', fontSize: 15, paddingHorizontal: 14 },
  salaryDash: { color: '#68708a', fontSize: 18 },
  suggestionStatus: {
    color: '#999',
    marginBottom: 10,
    fontSize: 13,
  },
  errorText: {
    color: '#f87171',
    marginBottom: 10,
    fontSize: 13,
  },
  suggestionsList: {
    backgroundColor: '#151824',
    borderColor: '#2b3043',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomColor: '#272737',
    borderBottomWidth: 1,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  mapPreviewCard: {
    backgroundColor: '#151824',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292f43',
    padding: 14,
    marginBottom: 14,
  },
  mapPreviewLabel: {
    color: '#a8b2ff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mapPreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
  },
  mapPreviewFallback: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    backgroundColor: '#171724',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  mapPreviewFallbackText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  mapPreviewButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  mapPreviewButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  mapPreviewAddress: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  mapPreviewImageWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#12121b',
    marginBottom: 10,
    width: '100%',
    height: 220,
  },
  mapTileGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#12121b',
  },
  mapTile: {
    position: 'absolute',
    width: 256,
    height: 256,
    backgroundColor: '#12121b',
  },
  mapMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 24,
    height: 34,
    justifyContent: 'flex-end',
    alignItems: 'center',
    transform: [{ translateX: -12 }, { translateY: -34 }],
  },
  mapMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 10,
    backgroundColor: '#ff4d4d',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapMarkerTail: {
    width: 4,
    height: 10,
    backgroundColor: '#ff4d4d',
    borderRadius: 2,
    marginTop: -1,
  },
  mapPreviewDetails: {
    marginTop: 10,
  },
  mapPreviewDetailItem: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 4,
  },
  skillPickerButton: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#171a25',
    borderWidth: 1,
    borderColor: '#2b3044',
    borderRadius: 16,
    padding: 16,
  },
  skillPickerCopy: { flex: 1 },
  skillPickerTitle: {
    color: '#c3c9ff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  skillPickerSubtitle: {
    color: '#8e96ae',
    fontSize: 12,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3,4,8,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '80%',
    borderRadius: 24,
    backgroundColor: '#10131c',
    borderWidth: 1,
    borderColor: '#2b3043',
    overflow: 'hidden',
  },
  modalHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    padding: 20,
    borderBottomColor: '#23283a',
    borderBottomWidth: 1,
  },
  modalContent: {
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#30364a',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#171a25',
  },
  categoryButtonActive: {
    borderColor: '#8179ff',
    backgroundColor: '#282457',
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 13,
  },
  categoryButtonTextActive: {
    color: '#b6bcff',
    fontWeight: '700',
  },
  skillsRowModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#30364a',
    backgroundColor: '#171a25',
    marginBottom: 10,
    marginRight: 8,
  },
  skillChipSelected: {
    borderColor: '#8179ff',
    backgroundColor: '#282457',
  },
  skillText: {
    color: '#fff',
    fontSize: 13,
  },
  skillTextSelected: {
    color: '#c1c6ff',
    fontWeight: '700',
  },
  modalFooter: {
    padding: 16,
    borderTopColor: '#25253a',
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  modalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#665df0',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: '#171a25',
    borderWidth: 1,
    borderColor: '#2b3044',
    borderRadius: 16,
    padding: 15,
  },
  button: {
    borderRadius: 17,
    overflow: 'hidden',
    boxShadow: '0px 16px 34px rgba(91,81,225,0.26)',
  },
  buttonGradient: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 20,
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  draftButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: '#151824', borderWidth: 1, borderColor: '#2b3150' },
  draftButtonText: { color: '#a9b3ff', fontWeight: '900', fontSize: 14 },
  backButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: '#858da5', fontWeight: '800', fontSize: 14 },
  previewOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,4,8,0.82)' },
  previewCard: { width: '100%', maxWidth: 760, maxHeight: '88%', alignSelf: 'center', padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#10131c', borderWidth: 1, borderColor: '#2b3043', gap: 14 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  previewEyebrow: { color: '#9da7ff', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  previewTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 3 },
  previewClose: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1e2a' },
  previewContent: { gap: 14, paddingVertical: 4 },
  previewCompany: { color: '#858ea9', fontSize: 12, fontWeight: '800' },
  previewMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewMeta: { color: '#c7ccdc', fontSize: 12, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#171a25' },
  previewSalary: { color: '#65e6a7', fontSize: 18, fontWeight: '900' },
  previewDescription: { color: '#d9dce7', fontSize: 14, lineHeight: 22 },
  previewSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  previewSkill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#29255b', borderWidth: 1, borderColor: '#7770f4' },
  previewSkillText: { color: '#c7cbff', fontSize: 11, fontWeight: '800' },
  previewBenefits: { color: '#f8c45c', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  creditOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(3,4,8,0.78)' },
  creditModal: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 18, borderRadius: 28, backgroundColor: '#101421', borderWidth: 1, borderColor: '#2f3764', gap: 13 },
  creditHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  creditKicker: { color: '#a9b3ff', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  creditTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4, lineHeight: 28 },
  creditClose: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  creditCopy: { color: '#cbd2ee', lineHeight: 20 },
  creditOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#171c33', borderWidth: 1, borderColor: '#2b3564' },
  creditOptionTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  creditOptionText: { color: '#aab3d2', marginTop: 4, lineHeight: 18 },
  creditOptionPrice: { color: '#c4b5fd', fontWeight: '900' },
});
