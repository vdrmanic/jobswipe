import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CopilotProvider, CopilotStep, walkthroughable } from 'react-native-copilot';

import CandidateSwipeScreen from '../screens/candidate/CandidateSwipeScreen';
import CompanyJobsScreen from '../screens/company/CompanyJobsScreen';
import CompanySwipeScreen from '../screens/company/CompanySwipeScreen';
import CreateJobScreen from '../screens/company/CreateJobScreen';
import CreditStoreScreen from '../screens/company/CreditStoreScreen';
import JobDashboardScreen from '../screens/company/JobDashboardScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import MatchesScreen from '../screens/shared/MatchesScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ViewProfileScreen from '../screens/shared/ViewProfileScreen';
import ExperienceVerificationScreen from '../screens/shared/ExperienceVerificationScreen';
import VerificationAdminScreen from '../screens/admin/VerificationAdminScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import ReportsAdminScreen from '../screens/admin/ReportsAdminScreen';

import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants';
import FirstLoginTutorial, { JobHopTutorialTooltip } from '../components/first-login-tutorial';
import { registerTutorialTab } from '../utils/tutorial-flow';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const CopilotView = walkthroughable(View);
const EmptyStepNumber = () => null;

function TutorialTabButton({ routeName, userType, children, style, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }: any) {
  useEffect(() => registerTutorialTab(routeName, onPress), [onPress, routeName]);

  const configs: Record<string, { order: number; name: string; text: string }> = userType === 'company'
    ? {
        Jobs: { order: 3, name: 'korak-Oglasi i analitika', text: 'Ovde kreiraš novi oglas, menjaš postojeće i pratiš rezultate svakog oglasa posebno. Prvo objavi oglas, pa ćeš za njega videti kandidate, analitiku i status u procesu zapošljavanja.' },
        Swipe: { order: 4, name: 'korak-Kandidati za oglas', text: 'Kada objaviš oglas, u ovom tabu biraš za koji oglas tražiš radnika, vidiš procenat poklapanja i prevlačiš desno ako ti kandidat odgovara ili levo ako ga preskačeš.' },
        Matches: { order: 5, name: 'korak-Mečevi i razgovori', text: 'Kada i kandidat i firma pokažu interesovanje za isti oglas, ovde nastaje meč. Odavde otvaraš razgovor, dogovaraš intervju i vodiš komunikaciju.' },
        Profile: { order: 6, name: 'korak-Profil firme', text: 'Ovde je javni profil firme. Ikonica olovke otvara uređivanje naziva, opisa, lokacije, industrije i fotografije firme. Sada ćemo otvoriti taj deo.' },
      }
    : {
        Matches: { order: 2, name: 'korak-Tvoji mečevi', text: 'Meč nastaje tek kada i ti i firma pokažete interesovanje. Ovde vidiš sve mečeve, otvaraš razgovor sa firmom i pratiš dogovor oko narednih koraka.' },
        Profile: { order: 4, name: 'korak-Tvoj profil', text: 'Dodaj veštine, iskustvo, lokaciju i kratak opis. Što je profil potpuniji, procenat poklapanja je precizniji i firme lakše vide zašto im odgovaraš.' },
      };
  const config = configs[routeName];
  const button = (
    <CopilotView collapsable={false} style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
      >
        {children}
      </Pressable>
    </CopilotView>
  );

  return config ? <CopilotStep {...config}>{button}</CopilotStep> : button;
}

function CompanyJobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyJobs" component={CompanyJobsScreen} />
      <Stack.Screen name="CreditStore" component={CreditStoreScreen} />
      <Stack.Screen name="CreateJob" component={CreateJobScreen} />
      <Stack.Screen name="JobDashboard" component={JobDashboardScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
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
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ReportsAdmin" component={ReportsAdminScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabs() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isCompany = profile?.user_type === 'company';
  const unreadCount = useUnreadMessages();

  return (
    <CopilotProvider
      overlay="view"
      animated={false}
      backdropColor="rgba(3,4,9,0.88)"
      margin={8}
      tooltipComponent={JobHopTutorialTooltip}
      tooltipStyle={{
        backgroundColor: 'transparent',
        paddingTop: 0,
        paddingHorizontal: 0,
        left: 16,
        right: 16,
        maxWidth: Math.max(width - 32, 240),
      }}
      stepNumberComponent={EmptyStepNumber}
      arrowColor="#121622"
      labels={{ next: 'Nastavi', skip: 'Preskoči', finish: 'Završi' }}
    >
      <Tab.Navigator
      screenOptions={({ route }) => {
        const focusedRoute = getFocusedRouteNameFromRoute(route);
        const hideTabBar = ['Chat', 'ViewProfile', 'CreateJob', 'CreditStore', 'JobDashboard', 'ExperienceVerification', 'VerificationAdmin', 'Notifications', 'ReportsAdmin'].includes(focusedRoute || '');

        return {
        headerShown: false,
        tabBarButton: (props) => <TutorialTabButton {...props} routeName={route.name} userType={profile?.user_type} />,
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
      {!!profile?.id && <FirstLoginTutorial userId={profile.id} userType={profile.user_type} />}
    </CopilotProvider>
  );
}
