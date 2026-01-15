import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Crea un proxy de autenticación para Next.js 16
 *
 * @param {Object} options
 * @param {string} options.jwtSecret - Secret para verificar el JWT
 * @param {string} options.cookieName - Nombre de la cookie de sesión (default: basado en dominio)
 * @param {string[]} options.protectedPaths - Rutas protegidas (default: ["/dashboard"])
 * @param {string[]} options.publicPaths - Rutas públicas dentro de protectedPaths (ej: ["/dashboard/public"])
 * @param {string} options.loginUrl - URL de login en Gate (ej: "https://gate.am25.app/login")
 * @param {string} options.clientId - Client ID de la app en Gate
 * @param {string} options.redirectUri - URI de callback (ej: "https://myapp.am25.app/api/auth/callback")
 */
export function createGateProxy(options) {
  const {
    jwtSecret,
    cookieName = "am25_sess",
    protectedPaths = ["/dashboard"],
    publicPaths = [],
    loginUrl,
    clientId,
    redirectUri,
  } = options;

  if (!jwtSecret) throw new Error("jwtSecret is required");
  if (!loginUrl) throw new Error("loginUrl is required");
  if (!clientId) throw new Error("clientId is required");
  if (!redirectUri) throw new Error("redirectUri is required");

  const secretKey = new TextEncoder().encode(jwtSecret);

  return async function gateProxy(request) {
    const { pathname } = request.nextUrl;

    // Verificar si es una ruta pública
    const isPublic = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );
    if (isPublic) return null;

    // Verificar si es una ruta protegida
    const isProtected = protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );
    if (!isProtected) return null;

    // Obtener cookie de sesión
    const token = request.cookies.get(cookieName)?.value;

    if (!token) {
      return redirectToLogin(request, loginUrl, clientId, redirectUri);
    }

    try {
      await jwtVerify(token, secretKey);
      return null; // Sesión válida, continuar
    } catch {
      return redirectToLogin(request, loginUrl, clientId, redirectUri);
    }
  };
}

function redirectToLogin(request, loginUrl, clientId, redirectUri) {
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;
  const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url");

  const authUrl = new URL("/oauth/authorize", loginUrl.replace("/login", ""));
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}

export { createGateProxy as gateProxy };
