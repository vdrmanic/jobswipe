import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { AppNotification } from '../../types';
import { notificationService } from '../../services';
import { COLORS } from '../../constants';

const icons: Record<AppNotification['type'], keyof typeof Ionicons.glyphMap> = {
  match: 'heart', message: 'chatbubble', verification: 'shield-checkmark', system: 'notifications',
};

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await notificationService.fetchAll(user.id).catch(() => []));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primarySoft} /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={22} color={COLORS.primarySoft} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>AKTIVNOST</Text><Text style={styles.title}>Notifikacije</Text></View>
        <TouchableOpacity onPress={async () => { if (user) await notificationService.markAllRead(user.id); load(); }}><Text style={styles.readAll}>Procitaj sve</Text></TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Još nema notifikacija.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.read_at && styles.unread]}
            onPress={async () => {
              if (!item.read_at) await notificationService.markRead(item.id);
              if (item.data?.match_id || item.data?.job_id) navigation.getParent()?.navigate('Matches');
              load();
            }}
          >
            <View style={styles.itemIcon}><Ionicons name={icons[item.type]} size={20} color={COLORS.primarySoft} /></View>
            <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text></View>
            {!item.read_at && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark }, center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  eyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' }, title: { color: COLORS.white, fontSize: 27, fontWeight: '900' },
  readAll: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '900' }, list: { padding: 18, paddingBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: 17, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  unread: { borderColor: 'rgba(124,92,255,0.5)', backgroundColor: 'rgba(124,92,255,0.12)' }, itemIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  itemTitle: { color: COLORS.white, fontSize: 14, fontWeight: '900' }, body: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }, date: { color: COLORS.lightGray, fontSize: 10, marginTop: 7 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.secondary, marginTop: 4 }, empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 80 },
});

