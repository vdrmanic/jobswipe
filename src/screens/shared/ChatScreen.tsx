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
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function ChatScreen({ route, navigation }: any) {
  const { match } = route.params;
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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



  const openOtherProfile = () => {
    const profileId =
      match.candidate_id === user?.id ? match.company_id : match.candidate_id;

    const userType =
      match.candidate_id === user?.id ? 'company' : 'candidate';

    console.log('OPEN PROFILE:', {
      profileId,
      userType,
      match,
      userId: user?.id,
    });

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
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Nazad</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openOtherProfile} activeOpacity={0.7}>
          <Text style={styles.header}>{match.otherName || 'Chat'}</Text>
          <Text style={styles.profileHint}>Pogledaj profil</Text>
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

      <View style={styles.inputRow}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Pošalji poruku..."
          placeholderTextColor="#777"
          style={styles.input}
        />

        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          <Text style={styles.sendText}>{sending ? '...' : '➤'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileHint: {
    color: '#777',
    marginTop: 3,
    fontSize: 13,
  },
  messages: { padding: 16 },
  message: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C63FF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1c1c1c',
  },
  messageText: { color: '#fff', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopColor: '#222',
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#151515',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#6C63FF',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});