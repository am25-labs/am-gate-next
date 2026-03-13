import { cookies } from "next/headers";
import { cache } from "react";
import { verifyTokenWithJWKS } from "./jwks.js";

/**
 * Create session helpers for Server Components
 *
 * @param {Object} options
 * @param {string} options.issuer - Gate server URL (e.g., "https://gate.example.com")
 * @param {string} options.cookieName - Cookie name (default: "am25_sess")
 */
export function createSessionHelpers(options) {
  const { issuer, cookieName = "am25_sess" } = options;

  if (!issuer) throw new Error("issuer is required");

  /**
   * Gets the current session (cached per request)
   * @returns {Promise<Object|null>} Token payload or null if there is no session
   */
  const getSession = cache(async () => {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(cookieName)?.value;

      if (!token) return null;

      const payload = await verifyTokenWithJWKS(token, issuer, "st+jwt");
      return payload;
    } catch {
      return null;
    }
  });

  /**
   * Gets the user from the current session
   * @returns {Promise<Object|null>} User data or null
   */
  const nsIsAdmin = `${issuer.replace(/\/$/, "")}/is_admin`;
  const nsRoles = `${issuer.replace(/\/$/, "")}/roles`;

  const getUser = cache(async () => {
    const session = await getSession();
    if (!session) return null;

    return {
      id: session.sub,
      email: session.email,
      name: session.name,
      lastName: session.lastName,
      isAdmin: session[nsIsAdmin] ?? false,
      roles: session[nsRoles] ?? [],
    };
  });

  /**
   * Verifies if there is an active session
   * @returns {Promise<boolean>}
   */
  const isAuthenticated = async () => {
    const session = await getSession();
    return session !== null;
  };

  /**
   * Requires authentication, throws error if no session is found
   * @returns {Promise<Object>} User data
   * @throws {Error} If no valid session is found
   */
  const requireAuth = async () => {
    const user = await getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }
    return user;
  };

  /**
   * Requires the user to be admin
   * @returns {Promise<Object>} User data
   * @throws {Error} If the user is not an admin
   */
  const requireAdmin = async () => {
    const user = await requireAuth();
    if (!user.isAdmin) {
      throw new Error("Not authorized");
    }
    return user;
  };

  /**
   * Verifies if the user has a specific role
   * @param {string} roleKey - Key of the role to verify
   * @returns {Promise<boolean>}
   */
  const hasRole = async (roleKey) => {
    const user = await getUser();
    if (!user) return false;
    return user.roles.includes(roleKey);
  };

  /**
   * Requires a specific role
   * @param {string} roleKey - Key of the role required
   * @returns {Promise<Object>} User data
   * @throws {Error} If the user does not have the role
   */
  const requireRole = async (roleKey) => {
    const user = await requireAuth();
    if (!user.roles.includes(roleKey)) {
      throw new Error(`Role required: ${roleKey}`);
    }
    return user;
  };

  return {
    getSession,
    getUser,
    isAuthenticated,
    requireAuth,
    requireAdmin,
    hasRole,
    requireRole,
  };
}
