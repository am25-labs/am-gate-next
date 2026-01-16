import { NextResponse } from "next/server";

/**
 * Crea el handler para /api/auth/logout
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate (requerido para logout federado)
 * @param {string} options.cookieName - Nombre de la cookie (default: "am25_sess")
 * @param {string} options.cookieDomain - Dominio de la cookie (ej: ".am25.app")
 * @param {string} options.redirectTo - URL después del logout (default: "/")
 */
export function createLogoutHandler(options = {}) {
  const {
    issuer,
    cookieName = "am25_sess",
    cookieDomain,
    redirectTo = "/",
  } = options;

  return async function handleLogout(request) {
    // Determinar la URL final de redirección
    let finalRedirect;

    if (issuer) {
      // Logout federado: redirigir a Gate para cerrar sesión global
      const gateLogoutUrl = new URL("/oauth/logout", issuer);
      const appUrl = new URL(redirectTo, request.url);
      gateLogoutUrl.searchParams.set("redirect_uri", appUrl.toString());
      finalRedirect = gateLogoutUrl.toString();
    } else {
      // Logout local: solo redirigir dentro de la app
      finalRedirect = new URL(redirectTo, request.url).toString();
    }

    const response = NextResponse.redirect(finalRedirect);

    // Eliminar la cookie de sesión local
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
