import { NextResponse } from "next/server";

/**
 * Crea el handler para /api/auth/logout
 *
 * @param {Object} options
 * @param {string} options.cookieName - Nombre de la cookie (default: "am25_sess")
 * @param {string} options.cookieDomain - Dominio de la cookie (ej: ".am25.app")
 * @param {string} options.redirectTo - URL después del logout (default: "/")
 * @param {string} options.gateLogoutUrl - URL de logout en Gate (opcional, para logout global)
 */
export function createLogoutHandler(options = {}) {
  const {
    cookieName = "am25_sess",
    cookieDomain,
    redirectTo = "/",
    gateLogoutUrl,
  } = options;

  return async function handleLogout(request) {
    // Crear respuesta con redirección
    const finalRedirect = gateLogoutUrl || redirectTo;
    const response = NextResponse.redirect(new URL(finalRedirect, request.url));

    // Eliminar la cookie de sesión
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
