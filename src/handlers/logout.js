import { NextResponse } from "next/server";

/**
 * Crea el handler para /api/auth/logout
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate (requerido para logout federado)
 * @param {string} options.redirectUri - URI de callback de la app (ej: "https://miapp.am25.app/api/auth/callback")
 * @param {string} options.cookieName - Nombre de la cookie (default: "am25_sess")
 * @param {string} options.cookieDomain - Dominio de la cookie (ej: ".am25.app")
 * @param {string} options.redirectTo - Ruta después del logout (default: "/")
 */
export function createLogoutHandler(options = {}) {
  const {
    issuer,
    redirectUri,
    cookieName = "am25_sess",
    cookieDomain,
    redirectTo = "/",
  } = options;

  if (!redirectUri) throw new Error("redirectUri is required");

  const appOrigin = new URL(redirectUri).origin;

  return async function handleLogout() {
    let finalRedirect;

    if (issuer) {
      const gateLogoutUrl = new URL("/oauth/logout", issuer);
      gateLogoutUrl.searchParams.set("redirect_uri", `${appOrigin}${redirectTo}`);
      finalRedirect = gateLogoutUrl.toString();
    } else {
      finalRedirect = `${appOrigin}${redirectTo}`;
    }

    const response = NextResponse.redirect(finalRedirect);

    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: cookieDomain,
      maxAge: 0,
      path: "/",
    });

    return response;
  };
}

export { createLogoutHandler as handleLogout };
