import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useUnreadMessages() {
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    if (!user || !profile) {
      setUnreadCount(0);
      return;
    }

    const column = profile.user_type === 'candidate' ? 'candidate_id' : 'company_id';

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq(column, user.id);

    if (matchesError) {
      console.log('UNREAD MATCHES ERROR:', matchesError);
      setUnreadCount(0);
      return;
    }

    const matchIds = matches?.map((m) => m.id) || [];

    if (matchIds.length === 0) {
      setUnreadCount(0);
      return;
    }

    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('match_id', matchIds)
      .neq('sender_id', user.id)
      .eq('read', false);

    if (countError) {
      console.log('UNREAD COUNT ERROR:', countError);
      setUnreadCount(0);
      return;
    }

    setUnreadCount(count || 0);
  };

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
    }, [user?.id, profile?.user_type])
  );

  useEffect(() => {
    if (!user || !profile) return;

    fetchUnread();

    const interval = setInterval(() => {
      fetchUnread();
    }, 2000);

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.user_type]);

  return unreadCount;
}