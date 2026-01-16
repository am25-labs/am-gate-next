import { cookies } from "next/headers";
import { cache } from "react";
import { verifyTokenWithJWKS } from "./jwks.js";

/**
 * Crea helpers de sesión para Server Components
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate (ej: "https://gate.am25.app")
 * @param {string} options.cookieName - Nombre de la cookie (default: "am25_sess")
 */
export function createSessionHelpers(options) {
  const { issuer, cookieName = "am25_sess" } = options;

  if (!issuer) throw new Error("issuer is required");

  /**
   * Obtiene la sesión actual (cached por request)
   * @returns {Promise<Object|null>} Payload del token o null si no hay sesión
   */
  const getSession = cache(async () => {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(cookieName)?.value;

      if (!token) return null;

      const payload = await verifyTokenWithJWKS(token, issuer);
      return payload;
    } catch {
      return null;
    }
  });

  /**
   * Obtiene el usuario de la sesión actual
   * @returns {Promise<Object|null>} Datos del usuario o null
   */
  const getUser = cache(async () => {
    const session = await getSession();
    if (!session) return null;

    return {
      id: session.sub,
      email: session.email,
      name: session.name,
      lastName: session.lastName,
      isAdmin: session.isAdmin,
      roles: session.roles || [],
    };
  });

  /**
   * Verifica si hay una sesión activa
   * @returns {Promise<boolean>}
   */
  const isAuthenticated = async () => {
    const session = await getSession();
    return session !== null;
  };

  /**
   * Requiere autenticación, lanza error si no hay sesión
   * @returns {Promise<Object>} Datos del usuario
   * @throws {Error} Si no hay sesión válida
   */
  const requireAuth = async () => {
    const user = await getUser();
    if (!user) {
      throw new Error("No autenticado");
    }
    return user;
  };

  /**
   * Requiere que el usuario sea admin
   * @returns {Promise<Object>} Datos del usuario
   * @throws {Error} Si no es admin
   */
  const requireAdmin = async () => {
    const user = await requireAuth();
    if (!user.isAdmin) {
      throw new Error("No autorizado");
    }
    return user;
  };

  /**
   * Verifica si el usuario tiene un rol específico
   * @param {string} roleKey - Key del rol a verificar
   * @returns {Promise<boolean>}
   */
  const hasRole = async (roleKey) => {
    const user = await getUser();
    if (!user) return false;
    return user.roles.includes(roleKey);
  };

  /**
   * Requiere un rol específico
   * @param {string} roleKey - Key del rol requerido
   * @returns {Promise<Object>} Datos del usuario
   * @throws {Error} Si no tiene el rol
   */
  const requireRole = async (roleKey) => {
    const user = await requireAuth();
    if (!user.roles.includes(roleKey)) {
      throw new Error(`Rol requerido: ${roleKey}`);
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
