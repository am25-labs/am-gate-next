/**
 * Generate the login URL to redirect to Gate
 *
 * @param {Object} options
 * @param {string} options.issuer - URL of the Gate server
 * @param {string} options.clientId - Client ID of the app
 * @param {string} options.redirectUri - Callback URI
 * @param {string[]} options.scopes - Scopes to request (default: openid, profile, email)
 * @param {string} options.returnTo - Path to return to after login
 * @returns {string} Complete authorization URL
 */
export function getLoginUrl(options) {
  const {
    issuer,
    clientId,
    redirectUri,
    scopes = ["openid", "profile", "email", "roles"],
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
    const state = Buffer.from(JSON.stringify({ returnTo })).toString(
      "base64url",
    );
    authUrl.searchParams.set("state", state);
  }

  return authUrl.toString();
}

/**
 * Generate the logout URL
 *
 * @param {Object} options
 * @param {string} options.logoutEndpoint - URL of the local logout API (e.g., "/api/auth/logout")
 * @param {string} options.returnTo - URL to return to after logout
 * @returns {string} Logout URL
 */
export function getLogoutUrl(options = {}) {
  const { logoutEndpoint = "/api/auth/logout", returnTo } = options;

  if (returnTo) {
    return `${logoutEndpoint}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return logoutEndpoint;
}

/**
 * Create a reusable authentication configuration
 *
 * @param {Object} config
 * @param {string} config.issuer - URL of the Gate server
 * @param {string} config.clientId - Client ID of the app
 * @param {string} config.redirectUri - Callback URI
 * @param {string[]} config.scopes - Scopes to request
 */
export function createAuthConfig(config) {
  const {
    issuer,
    clientId,
    redirectUri,
    scopes = ["openid", "profile", "email"],
  } = config;

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
