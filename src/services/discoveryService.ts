import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiscoveryFilters, DiscoveryMode } from '../types';
import { defaultDiscoveryFilters } from '../utils/matching';

const key = (userId: string, mode: DiscoveryMode) => `jobswipe:filters:${userId}:${mode}`;

export const discoveryService = {
  async loadFilters(userId: string, mode: DiscoveryMode): Promise<DiscoveryFilters> {
    const stored = await AsyncStorage.getItem(key(userId, mode));
    if (!stored) return defaultDiscoveryFilters;
    try {
      return { ...defaultDiscoveryFilters, ...JSON.parse(stored) };
    } catch {
      return defaultDiscoveryFilters;
    }
  },

  async saveFilters(userId: string, mode: DiscoveryMode, filters: DiscoveryFilters) {
    await AsyncStorage.setItem(key(userId, mode), JSON.stringify(filters));
  },
};

