// Proxy for Next.js 16
export { createGateProxy, gateProxy } from "./proxy.js";

// Handlers for API routes
export { createCallbackHandler, handleCallback } from "./handlers/callback.js";
export { createLogoutHandler, handleLogout } from "./handlers/logout.js";

// Helpers server-side
export { createSessionHelpers } from "./lib/session.js";

// Authentication utilities
export { getLoginUrl, getLogoutUrl, createAuthConfig } from "./lib/auth.js";

// JWKS utilities
export { verifyTokenWithJWKS, clearJWKSCache } from "./lib/jwks.js";
