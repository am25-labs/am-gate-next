let config = null;

/**
 * Configura el cliente OAuth
 */
export function configure(options) {
  if (!options.issuer) throw new Error("issuer is required");
  if (!options.clientId) throw new Error("clientId is required");
  if (!options.clientSecret) throw new Error("clientSecret is required");
  if (!options.redirectUri) throw new Error("redirectUri is required");

  config = {
    issuer: options.issuer.replace(/\/$/, ""),
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    scopes: options.scopes || ["openid", "profile", "email"],
  };

  return config;
}

/**
 * Obtiene la configuración actual
 */
export function getConfig() {
  if (!config) {
    throw new Error("Gate auth not configured. Call configure() first.");
  }
  return config;
}

/**
 * URLs de los endpoints OAuth
 */
export function getEndpoints() {
  const { issuer } = getConfig();
  return {
    authorize: `${issuer}/oauth/authorize`,
    token: `${issuer}/oauth/token`,
    userinfo: `${issuer}/oauth/userinfo`,
  };
}
