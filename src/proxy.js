import { NextResponse } from "next/server";
import { verifyTokenWithJWKS } from "./lib/jwks.js";

/**
 * Create an authentication proxy for Next.js 16
 *
 * @param {Object} options
 * @param {string} options.issuer - URL of the Gate server (e.g., "https://gate.example.com")
 * @param {string} options.cookieName - Name of the session cookie (default: "am25_sess")
 * @param {string[]} options.protectedPaths - Protected routes (default: ["/dashboard"])
 * @param {string[]} options.publicPaths - Public routes within protectedPaths (e.g., ["/dashboard/public"])
 * @param {string} options.clientId - Client ID of the app in Gate
 * @param {string} options.redirectUri - Callback URI (e.g., "https://myapp.example.com/api/auth/callback")
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

    // Verify if it's a public route
    const isPublic = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/"),
    );
    if (isPublic) return null;

    // Verify if it's a protected route
    const isProtected = protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/"),
    );
    if (!isProtected) return null;

    // Get session cookie
    const token = request.cookies.get(cookieName)?.value;

    if (!token) {
      return redirectToLogin(request, issuer, clientId, redirectUri, scopes);
    }

    try {
      await verifyTokenWithJWKS(token, issuer, "st+jwt");
    } catch {
      return redirectToLogin(request, issuer, clientId, redirectUri, scopes);
    }

    try {
      const sessionRes = await fetch(
        `${issuer.replace(/\/$/, "")}/api/auth/session?client_id=${encodeURIComponent(clientId)}`,
        { headers: { Cookie: `${cookieName}=${token}` }, cache: "no-store" },
      );

      if (sessionRes.status === 403) {
        return NextResponse.redirect(new URL("/unauthorized", issuer));
      }
    } catch {
      // Gate unreachable — fail open, JWT is already verified
    }

    return null;
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
