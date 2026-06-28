import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { JOB_POSITIONS } from '../constants/jobPositions';
import { INPUT_LIMITS } from '../constants/inputLimits';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('sr-Latn')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .trim();

export default function PositionPicker({ value, onChange, placeholder = 'Izaberi poziciju', maxLength = INPUT_LIMITS.position }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = useMemo(() => {
    const search = normalize(query);
    if (!search) return JOB_POSITIONS.slice(0, 8);

    return JOB_POSITIONS
      .filter((position) => normalize(position).includes(search))
      .sort((a, b) => {
        const aStarts = normalize(a).startsWith(search) ? 0 : 1;
        const bStarts = normalize(b).startsWith(search) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, 'sr-Latn');
      })
      .slice(0, 8);
  }, [query]);

  const select = (position: string) => {
    setQuery(position);
    onChange(position);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, open && styles.inputRowActive]}>
        <Ionicons name="search-outline" size={19} color={COLORS.textMuted} />
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
        {!!query && (
          <TouchableOpacity
          accessibilityLabel="Obriši poziciju"
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              onChange('');
              setOpen(true);
            }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.counter}>{query.length}/{maxLength}</Text>

      {open && (
        <View style={styles.suggestions}>
          {suggestions.length ? (
            suggestions.map((position) => (
              <TouchableOpacity key={position} style={styles.suggestion} onPress={() => select(position)}>
                <Ionicons name="briefcase-outline" size={16} color={COLORS.primarySoft} />
                <Text style={styles.suggestionText}>{position}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nema pozicije sa tim nazivom.</Text>
            </View>
          )}
          {!!query && query !== value && (
            <Text style={styles.hint}>Izaberi jednu od ponudjenih pozicija.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 720, marginBottom: 14, zIndex: 5 },
  inputRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputRowActive: { borderColor: COLORS.primary },
  input: { flex: 1, color: COLORS.white, fontSize: 16, paddingVertical: 14 },
  counter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'right', marginTop: 5 },
  clearButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  suggestions: {
    marginTop: 6,
    backgroundColor: '#12131b',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: { color: COLORS.white, fontSize: 14, fontWeight: '700', flex: 1 },
  empty: { padding: 15 },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  hint: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '700', padding: 10 },
});

