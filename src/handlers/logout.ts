import { NextResponse } from "next/server";

export interface LogoutHandlerOptions {
  issuer?: string;
  redirectUri: string;
  cookieName?: string;
  cookieDomain?: string;
  redirectTo?: string;
}

export function createLogoutHandler(options: LogoutHandlerOptions) {
  const {
    issuer,
    redirectUri,
    cookieName = "am25_sess",
    cookieDomain,
    redirectTo = "/",
  } = options;

  if (!redirectUri) throw new Error("redirectUri is required");

  const appOrigin = new URL(redirectUri).origin;

  return async function handleLogout(): Promise<NextResponse> {
    let finalRedirect: string;

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
