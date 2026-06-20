import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
        `Zdravo! Hvala na matchu. Mozete li mi reci vise o poziciji ${jobTitle}?`,
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
    }

    setSending(false);
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
          <Text style={styles.profileHint}>Pogledaj profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton} onPress={() => setSafetyVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

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
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Posalji poruku..."
          placeholderTextColor={COLORS.lightGray}
          style={styles.input}
        />

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
    flex: 1,
    backgroundColor: COLORS.input,
    color: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginRight: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
