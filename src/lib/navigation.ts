import { router } from 'expo-router';

/**
 * `router.back()` throws "GO_BACK was not handled" when there is no screen
 * to return to — e.g. a web page opened or refreshed directly at
 * /flight-lookup. Fall back to the home tab in that case.
 */
export function goBackOrHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
