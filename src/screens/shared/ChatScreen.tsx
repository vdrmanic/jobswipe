import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import ReportUserModal from '../../components/ReportUserModal';
import { notificationService } from '../../services';
import { INPUT_LIMITS } from '../../constants/inputLimits';

export default function ChatScreen({ route, navigation }: any) {
  const { match } = route.params;
  const { user, profile } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [interviewVisible, setInterviewVisible] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const otherUserId = match.candidate_id === user?.id ? match.company_id : match.candidate_id;
  const jobTitle = match.jobTitle || match.job_listings?.title || 'ovu poziciju';
  const otherName = match.otherName || 'zdravo';
  const firstMessageSuggestions = profile?.user_type === 'company'
    ? [
        `Zdravo ${otherName}! Hvala na interesovanju za poziciju ${jobTitle}. Da li vam odgovara kratak razgovor?`,
        `Pozdrav! Vaš profil nam je privukao pažnju. Kada ste dostupni za razgovor o poziciji ${jobTitle}?`,
        `Zdravo! Voleli bismo da saznamo više o vašem iskustvu. Da li možemo da dogovorimo kratak poziv?`,
      ]
    : [
    `Zdravo! Hvala na meču. Možete li mi reći više o poziciji ${jobTitle}?`,
        `Pozdrav! Kada bi vam odgovarao kratak razgovor o poziciji ${jobTitle}?`,
        'Zdravo! Koji su sledeći koraci u procesu selekcije?',
      ];

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: true });

    setMessages(data || []);

    if (user) {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('match_id', match.id)
        .neq('sender_id', user.id)
        .eq('read', false);
    }

    setLoading(false);
  };

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  useEffect(() => {
    if (isFocused) {
      loadMessages();
    }
  }, [isFocused]);

  const openOtherProfile = () => {
    const profileId = match.candidate_id === user?.id ? match.company_id : match.candidate_id;
    const userType = match.candidate_id === user?.id ? 'company' : 'candidate';

    navigation.navigate('ViewProfile', {
      profileId,
      userType,
    });
  };

  const sendMessage = async () => {
    if (!message.trim() || !user) return;
    if (message.trim().length > INPUT_LIMITS.message) {
      Alert.alert('Poruka je preduga', `Maksimalno ${INPUT_LIMITS.message} karaktera.`);
      return;
    }

    setSending(true);

    const { error } = await supabase.from('messages').insert({
      match_id: match.id,
      sender_id: user.id,
      content: message.trim(),
    });

    if (!error) {
      setMessage('');
      loadMessages();
      notificationService.dispatchPending().catch(() => null);
    } else {
      Alert.alert('Poruka nije poslata', error.message);
    }

    setSending(false);
  };

  const scheduleInterview = async () => {
    if (!user || profile?.user_type !== 'company') return;
    const parsedDate = new Date(interviewDate.trim().replace(' ', 'T'));
    if (!interviewDate.trim() || Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Neispravan termin', 'Unesi datum u formatu 2026-06-25 14:00.');
      return;
    }

    setScheduling(true);
    const { error } = await supabase.from('matches').update({
      pipeline_stage: 'interview',
      interview_at: parsedDate.toISOString(),
      interview_location: interviewLocation.trim() || null,
      interview_note: interviewNote.trim() || null,
    }).eq('id', match.id);

    if (!error) {
      const readable = parsedDate.toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
      await supabase.from('messages').insert({
        match_id: match.id,
        sender_id: user.id,
        content: `📅 Predlog intervjua: ${readable}${interviewLocation.trim() ? ` • ${interviewLocation.trim()}` : ''}${interviewNote.trim() ? `\n${interviewNote.trim()}` : ''}`,
      });
      match.interview_at = parsedDate.toISOString();
      match.interview_location = interviewLocation.trim() || null;
      match.pipeline_stage = 'interview';
      setInterviewVisible(false);
      loadMessages();
      notificationService.dispatchPending().catch(() => null);
    } else {
      Alert.alert('Greška', error.message);
    }
    setScheduling(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={[COLORS.dark, '#111827', COLORS.dark]} style={StyleSheet.absoluteFill} />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primarySoft} />
        </TouchableOpacity>

        <TouchableOpacity onPress={openOtherProfile} activeOpacity={0.75} style={styles.headerTitleWrap}>
          <Text style={styles.header} numberOfLines={1}>{match.otherName || 'Chat'}</Text>
          <Text style={styles.profileHint} numberOfLines={1}>{jobTitle} · Pogledaj profil</Text>
        </TouchableOpacity>
        {profile?.user_type === 'company' && (
          <TouchableOpacity style={styles.moreButton} onPress={() => setInterviewVisible(true)}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.primarySoft} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.moreButton} onPress={() => setSafetyVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {!!match.interview_at && (
        <View style={styles.interviewBanner}>
          <Ionicons name="calendar" size={18} color={COLORS.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.interviewBannerTitle}>Intervju zakazan</Text>
            <Text style={styles.interviewBannerText}>{new Date(match.interview_at).toLocaleString('sr-RS')}{match.interview_location ? ` • ${match.interview_location}` : ''}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;

          return (
            <View style={[styles.message, mine ? styles.myMessage : styles.otherMessage]}>
              <Text style={styles.messageText}>{item.content}</Text>
            </View>
          );
        }}
      />

      {messages.length === 0 && (
        <View style={styles.suggestionsPanel}>
          <View style={styles.suggestionsHeader}>
            <View style={styles.suggestionsIcon}>
              <Ionicons name="sparkles" size={17} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionsTitle}>Predlog prve poruke</Text>
              <Text style={styles.suggestionsHint}>Izaberi predlog, izmeni ga ako želiš i pošalji.</Text>
            </View>
          </View>
          <View style={styles.suggestionsList}>
            {firstMessageSuggestions.map((suggestion) => (
              <TouchableOpacity key={suggestion} style={styles.suggestion} onPress={() => setMessage(suggestion)}>
                <Text style={styles.suggestionText} numberOfLines={2}>{suggestion}</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primarySoft} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.messageInputWrap}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Pošalji poruku..."
            placeholderTextColor={COLORS.lightGray}
            style={styles.input}
            maxLength={INPUT_LIMITS.message}
          />
          <Text style={styles.messageCounter}>{message.length}/{INPUT_LIMITS.message}</Text>
        </View>

        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
      {!!user && (
        <ReportUserModal
          visible={safetyVisible}
          currentUserId={user.id}
          reportedUserId={otherUserId}
          matchId={match.id}
          onClose={() => setSafetyVisible(false)}
          onBlocked={() => navigation.goBack()}
        />
      )}
      <Modal transparent animationType="fade" visible={interviewVisible} onRequestClose={() => setInterviewVisible(false)}>
        <View style={styles.interviewOverlay}>
          <View style={styles.interviewCard}>
            <View style={styles.interviewModalHeader}>
              <View><Text style={styles.interviewEyebrow}>SLEDEĆI KORAK</Text><Text style={styles.interviewTitle}>Zakaži intervju</Text></View>
              <TouchableOpacity style={styles.interviewClose} onPress={() => setInterviewVisible(false)}><Ionicons name="close" size={21} color={COLORS.white} /></TouchableOpacity>
            </View>
            <Text style={styles.interviewLabel}>DATUM I VREME</Text>
            <TextInput style={styles.interviewInput} placeholder="2026-06-25 14:00" placeholderTextColor={COLORS.textMuted} value={interviewDate} onChangeText={setInterviewDate} maxLength={INPUT_LIMITS.interviewDate} />
            <Text style={styles.interviewLabel}>LOKACIJA ILI LINK</Text>
            <TextInput style={styles.interviewInput} placeholder="Kancelarija ili video link" placeholderTextColor={COLORS.textMuted} value={interviewLocation} onChangeText={setInterviewLocation} maxLength={INPUT_LIMITS.interviewLocation} />
            <Text style={styles.interviewLabel}>NAPOMENA</Text>
            <TextInput style={[styles.interviewInput, styles.interviewNote]} placeholder="Šta kandidat treba da pripremi?" placeholderTextColor={COLORS.textMuted} value={interviewNote} onChangeText={setInterviewNote} maxLength={INPUT_LIMITS.interviewNote} multiline />
            <Text style={styles.charCounter}>{interviewNote.length}/{INPUT_LIMITS.interviewNote}</Text>
            <TouchableOpacity style={styles.interviewSubmit} onPress={scheduleInterview} disabled={scheduling}>
              {scheduling ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="calendar" size={19} color={COLORS.white} /><Text style={styles.interviewSubmitText}>Pošalji termin</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  center: {
    flex: 1,
    backgroundColor: COLORS.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(16, 19, 29, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  moreButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  header: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  profileHint: {
    color: COLORS.textMuted,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },
  interviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 10, padding: 12, borderRadius: 15, backgroundColor: 'rgba(248,196,92,0.10)', borderWidth: 1, borderColor: 'rgba(248,196,92,0.24)' },
  interviewBannerTitle: { color: COLORS.gold, fontSize: 12, fontWeight: '900' },
  interviewBannerText: { color: COLORS.textSoft, fontSize: 11, marginTop: 2 },
  messages: { padding: 18, paddingBottom: 16 },
  message: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    marginBottom: 10,
    maxWidth: '78%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 8,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardRaised,
    borderBottomLeftRadius: 8,
  },
  messageText: { color: COLORS.white, fontSize: 15, lineHeight: 22 },
  suggestionsPanel: { marginHorizontal: 14, marginBottom: 10, padding: 13, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  suggestionsIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,196,92,0.12)' },
  suggestionsTitle: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  suggestionsHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  suggestionsList: { gap: 7 },
  suggestion: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  suggestionText: { color: COLORS.textSoft, flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    backgroundColor: 'rgba(7, 8, 13, 0.96)',
  },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginRight: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageInputWrap: { flex: 1, marginRight: 12 },
  messageCounter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'right', marginTop: 4, marginRight: 4 },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interviewOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(3,4,8,0.82)' },
  interviewCard: { width: '100%', maxWidth: 480, padding: 20, gap: 10, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  interviewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  interviewEyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  interviewTitle: { color: COLORS.white, fontSize: 23, fontWeight: '900', marginTop: 3 },
  interviewClose: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  interviewLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 4 },
  interviewInput: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14, color: COLORS.white, backgroundColor: COLORS.input, borderWidth: 1, borderColor: COLORS.border },
  interviewNote: { minHeight: 84, paddingTop: 13, textAlignVertical: 'top' },
  charCounter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'right', marginTop: -4 },
  interviewSubmit: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: COLORS.primary, marginTop: 8 },
  interviewSubmitText: { color: COLORS.white, fontWeight: '900' },
});
