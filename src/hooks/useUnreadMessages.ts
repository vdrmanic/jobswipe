import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { messageService } from '../services';

export function useUnreadMessages() {
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user || !profile) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await messageService.fetchUnreadCount(user.id, profile.user_type);
      setUnreadCount(count);
    } catch (error) {
      console.log('UNREAD COUNT ERROR:', error);
      setUnreadCount(0);
    }
  }, [user?.id, profile?.user_type]);

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
    }, [fetchUnread])
  );

  useEffect(() => {
    if (!user || !profile) return;

    fetchUnread();

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
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.user_type, fetchUnread]);

  return unreadCount;
}