import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { AppNotification } from '../types';

export const notificationService = {
  async fetchAll(userId: string) {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as AppNotification[];
  },

  async fetchUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    return count || 0;
  },

  async markRead(id: string) {
    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllRead(userId: string) {
    const { error } = await supabase
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
  },

  async registerDevice(userId: string) {
    if (Platform.OS === 'web') return null;

    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');
    const Constants = (await import('expo-constants')).default;
    if (!Device.isDevice) return null;

    const current = await Notifications.getPermissionsAsync();
    const permission = current.status === 'granted'
      ? current
      : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'JobSwipe',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const { error } = await supabase.from('device_push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return token;
  },

  async dispatchPending() {
    await supabase.functions.invoke('send-push-notifications');
  },
};
