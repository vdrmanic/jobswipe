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
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import PositionPicker from '../../components/PositionPicker';

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

export default function CreateJobScreen({ navigation }: any) {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(skillCategories[0].key);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [mapImageError, setMapImageError] = useState(false);
  const [mapProviderIndex, setMapProviderIndex] = useState(0);
  const [mapPreviewLayout, setMapPreviewLayout] = useState({ width: 0, height: 0 });
  const pinAnimation = useRef(new Animated.Value(0)).current;

  const createJob = async () => {
    if (!user) return;

    if (!title.trim() || !location.trim()) {
      Alert.alert('Greška', 'Unesi naziv pozicije i lokaciju');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('job_listings').insert({
      company_id: user.id,
      title: title.trim(),
      location: location.trim(),
      job_type: jobType.trim() || null,
      skills_required: selectedSkills.length > 0 ? selectedSkills : null,
      description: description.trim() || null,
      is_active: true,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    Alert.alert('Uspeh', 'Oglas je kreiran!');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Novi oglas 💼</Text>
      <Text style={styles.subtitle}>Dodaj posao koji će kandidati moći da swajpuju.</Text>

      <PositionPicker
        placeholder="Naziv pozicije *"
        value={title}
        onChange={setTitle}
      />

      <TextInput
        style={styles.input}
        placeholder="Lokacija *"
        placeholderTextColor="#999"
        value={location}
        onChangeText={(text) => {
          setLocation(text);
          setSelectedPlace(null);
        }}
      />

      {suggestionsLoading && <Text style={styles.suggestionStatus}>Učitavanje predloga...</Text>}
      {!!suggestionsError && <Text style={styles.errorText}>{suggestionsError}</Text>}

      {placeSuggestions.length > 0 && (
        <View style={styles.suggestionsList}>
          {placeSuggestions.map((suggestion) => (
            <TouchableOpacity
              key={`${suggestion.osm_id}-${suggestion.lat}-${suggestion.lon}`}
              style={styles.suggestionItem}
              onPress={() => fetchPlaceDetails(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion.shortDisplay}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedPlace ? (
        <View style={styles.mapPreviewCard}>
          <Text style={styles.mapPreviewLabel}>Lokacija</Text>
          {!mapImageError ? (
            renderStaticMap(selectedPlace.lat, selectedPlace.lng)
          ) : (
            <View style={styles.mapPreviewFallback}>
              <Text style={styles.mapPreviewFallbackText}>
                Mapa nije dostupna u ovom okruženju. Otvori lokaciju u OpenStreetMap-u.
              </Text>
              <TouchableOpacity style={styles.mapPreviewButton} onPress={openInOpenStreetMap}>
                <Text style={styles.mapPreviewButtonText}>Otvori u OSM</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.mapPreviewAddress}>{selectedPlace.shortAddress}</Text>
          <View style={styles.mapPreviewDetails}>
            <Text style={styles.mapPreviewDetailItem}>Ulica: {selectedPlace.address.split(',')[0]?.trim()}</Text>
            <Text style={styles.mapPreviewDetailItem}>Opština: {selectedPlace.address.split(',')[1]?.trim() || '-'}</Text>
            <Text style={styles.mapPreviewDetailItem}>Grad: {selectedPlace.address.split(',')[2]?.trim() || '-'}</Text>
          </View>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Tip posla, npr. full-time, part-time"
        placeholderTextColor="#999"
        value={jobType}
        onChangeText={setJobType}
      />

      <Text style={styles.sectionTitle}>Potrebne veštine</Text>
      <Text style={styles.sectionSubtitle}>Odaberi veštine iz ponuđene liste.</Text>

      <TouchableOpacity style={styles.skillPickerButton} onPress={() => setSkillModalVisible(true)}>
        <Text style={styles.skillPickerTitle}>Odabrane veštine</Text>
        <Text style={styles.skillPickerSubtitle}>
          {selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Dodaj veštine iz liste'}
        </Text>
      </TouchableOpacity>

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

      <Text style={styles.helpText}>
        {selectedSkills.length > 0
          ? `Odabrane veštine: ${selectedSkills.join(', ')}`
          : 'Izaberi veštine koje želiš da vidiš u oglasu.'}
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Opis posla"
        placeholderTextColor="#999"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={createJob} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kreiraj oglas</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Nazad</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 28 },
  input: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
    borderWidth: 1,
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
  },
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
    backgroundColor: '#12121b',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomColor: '#272737',
    borderBottomWidth: 1,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 15,
  },
  mapPreviewCard: {
    backgroundColor: '#10101a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25253a',
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
    height: 300,
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
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: '#999',
    fontSize: 13,
    marginBottom: 12,
  },
  skillPickerButton: {
    backgroundColor: '#12121b',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  skillPickerTitle: {
    color: '#a8b2ff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  skillPickerSubtitle: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  helpText: {
    color: '#999',
    fontSize: 13,
    marginBottom: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 18,
    backgroundColor: '#10101a',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  modalHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    padding: 18,
    borderBottomColor: '#25253a',
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
    borderColor: '#333',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#12121b',
  },
  categoryButtonActive: {
    borderColor: '#6C63FF',
    backgroundColor: '#1f1c48',
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 13,
  },
  categoryButtonTextActive: {
    color: '#6C63FF',
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
    borderColor: '#333',
    backgroundColor: '#12121b',
    marginBottom: 10,
    marginRight: 8,
  },
  skillChipSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#1f1c48',
  },
  skillText: {
    color: '#fff',
    fontSize: 13,
  },
  skillTextSelected: {
    color: '#6C63FF',
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
    backgroundColor: '#6C63FF',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  textArea: { minHeight: 130, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backButton: { padding: 16, alignItems: 'center', marginTop: 8 },
  backButtonText: { color: '#888', fontWeight: 'bold' },
});
