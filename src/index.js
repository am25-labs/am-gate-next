// Proxy para Next.js 16
export { createGateProxy, gateProxy } from "./proxy.js";

// Handlers para API routes
export { createCallbackHandler, handleCallback } from "./handlers/callback.js";
export { createLogoutHandler, handleLogout } from "./handlers/logout.js";

// Helpers server-side
export { createSessionHelpers } from "./lib/session.js";

// Utilidades de autenticación
export { getLoginUrl, getLogoutUrl, createAuthConfig } from "./lib/auth.js";
