import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiscoveryFilters, DiscoveryMode } from '../types';
import { defaultDiscoveryFilters } from '../utils/matching';

const key = (userId: string, mode: DiscoveryMode, contextId?: string) =>
  `jobhop:filters:${userId}:${mode}${contextId ? `:${contextId}` : ''}`;
const selectedJobKey = (userId: string) => `jobhop:selected-company-job:${userId}`;

export const discoveryService = {
  async loadFilters(userId: string, mode: DiscoveryMode, contextId?: string): Promise<DiscoveryFilters> {
    const stored = await AsyncStorage.getItem(key(userId, mode, contextId));
    if (!stored) return defaultDiscoveryFilters;
    try {
      return { ...defaultDiscoveryFilters, ...JSON.parse(stored) };
    } catch {
      return defaultDiscoveryFilters;
    }
  },

  async saveFilters(userId: string, mode: DiscoveryMode, filters: DiscoveryFilters, contextId?: string) {
    await AsyncStorage.setItem(key(userId, mode, contextId), JSON.stringify(filters));
  },

  async loadSelectedCompanyJob(userId: string) {
    return AsyncStorage.getItem(selectedJobKey(userId));
  },

  async saveSelectedCompanyJob(userId: string, jobId: string) {
    await AsyncStorage.setItem(selectedJobKey(userId), jobId);
  },
};

