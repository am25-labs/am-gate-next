const TOKEN_STORAGE_KEY = "gate_tokens";
const VERIFIER_STORAGE_KEY = "gate_pkce_verifier";

/**
 * Guarda los tokens en sessionStorage
 */
export function saveTokens(tokens) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Obtiene los tokens de sessionStorage
 */
export function getTokens() {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Elimina los tokens de sessionStorage
 */
export function clearTokens() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Guarda el code_verifier temporalmente
 */
export function saveVerifier(verifier) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
}

/**
 * Obtiene y elimina el code_verifier
 */
export function consumeVerifier() {
  if (typeof window === "undefined") return null;
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
  return verifier;
}

/**
 * Verifica si el access_token ha expirado
 */
export function isTokenExpired(tokens) {
  if (!tokens?.access_token) return true;

  try {
    const payload = JSON.parse(atob(tokens.access_token.split(".")[1]));
    const exp = payload.exp * 1000;
    return Date.now() >= exp - 60000; // 1 minuto de margen
  } catch {
    return true;
  }
}

/**
 * Decodifica el payload del token
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}
