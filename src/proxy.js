import { NextResponse } from "next/server";
import { verifyTokenWithJWKS } from "./lib/jwks.js";

/**
 * Crea un proxy de autenticación para Next.js 16
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate (ej: "https://gate.am25.app")
 * @param {string} options.cookieName - Nombre de la cookie de sesión (default: "am25_sess")
 * @param {string[]} options.protectedPaths - Rutas protegidas (default: ["/dashboard"])
 * @param {string[]} options.publicPaths - Rutas públicas dentro de protectedPaths (ej: ["/dashboard/public"])
 * @param {string} options.clientId - Client ID de la app en Gate
 * @param {string} options.redirectUri - URI de callback (ej: "https://myapp.am25.app/api/auth/callback")
 */
export function createGateProxy(options) {
  const {
    issuer,
    cookieName = "am25_sess",
    protectedPaths = ["/dashboard"],
    publicPaths = [],
    clientId,
    redirectUri,
    scopes = ["openid", "profile", "email", "roles"],
  } = options;

  if (!issuer) throw new Error("issuer is required");
  if (!clientId) throw new Error("clientId is required");
  if (!redirectUri) throw new Error("redirectUri is required");

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
      return redirectToLogin(request, issuer, clientId, redirectUri, scopes);
    }

    try {
      await verifyTokenWithJWKS(token, issuer, "st+jwt");
      return null;
    } catch {
      return redirectToLogin(request, issuer, clientId, redirectUri, scopes);
    }
  };
}

function redirectToLogin(request, issuer, clientId, redirectUri, scopes) {
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;
  const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url");

  const authUrl = new URL("/oauth/authorize", issuer);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}

export { createGateProxy as gateProxy };
