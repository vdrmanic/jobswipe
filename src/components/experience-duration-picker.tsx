import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

const DURATION_OPTIONS = [
  'Do 6 meseci',
  '6-12 meseci',
  '1-2 godine',
  '2-3 godine',
  '3-5 godina',
  '5+ godina',
] as const;

type ExperienceDurationPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ExperienceDurationPicker({ value, onChange }: ExperienceDurationPickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Ionicons name="time-outline" size={17} color={COLORS.primarySoft} />
        <Text style={styles.label}>Trajanje iskustva</Text>
      </View>
      <Text style={styles.hint}>Izaberi opciju koja je najbliza stvarnom trajanju.</Text>

      <View style={styles.options}>
        {DURATION_OPTIONS.map((option) => {
          const selected = value === option;
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.78}
              onPress={() => onChange(option)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
              </View>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  label: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  hint: {
    color: COLORS.lightGray,
    fontSize: 11,
    lineHeight: 16,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  option: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.input,
  },
  optionSelected: {
    borderColor: 'rgba(124,92,255,0.72)',
    backgroundColor: 'rgba(124,92,255,0.18)',
    boxShadow: '0px 8px 20px rgba(124,92,255,0.16)',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  optionText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: COLORS.white,
  },
});
