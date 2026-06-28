type TabRoute = 'Swipe' | 'Jobs' | 'Matches' | 'Profile';

const tabHandlers = new Map<TabRoute, () => void>();
let pausedForFilter = false;
let pausedForProfile = false;
let profileTutorialRequested = false;
const profileTutorialListeners = new Set<() => void>();

export function registerTutorialTab(route: TabRoute, handler: () => void) {
  tabHandlers.set(route, handler);
  return () => {
    if (tabHandlers.get(route) === handler) tabHandlers.delete(route);
  };
}

export function openTutorialTab(route: TabRoute) {
  tabHandlers.get(route)?.();
}

export function setTutorialPausedForFilter(paused: boolean) {
  pausedForFilter = paused;
}

export function isTutorialPausedForFilter() {
  return pausedForFilter;
}

export function setTutorialPausedForProfile(paused: boolean) {
  pausedForProfile = paused;
}

export function requestProfileTutorial() {
  pausedForProfile = true;
  profileTutorialRequested = true;
  profileTutorialListeners.forEach((listener) => listener());
}

export function subscribeProfileTutorial(listener: () => void) {
  profileTutorialListeners.add(listener);
  if (profileTutorialRequested) setTimeout(listener, 0);
  return () => {
    profileTutorialListeners.delete(listener);
  };
}

export function completeProfileTutorial() {
  profileTutorialRequested = false;
  pausedForProfile = false;
}

export function continueProfileTutorialInEditor() {
  profileTutorialRequested = false;
  pausedForProfile = true;
}

export function isTutorialFlowPaused() {
  return pausedForFilter || pausedForProfile;
}
