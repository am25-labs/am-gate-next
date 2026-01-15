import { NextResponse } from "next/server";

/**
 * Crea un middleware de autenticación para Next.js
 *
 * @param {Object} options
 * @param {string} options.issuer - URL del servidor Gate
 * @param {string[]} options.protectedPaths - Rutas que requieren autenticación
 * @param {string} options.loginPath - Ruta de login de la app (default: "/login")
 * @param {string} options.callbackPath - Ruta de callback OAuth (default: "/callback")
 */
export function withAuth(options) {
  const {
    issuer,
    protectedPaths = [],
    loginPath = "/login",
    callbackPath = "/callback",
  } = options;

  return async function middleware(request) {
    const { pathname } = request.nextUrl;

    // No proteger rutas públicas
    if (
      pathname === loginPath ||
      pathname === callbackPath ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    // Verificar si la ruta está protegida
    const isProtected = protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    if (!isProtected) {
      return NextResponse.next();
    }

    // Verificar token en cookie
    const token = request.cookies.get("gate_access_token")?.value;

    if (!token) {
      // Redirigir a login
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verificar que el token no haya expirado
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000;

      if (Date.now() >= exp) {
        // Token expirado
        const response = NextResponse.redirect(new URL(loginPath, request.url));
        response.cookies.delete("gate_access_token");
        return response;
      }
    } catch {
      // Token inválido
      const response = NextResponse.redirect(new URL(loginPath, request.url));
      response.cookies.delete("gate_access_token");
      return response;
    }

    return NextResponse.next();
  };
}

/**
 * Helper para guardar el token en una cookie httpOnly desde una API route
 */
export function setAuthCookie(response, accessToken, maxAge = 3600) {
  response.cookies.set("gate_access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

/**
 * Helper para eliminar la cookie de auth
 */
export function clearAuthCookie(response) {
  response.cookies.delete("gate_access_token");
}
