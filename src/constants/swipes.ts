export const SWIPE_RESET_DAYS = 30;

export const getSwipeResetCutoffIso = () =>
  new Date(Date.now() - SWIPE_RESET_DAYS * 24 * 60 * 60 * 1000).toISOString();
