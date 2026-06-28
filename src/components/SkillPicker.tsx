import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { SKILL_CATEGORIES } from '../constants/skills';

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
};

export default function SkillPicker({
  value,
  onChange,
  label = 'Veštine',
  placeholder = 'Izaberi veštine iz liste',
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(SKILL_CATEGORIES[0].key);

  const currentSkills = useMemo(
    () => SKILL_CATEGORIES.find((category) => category.key === activeCategory)?.skills || [],
    [activeCategory]
  );

  const toggleSkill = (skill: string) => {
    onChange(value.includes(skill) ? value.filter((item) => item !== skill) : [...value, skill]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.trigger, open && styles.triggerActive]} activeOpacity={0.82} onPress={() => setOpen((prev) => !prev)}>
        <View style={styles.triggerIcon}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.primarySoft} />
        </View>
        <View style={styles.triggerCopy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.placeholder} numberOfLines={2}>
            {value.length ? value.join(', ') : placeholder}
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{value.length}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
      </TouchableOpacity>

      {value.length > 0 && (
        <View style={styles.selectedRow}>
          {value.map((skill) => (
            <TouchableOpacity key={skill} style={styles.selectedChip} onPress={() => toggleSkill(skill)}>
              <Text style={styles.selectedChipText}>{skill}</Text>
              <Ionicons name="close" size={13} color={COLORS.white} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {open && (
        <View style={styles.menu}>
          <View style={styles.categoryRow}>
            {SKILL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.key}
                style={[styles.categoryChip, activeCategory === category.key && styles.categoryChipActive]}
                onPress={() => setActiveCategory(category.key)}
              >
                <Text style={[styles.categoryText, activeCategory === category.key && styles.categoryTextActive]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.skillsRow}>
            {currentSkills.map((skill) => {
              const selected = value.includes(skill);
              return (
                <TouchableOpacity key={skill} style={[styles.skillChip, selected && styles.skillChipActive]} onPress={() => toggleSkill(skill)}>
                  <Text style={[styles.skillText, selected && styles.skillTextActive]}>{skill}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => setOpen(false)}>
            <Text style={styles.doneText}>Gotovo</Text>
            <Ionicons name="checkmark" size={17} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 14 },
  trigger: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.input,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  triggerActive: { borderColor: COLORS.primary },
  triggerIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.16)',
  },
  triggerCopy: { flex: 1 },
  label: { color: COLORS.textSoft, fontSize: 11, fontWeight: '900', marginBottom: 4 },
  placeholder: { color: COLORS.white, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  countPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countText: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '900' },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  selectedChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  selectedChipText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  menu: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: '#12131b',
    padding: 12,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.glass,
  },
  categoryChipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(124,92,255,0.22)' },
  categoryText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  categoryTextActive: { color: COLORS.white },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.glass,
  },
  skillChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  skillText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  skillTextActive: { color: COLORS.white },
  doneButton: {
    minHeight: 44,
    marginTop: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  doneText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
});
