import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { safetyService, verificationService } from '../../services';
import { UserReport } from '../../types';
import { COLORS } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';

export default function ReportsAdminScreen({ navigation }: any) {
  const { user } = useAuth();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const admin = await verificationService.isAdmin(user.id);
    setAuthorized(admin);
    if (admin) setReports(await safetyService.fetchReports('pending').catch(() => []));
    setLoading(false);
  }, [user?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const review = async (id: string, status: 'dismissed' | 'actioned') => {
    try { await safetyService.reviewReport(id, status, note); setNote(''); load(); }
    catch (error: any) { Alert.alert('Greška', error?.message || 'Odluka nije sačuvana.'); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primarySoft} /></View>;
  if (!authorized) return <View style={styles.center}><Text style={styles.empty}>Admin pristup je potreban.</Text></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={22} color={COLORS.primarySoft} /></TouchableOpacity>
        <View><Text style={styles.eyebrow}>JOBHOP ADMIN</Text><Text style={styles.title}>Prijave korisnika</Text></View>
      </View>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nema prijava na čekanju.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}><Ionicons name="warning" size={20} color={COLORS.secondary} /><Text style={styles.reason}>{item.reason}</Text></View>
            <Text style={styles.meta}>Prijavio: {item.reporter?.full_name || item.reporter_id}</Text>
            <Text style={styles.meta}>Prijavljen: {item.reported_user?.full_name || item.reported_user_id}</Text>
            {!!item.details && <Text style={styles.details}>{item.details}</Text>}
            <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Admin napomena" placeholderTextColor={COLORS.lightGray} maxLength={INPUT_LIMITS.adminNote} />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.dismiss} onPress={() => review(item.id, 'dismissed')}><Text style={styles.dismissText}>Odbaci</Text></TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => review(item.id, 'actioned')}><Text style={styles.actionText}>Preduzeta mera</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark }, center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' }, title: { color: COLORS.white, fontSize: 26, fontWeight: '900' }, list: { padding: 18 },
  card: { padding: 16, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reason: { color: COLORS.white, fontWeight: '900', fontSize: 16 }, meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 7 }, details: { color: COLORS.textSoft, lineHeight: 19, marginTop: 10 },
  input: { minHeight: 46, borderRadius: 13, backgroundColor: COLORS.input, color: COLORS.white, paddingHorizontal: 12, marginTop: 13 }, actions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  dismiss: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' }, dismissText: { color: COLORS.textSoft, fontWeight: '900' },
  action: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' }, actionText: { color: COLORS.white, fontWeight: '900' }, empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 80 },
});

