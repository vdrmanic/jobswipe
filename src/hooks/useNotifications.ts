import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return setUnread(0);
    setUnread(await notificationService.fetchUnreadCount(user.id).catch(() => 0));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    refresh();
    notificationService.registerDevice(user.id).catch(() => null);
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  return { unread, refresh };
}

