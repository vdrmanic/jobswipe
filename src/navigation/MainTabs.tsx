import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import CandidateSwipeScreen from '../screens/candidate/CandidateSwipeScreen';
import CompanyJobsScreen from '../screens/company/CompanyJobsScreen';
import CompanySwipeScreen from '../screens/company/CompanySwipeScreen';
import CreateJobScreen from '../screens/company/CreateJobScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import MatchesScreen from '../screens/shared/MatchesScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ViewProfileScreen from '../screens/shared/ViewProfileScreen';
import ExperienceVerificationScreen from '../screens/shared/ExperienceVerificationScreen';
import VerificationAdminScreen from '../screens/admin/VerificationAdminScreen';

import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function CompanyJobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyJobs" component={CompanyJobsScreen} />
      <Stack.Screen name="CreateJob" component={CreateJobScreen} />
    </Stack.Navigator>
  );
}

function MatchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MatchesMain" component={MatchesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </Stack.Navigator>
  );
}
function SwipeStack() {
  const { profile } = useAuth();
  const isCompany = profile?.user_type === 'company';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="SwipeMain"
        component={isCompany ? CompanySwipeScreen : CandidateSwipeScreen}
      />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ExperienceVerification" component={ExperienceVerificationScreen} />
      <Stack.Screen name="VerificationAdmin" component={VerificationAdminScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabs() {
  const { profile } = useAuth();
  const isCompany = profile?.user_type === 'company';
  const unreadCount = useUnreadMessages();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const focusedRoute = getFocusedRouteNameFromRoute(route);
        const hideTabBar = ['Chat', 'ExperienceVerification', 'VerificationAdmin'].includes(focusedRoute || '');

        return {
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          height: 72,
          borderRadius: 28,
          backgroundColor: 'rgba(16, 19, 29, 0.96)',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 18 : 10,
          boxShadow: '0px 18px 38px rgba(0, 0, 0, 0.34)',
          elevation: 18,
        },
        tabBarItemStyle: {
          borderRadius: 22,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarActiveTintColor: COLORS.white,
        tabBarInactiveTintColor: COLORS.lightGray,
        tabBarBadgeStyle: {
          backgroundColor: COLORS.secondary,
          color: COLORS.white,
          fontWeight: '900',
        },
        tabBarIcon: ({ color, focused, size }) => {
          const iconSize = focused ? size + 3 : size + 1;
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Swipe: isCompany ? 'people' : 'briefcase',
            Jobs: 'albums',
            Matches: 'chatbubbles',
            Profile: 'person-circle',
          };

          return (
            <Ionicons
              name={focused ? icons[route.name] : (`${icons[route.name]}-outline` as keyof typeof Ionicons.glyphMap)}
              size={iconSize}
              color={focused ? COLORS.primarySoft : color}
            />
          );
        },
      }}}
    >
        <Tab.Screen
        name="Swipe"
        component={SwipeStack}
        options={{ tabBarLabel: isCompany ? 'Kandidati' : 'Poslovi' }}
        />

      {isCompany && (
        <Tab.Screen
          name="Jobs"
          component={CompanyJobsStack}
          options={{ tabBarLabel: 'Oglasi' }}
        />
      )}

      <Tab.Screen
        name="Matches"
        component={MatchesStack}
        options={{
          tabBarLabel: 'Mečevi',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          popToTopOnBlur: true,
        } as any}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
}
