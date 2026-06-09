import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CandidateSwipeScreen from '../screens/candidate/CandidateSwipeScreen';
import CompanyJobsScreen from '../screens/company/CompanyJobsScreen';
import CompanySwipeScreen from '../screens/company/CompanySwipeScreen';
import CreateJobScreen from '../screens/company/CreateJobScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import MatchesScreen from '../screens/shared/MatchesScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ViewProfileScreen from '../screens/shared/ViewProfileScreen';

import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../hooks/useAuth';

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
    </Stack.Navigator>
  );
}

export default function MainTabs() {
  const { profile } = useAuth();
  const isCompany = profile?.user_type === 'company';
  const unreadCount = useUnreadMessages();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopColor: '#222',
          height: 64,
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#777',
      }}
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