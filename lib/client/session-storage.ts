const legacyAuthTokenStorageKey = "taka-fintrack.auth-token-fallback";
const authTokenStorageKey = "taka-fintrack.auth-token-session-fallback";

export const authStorageKey = "taka-fintrack.auth-user";

export function clearStoredAuthTokenFallback() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(legacyAuthTokenStorageKey);
    window.sessionStorage.removeItem(authTokenStorageKey);
  } catch {
    // Ignore private browsing/storage restrictions.
  }
}
