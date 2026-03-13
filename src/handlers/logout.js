import { NextResponse } from "next/server";

/**
 * Create the handler for /api/auth/logout
 *
 * @param {Object} options
 * @param {string} options.issuer - Gate server URL (required for federated logout)
 * @param {string} options.redirectUri - Callback URI of the app (e.g., "https://miapp.example.com/api/auth/callback")
 * @param {string} options.cookieName - Cookie name (default: "am25_sess")
 * @param {string} options.cookieDomain - Cookie domain (e.g., ".example.com")
 * @param {string} options.redirectTo - Route after logout (default: "/")
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
      gateLogoutUrl.searchParams.set(
        "redirect_uri",
        `${appOrigin}${redirectTo}`,
      );
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
