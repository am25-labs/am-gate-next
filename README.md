# @am25/gate-client

Server-side SDK for integrating Next.js 16+ applications with **AM25 Gate IdP**, an Identity Provider compatible with OAuth 2.0 and OpenID Connect.

## Features

- Server-first authentication: no React providers, no forced CSR
- OAuth 2.0 + OIDC: Authorization Code flow with full scope support
- Proxy for Next.js 16: Server-level route protection
- httpOnly Cookie: Secure session shared across subdomains
- React Helpers: Cached functions for Server Components
- RS256 (JWKS): Token verification using public keys, no shared secrets
- Roles and permissions: Access user roles via the `roles` scope

## Installation

```bash
pnpm add @am25/gate-client
```

## Requirements

- Next.js 16+
- React 19+
- An app registered as an OAuth client in Gate

## Configuration

### 1. Environment variables

Create `.env.local`:

```env
# Gate OAuth
GATE_ISSUER=https://gate.example.com
GATE_CLIENT_ID=your-client-id
GATE_CLIENT_SECRET=your-client-secret
GATE_REDIRECT_URI=https://myapp.example.com/api/auth/callback

# Cookie
COOKIE_DOMAIN=.example.com

# For client-side components (LoginButton)
NEXT_PUBLIC_GATE_ISSUER=https://gate.example.com
NEXT_PUBLIC_GATE_CLIENT_ID=your-client-id
NEXT_PUBLIC_GATE_REDIRECT_URI=https://myapp.example.com/api/auth/callback
```

You do not need `JWT_SECRET`. Tokens are verified using Gate's public key (JWKS).

### 2. Create API Routes

#### `/api/auth/callback/route.js`

Exchanges the authorization code for tokens and sets the session cookie.

```js
import { createCallbackHandler } from "@am25/gate-client";

const handler = createCallbackHandler({
  issuer: process.env.GATE_ISSUER,
  clientId: process.env.GATE_CLIENT_ID,
  clientSecret: process.env.GATE_CLIENT_SECRET,
  redirectUri: process.env.GATE_REDIRECT_URI,
  cookieDomain: process.env.COOKIE_DOMAIN,
  defaultRedirect: "/dashboard",
});

export async function GET(request) {
  return handler(request);
}
```

#### `/api/auth/logout/route.js`

Clears the local cookie and optionally logs out from Gate (federated logout).

```js
import { createLogoutHandler } from "@am25/gate-client";

const handler = createLogoutHandler({
  issuer: process.env.GATE_ISSUER,
  redirectUri: process.env.GATE_REDIRECT_URI,
  cookieDomain: process.env.COOKIE_DOMAIN,
  redirectTo: "/",
});

export async function GET(request) {
  return handler(request);
}
```

### 3. Configure Proxy (Next.js 16)

The proxy protects routes by verifying the session cookie. If there is no valid session, the user is redirected to Gate to authenticate.

Create `src/proxy.js`:

```js
import { createGateProxy } from "@am25/gate-client";

const gateProxy = createGateProxy({
  issuer: process.env.GATE_ISSUER,
  clientId: process.env.GATE_CLIENT_ID,
  redirectUri: process.env.GATE_REDIRECT_URI,
  protectedPaths: ["/dashboard", "/settings"],
  publicPaths: ["/dashboard/public"],
  // scopes: ["openid", "profile", "email", "roles"], // default
});

export async function proxy(request) {
  return gateProxy(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
```

### 4. Create session helpers

Create `src/lib/auth.js`:

```js
import { createSessionHelpers } from "@am25/gate-client";

export const {
  getSession,
  getUser,
  isAuthenticated,
  requireAuth,
  requireAdmin,
  hasRole,
  requireRole,
} = createSessionHelpers({
  issuer: process.env.GATE_ISSUER,
});
```

## Usage

### In Server Components

```jsx
import { getUser, requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div>
      <h1>Hello, {user.name}</h1>
      <p>Email: {user.email}</p>
      {user.isAdmin && <span>You are an administrator</span>}
    </div>
  );
}
```

### Checking roles

Roles are available by default (the `roles` scope is included). If for some reason you need to exclude them, configure `scopes` without `"roles"` in the proxy or in `getLoginUrl`.

```jsx
import { requireRole, hasRole } from "@/lib/auth";

export default async function EditorPage() {
  // Option 1: Require role (throws error if missing)
  await requireRole("editor");

  // Option 2: Check role without throwing
  const canPublish = await hasRole("publisher");

  return <div>...</div>;
}
```

### In Server Actions

```js
import { getUser } from "@/lib/auth";

export async function createPost(data) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  await prisma.post.create({
    data: {
      ...data,
      authorId: user.id,
    },
  });
}
```

### Login button (Client Component)

```jsx
"use client";

import { getLoginUrl } from "@am25/gate-client";

export function LoginButton() {
  const handleLogin = () => {
    const url = getLoginUrl({
      issuer: process.env.NEXT_PUBLIC_GATE_ISSUER,
      clientId: process.env.NEXT_PUBLIC_GATE_CLIENT_ID,
      redirectUri: process.env.NEXT_PUBLIC_GATE_REDIRECT_URI,
      returnTo: "/dashboard",
      // scopes: ["openid", "profile", "email", "roles"], // default
    });
    window.location.href = url;
  };

  return <button onClick={handleLogin}>Log in</button>;
}
```

### Logout link

```jsx
export function LogoutButton() {
  return <a href="/api/auth/logout">Log out</a>;
}
```

## Scopes

Gate supports the following OIDC scopes:

| Scope     | Claims included in the token          |
| --------- | ------------------------------------- |
| `openid`  | `sub` (required for OIDC)             |
| `profile` | `name`, `lastName`                    |
| `email`   | `email`                               |
| `roles`   | `{issuer}/is_admin`, `{issuer}/roles` |

The default scope is `openid profile email roles`.

Role claims use a namespace URI for compatibility with the OIDC standard. The SDK resolves them automatically in `getUser()`.

## User data

The object returned by `getUser()`:

```js
{
  id: "user-id",           // JWT sub
  email: "user@email.com", // requires "email" scope
  name: "Name",            // requires "profile" scope
  lastName: "LastName",    // requires "profile" scope
  isAdmin: false,          // requires "roles" scope (default: false)
  roles: ["editor"],       // requires "roles" scope (default: [])
}
```

### Difference between getSession and getUser

| Function       | Returns          | User ID       | Recommended use   |
| -------------- | ---------------- | ------------- | ----------------- |
| `getSession()` | Raw JWT payload  | `session.sub` | Access raw claims |
| `getUser()`    | Formatted object | `user.id`     | Business logic    |

Use `getUser()` for business logic. Use `getSession()` only if you need direct access to JWT claims.

## API Reference

### `createGateProxy(options)`

Creates a proxy to protect routes in Next.js 16.

| Option           | Type     | Required | Default                                   | Description                         |
| ---------------- | -------- | -------- | ----------------------------------------- | ----------------------------------- |
| `issuer`         | string   | Yes      |                                           | Gate server URL                     |
| `clientId`       | string   | Yes      |                                           | App Client ID                       |
| `redirectUri`    | string   | Yes      |                                           | Callback URI                        |
| `protectedPaths` | string[] | No       | `["/dashboard"]`                          | Routes to protect                   |
| `publicPaths`    | string[] | No       | `[]`                                      | Public routes inside protectedPaths |
| `cookieName`     | string   | No       | `"am25_sess"`                             | Cookie name                         |
| `scopes`         | string[] | No       | `["openid", "profile", "email", "roles"]` | Scopes requested during redirect    |

Returns `null` if the route does not require protection or the session is valid. Returns `NextResponse.redirect` if authentication is required.

### `createCallbackHandler(options)`

Creates the handler to exchange the authorization code for tokens.

| Option            | Type   | Required | Default         | Description                           |
| ----------------- | ------ | -------- | --------------- | ------------------------------------- |
| `issuer`          | string | Yes      |                 | Gate server URL                       |
| `clientId`        | string | Yes      |                 | Client ID                             |
| `clientSecret`    | string | Yes      |                 | Client Secret                         |
| `redirectUri`     | string | Yes      |                 | Callback URI (must match Gate config) |
| `cookieName`      | string | No       | `"am25_sess"`   | Cookie name                           |
| `cookieDomain`    | string | No       |                 | Cookie domain (e.g. `.example.com`)   |
| `cookieMaxAge`    | number | No       | `2592000` (30d) | Duration in seconds                   |
| `defaultRedirect` | string | No       | `"/dashboard"`  | Route after login                     |

The handler stores the `session_token` (or `access_token` as fallback) in an httpOnly cookie.

### `createLogoutHandler(options)`

Creates the logout handler.

| Option         | Type   | Required | Default       | Description                                 |
| -------------- | ------ | -------- | ------------- | ------------------------------------------- |
| `redirectUri`  | string | Yes      |               | Callback URI (used to determine app origin) |
| `issuer`       | string | No       |               | Gate URL (enables federated logout)         |
| `cookieName`   | string | No       | `"am25_sess"` | Cookie name                                 |
| `cookieDomain` | string | No       |               | Cookie domain                               |
| `redirectTo`   | string | No       | `"/"`         | Route after logout                          |

**Federated logout:** If `issuer` is provided, logout redirects to Gate to close the user's global session across all apps. Otherwise, it only clears the local cookie.

### `createSessionHelpers(options)`

Creates helpers to access the session in Server Components.

| Option       | Type   | Required | Default       | Description     |
| ------------ | ------ | -------- | ------------- | --------------- |
| `issuer`     | string | Yes      |               | Gate server URL |
| `cookieName` | string | No       | `"am25_sess"` | Cookie name     |

Returns:

| Helper                 | Returns          | Description                              |
| ---------------------- | ---------------- | ---------------------------------------- |
| `getSession()`         | `Object \| null` | Raw JWT payload                          |
| `getUser()`            | `Object \| null` | Formatted user data                      |
| `isAuthenticated()`    | `boolean`        | Whether a session exists                 |
| `requireAuth()`        | `Object`         | User data, throws if not authenticated   |
| `requireAdmin()`       | `Object`         | User data, throws if not admin           |
| `hasRole(roleKey)`     | `boolean`        | Checks if the user has a role            |
| `requireRole(roleKey)` | `Object`         | User data, throws if the role is missing |

All functions are cached per request using `React.cache()`.

### `getLoginUrl(options)`

Generates the URL to start the OAuth flow.

| Option        | Type     | Required | Default                                   | Description                    |
| ------------- | -------- | -------- | ----------------------------------------- | ------------------------------ |
| `issuer`      | string   | Yes      |                                           | Gate server URL                |
| `clientId`    | string   | Yes      |                                           | Client ID                      |
| `redirectUri` | string   | Yes      |                                           | Callback URI                   |
| `scopes`      | string[] | No       | `["openid", "profile", "email", "roles"]` | Scopes to request              |
| `returnTo`    | string   | No       |                                           | Route to return to after login |

### `getLogoutUrl(options)`

Generates the URL for the local logout endpoint.

| Option           | Type   | Required | Default              | Description          |
| ---------------- | ------ | -------- | -------------------- | -------------------- |
| `logoutEndpoint` | string | No       | `"/api/auth/logout"` | Logout handler route |
| `returnTo`       | string | No       |                      | URL after logout     |

### `createAuthConfig(config)`

Creates a reusable configuration that encapsulates `getLoginUrl` and `getLogoutUrl`.

```js
import { createAuthConfig } from "@am25/gate-client";

const auth = createAuthConfig({
  issuer: process.env.NEXT_PUBLIC_GATE_ISSUER,
  clientId: process.env.NEXT_PUBLIC_GATE_CLIENT_ID,
  redirectUri: process.env.NEXT_PUBLIC_GATE_REDIRECT_URI,
  scopes: ["openid", "profile", "email", "roles"],
});

const loginUrl = auth.getLoginUrl("/dashboard");
const logoutUrl = auth.getLogoutUrl("/");
```

### `verifyTokenWithJWKS(token, issuer, expectedTyp)`

Verifies a JWT using Gate’s public key (JWKS). Used internally by the SDK but available for manual verification.

| Parameter     | Type   | Required | Description                                        |
| ------------- | ------ | -------- | -------------------------------------------------- |
| `token`       | string | Yes      | JWT to verify                                      |
| `issuer`      | string | Yes      | Gate server URL                                    |
| `expectedTyp` | string | No       | Expected header type (e.g. `"st+jwt"`, `"at+jwt"`) |

### `clearJWKSCache(issuer)`

Clears the JWKS public key cache. Useful if Gate rotates its keys.

| Parameter | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `issuer`  | string | No       | Issuer URL. If omitted, clears all cache |

## Authentication flow

```
User            App (proxy)            Gate (IdP)           App (callback)
  |                  |                      |                      |
  | GET /dashboard   |                      |                      |
  | ---------------> |                      |                      |
  |                  |                      |                      |
  |                  | No valid cookie      |                      |
  |                  | Redirect to Gate     |                      |
  | <--------------- |                      |                      |
  |                  |                      |                      |
  | Login on Gate                           |                      |
  | --------------------------------------->|                      |
  |                  |                      |                      |
  | Redirect with authorization code       |                      |
  | <---------------------------------------|                      |
  |                  |                      |                      |
  | GET /api/auth/callback?code=xxx                               |
  | -------------------------------------------------------------->|
  |                  |                      |                      |
  |                  |                      | POST /oauth/token    |
  |                  |                      |<---------------------|
  |                  |                      |                      |
  |                  |                      | Returns tokens       |
  |                  |                      |--------------------->|
  |                  |                      |                      |
  | Set-Cookie: am25_sess (httpOnly, RS256)                       |
  | <--------------------------------------------------------------|
  |                  |                      |                      |
  | Redirect to /dashboard                                         |
  | ---------------> |                      |                      |
  |                  |                      |                      |
  |                  | Verify token (JWKS) |                      |
  |                  | -------------------> |                      |
  |                  |                      |                      |
  |                  | Public key (cache)  |                      |
  |                  | <------------------- |                      |
  |                  |                      |                      |
  | Page OK          |                      |                      |
  | <--------------- |                      |                      |
```

## Token verification (RS256)

The SDK verifies tokens using Gate’s public key obtained from the JWKS endpoint:

```
GET {issuer}/.well-known/jwks.json
```

- Only Gate has the private key (used to sign tokens)
- Apps only need the public key (used to verify tokens)
- The public key is automatically cached in memory

## Domain cookies

Apps share sessions by domain:

- Apps on `*.example.com` → cookie on `.example.com`
- Apps on `*.example.com` → cookie on `.example.com`

Each domain has its own session. They do not cross.

## Access control

Gate manages access at two levels:

**Per application:** In the Gate dashboard you configure which users can access each app. Administrators automatically have access to all apps. If an unauthorized user tries to authenticate, Gate returns a 403 error.

**Per role (inside the app):** Roles travel as claims in the token when the `roles` scope is requested. Each app decides how to use them internally (e.g. show/hide features, protect routes).

## Internal vs third-party clients

Gate distinguishes two types of OAuth clients:

| Type                       | Consent             | Use case                            |
| -------------------------- | ------------------- | ----------------------------------- |
| **Internal (first-party)** | No, auto-approved   | Apps within the AM25 ecosystem      |
| **Third-party**            | Yes, consent screen | External apps integrating with Gate |

Configured in the Gate dashboard when creating or editing a client.

## Migration from v1.x

### Breaking changes in v2.0

1. **Configurable scopes:** The proxy and `getLoginUrl` accept a `scopes` parameter. Default: `["openid", "profile", "email", "roles"]`.

2. **Namespaced claims:** `isAdmin` and `roles` claims use a namespace URI in the raw token (`{issuer}/is_admin`, `{issuer}/roles`). `getUser()` resolves them automatically, but if you use `getSession()` you must update:

   ```js
   // v1.x
   session.isAdmin;
   session.roles;

   // v2.0 (raw claims)
   session["https://gate.example.com/is_admin"];
   session["https://gate.example.com/roles"];

   // Recommended: use getUser()
   const user = await getUser();
   user.isAdmin;
   user.roles;
   ```

3. **No allowedClients:** Tokens no longer include `allowedClients`. Access control is verified in Gate during `/oauth/authorize`, not in the token.

## Compatibility with standard libraries

Gate is an OAuth 2.0 and OpenID Connect compatible Identity Provider. Besides this SDK, you can integrate it with any library that supports OIDC Discovery:

```
Discovery: {issuer}/.well-known/openid-configuration
JWKS:      {issuer}/.well-known/jwks.json
```

```

Traducción sólida. Técnica, limpia, y sin ese inglés torpe que a veces sale cuando alguien mete el README a un traductor automático y cruza los dedos. Si vas a publicar esto en npm o GitHub, no da vergüenza ajena. Eso ya te pone por encima de la mitad de los paquetes del ecosistema JavaScript, lo cual no es exactamente un estándar exigente, pero igual cuenta.
```
