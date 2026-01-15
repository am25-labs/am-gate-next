import { NextResponse } from "next/server";

/**
 * Crea el handler para /api/auth/callback
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate (ej: "https://gate.am25.app")
 * @param {string} options.clientId - Client ID de la app
 * @param {string} options.clientSecret - Client Secret de la app
 * @param {string} options.redirectUri - URI de callback (debe coincidir con Gate)
 * @param {string} options.cookieName - Nombre de la cookie (default: "am25_sess")
 * @param {string} options.cookieDomain - Dominio de la cookie (ej: ".am25.app")
 * @param {number} options.cookieMaxAge - Duración en segundos (default: 7 días)
 * @param {string} options.defaultRedirect - Ruta por defecto después del login (default: "/dashboard")
 */
export function createCallbackHandler(options) {
  const {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    cookieName = "am25_sess",
    cookieDomain,
    cookieMaxAge = 60 * 60 * 24 * 7, // 7 días
    defaultRedirect = "/dashboard",
  } = options;

  if (!issuer) throw new Error("issuer is required");
  if (!clientId) throw new Error("clientId is required");
  if (!clientSecret) throw new Error("clientSecret is required");
  if (!redirectUri) throw new Error("redirectUri is required");

  const tokenEndpoint = `${issuer.replace(/\/$/, "")}/oauth/token`;

  return async function handleCallback(request) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Manejar errores de OAuth
    if (error) {
      const errorDescription = searchParams.get("error_description") || error;
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/login?error=missing_code", request.url)
      );
    }

    try {
      // Intercambiar code por tokens
      const tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error("Token exchange failed:", errorData);
        return NextResponse.redirect(
          new URL("/login?error=token_exchange_failed", request.url)
        );
      }

      const tokens = await tokenResponse.json();

      // Determinar la URL de redirección
      let redirectTo = defaultRedirect;
      if (state) {
        try {
          const stateData = JSON.parse(
            Buffer.from(state, "base64url").toString()
          );
          if (stateData.returnTo) {
            redirectTo = stateData.returnTo;
          }
        } catch {
          // Estado inválido, usar default
        }
      }

      // Crear respuesta con cookie
      const response = NextResponse.redirect(new URL(redirectTo, request.url));

      response.cookies.set(cookieName, tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain: cookieDomain,
        maxAge: cookieMaxAge,
        path: "/",
      });

      return response;
    } catch (error) {
      console.error("Callback handler error:", error);
      return NextResponse.redirect(
        new URL("/login?error=callback_failed", request.url)
      );
    }
  };
}

export { createCallbackHandler as handleCallback };
