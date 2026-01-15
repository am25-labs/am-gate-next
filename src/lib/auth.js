/**
 * Genera la URL de login para redirigir a Gate
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate
 * @param {string} options.clientId - Client ID de la app
 * @param {string} options.redirectUri - URI de callback
 * @param {string[]} options.scopes - Scopes a solicitar (default: openid, profile, email)
 * @param {string} options.returnTo - Ruta a la que volver después del login
 * @returns {string} URL completa de autorización
 */
export function getLoginUrl(options) {
  const {
    issuer,
    clientId,
    redirectUri,
    scopes = ["openid", "profile", "email"],
    returnTo,
  } = options;

  if (!issuer) throw new Error("issuer is required");
  if (!clientId) throw new Error("clientId is required");
  if (!redirectUri) throw new Error("redirectUri is required");

  const authUrl = new URL("/oauth/authorize", issuer.replace(/\/$/, ""));
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));

  if (returnTo) {
    const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url");
    authUrl.searchParams.set("state", state);
  }

  return authUrl.toString();
}

/**
 * Genera la URL de logout
 *
 * @param {Object} options
 * @param {string} options.logoutEndpoint - URL de la API de logout local (ej: "/api/auth/logout")
 * @param {string} options.returnTo - URL a la que volver después del logout
 * @returns {string} URL de logout
 */
export function getLogoutUrl(options = {}) {
  const { logoutEndpoint = "/api/auth/logout", returnTo } = options;

  if (returnTo) {
    return `${logoutEndpoint}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return logoutEndpoint;
}

/**
 * Crea una configuración reutilizable para auth
 *
 * @param {Object} config
 * @param {string} config.issuer - URL del servidor Gate
 * @param {string} config.clientId - Client ID de la app
 * @param {string} config.redirectUri - URI de callback
 * @param {string[]} config.scopes - Scopes a solicitar
 */
export function createAuthConfig(config) {
  const { issuer, clientId, redirectUri, scopes = ["openid", "profile", "email"] } = config;

  return {
    getLoginUrl: (returnTo) =>
      getLoginUrl({ issuer, clientId, redirectUri, scopes, returnTo }),
    getLogoutUrl: (returnTo) => getLogoutUrl({ returnTo }),
    issuer,
    clientId,
    redirectUri,
    scopes,
  };
}
