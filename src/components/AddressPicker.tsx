import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { INPUT_LIMITS } from '../constants/inputLimits';

type AddressSuggestion = {
  id: string;
  label: string;
  fullAddress: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  minSearchLength?: number;
};

const formatShortAddress = (address: string) => {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 4).join(', ');
};

export default function AddressPicker({
  value,
  onChange,
  placeholder = 'Unesi bar 3 slova adrese',
  maxLength = INPUT_LIMITS.location,
  minSearchLength = 3,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const readyForSearch = useMemo(() => query.trim().length >= minSearchLength, [minSearchLength, query]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open || !readyForSearch) {
      setSuggestions([]);
      setError('');
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=6&countrycodes=rs&accept-language=sr-Latn&q=${encodeURIComponent(query.trim())}`,
          { headers: { 'Accept-Language': 'sr-Latn' } }
        );

        if (!response.ok) throw new Error('Adrese trenutno nisu dostupne.');
        const data = await response.json();
        if (!active) return;

        setSuggestions(
          Array.isArray(data)
            ? data.map((item: any) => ({
                id: String(item.place_id || item.osm_id || item.display_name),
                label: formatShortAddress(String(item.display_name || '')),
                fullAddress: String(item.display_name || ''),
              }))
            : []
        );
      } catch (fetchError: any) {
        if (active) {
          setSuggestions([]);
          setError(fetchError?.message || 'Ne mogu da učitam adrese.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [open, query, readyForSearch]);

  const select = (suggestion: AddressSuggestion) => {
    setQuery(suggestion.label);
    onChange(suggestion.label);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, open && styles.inputRowActive]}>
        <Ionicons name="location-outline" size={19} color={COLORS.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.lightGray}
          value={query}
          onFocus={() => setOpen(true)}
          onChangeText={(text) => {
            setQuery(text);
            onChange('');
            setOpen(true);
          }}
          maxLength={maxLength}
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primarySoft} />
        ) : !!query ? (
          <TouchableOpacity
          accessibilityLabel="Obriši lokaciju"
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              onChange('');
              setOpen(true);
            }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.counter}>{query.length}/{maxLength}</Text>

      {open && (
        <View style={styles.suggestions}>
          {!readyForSearch ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Unesi najmanje {minSearchLength} slova pa izaberi adresu.</Text>
            </View>
          ) : suggestions.length ? (
            suggestions.map((suggestion) => (
              <TouchableOpacity key={suggestion.id} style={styles.suggestion} onPress={() => select(suggestion)}>
                <Ionicons name="navigate-outline" size={16} color={COLORS.primarySoft} />
                <Text style={styles.suggestionText} numberOfLines={2}>{suggestion.label}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
        <Text style={styles.emptyText}>{error || (loading ? 'Tražim adrese...' : 'Nema rezultata za tu adresu.')}</Text>
            </View>
          )}
          {!!query && query !== value && <Text style={styles.hint}>Izaberi jednu od ponudjenih adresa zbog racunanja udaljenosti od posla.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 14, zIndex: 8 },
  inputRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
  },
  inputRowActive: { borderColor: COLORS.primary },
  input: { flex: 1, color: COLORS.white, fontSize: 15, paddingVertical: 14 },
  counter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'right', marginTop: 5 },
  clearButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  suggestions: {
    marginTop: 7,
    backgroundColor: '#12131b',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: { color: COLORS.white, fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  empty: { padding: 15 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  hint: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '700', padding: 10 },
});
