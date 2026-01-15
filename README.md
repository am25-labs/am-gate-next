# @am25/gate-client

SDK server-side de autenticación OAuth2 para integrar aplicaciones Next.js 16+ con AM25 Gate.

## Características

- 100% Server-Side: Sin AuthProvider, sin CSR forzado
- Proxy para Next.js 16: Protección de rutas a nivel servidor
- Cookie httpOnly: Sesión segura compartida por dominio
- Helpers React: Funciones cacheadas para Server Components

## Instalación

```bash
pnpm add @am25/gate-client
```

## Configuración

### 1. Variables de entorno

Crear `.env.local`:

```env
# Gate OAuth
GATE_ISSUER=https://gate.am25.app
GATE_CLIENT_ID=tu-client-id
GATE_CLIENT_SECRET=tu-client-secret
GATE_REDIRECT_URI=https://miapp.am25.app/api/auth/callback

# JWT (mismo secret que Gate usa para firmar tokens)
JWT_SECRET=tu-jwt-secret

# Cookie
COOKIE_DOMAIN=.am25.app
```

### 2. Crear API Routes

#### `/api/auth/callback/route.js`

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

```js
import { createLogoutHandler } from "@am25/gate-client";

const handler = createLogoutHandler({
  cookieDomain: process.env.COOKIE_DOMAIN,
  redirectTo: "/",
});

export async function GET(request) {
  return handler(request);
}
```

### 3. Configurar Proxy (Next.js 16)

Crear `src/proxy.js`:

```js
import { createGateProxy } from "@am25/gate-client";

const gateProxy = createGateProxy({
  jwtSecret: process.env.JWT_SECRET,
  loginUrl: process.env.GATE_ISSUER + "/login",
  clientId: process.env.GATE_CLIENT_ID,
  redirectUri: process.env.GATE_REDIRECT_URI,
  protectedPaths: ["/dashboard", "/settings"],
  publicPaths: ["/dashboard/public"],
  cookieDomain: process.env.COOKIE_DOMAIN,
});

export async function proxy(request) {
  return gateProxy(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
```

### 4. Crear helpers de sesión

Crear `src/lib/auth.js`:

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
  jwtSecret: process.env.JWT_SECRET,
  cookieName: "am25_sess",
});
```

## Uso

### En Server Components

```jsx
import { getUser, requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth(); // Lanza error si no autenticado

  return (
    <div>
      <h1>Hola, {user.name}</h1>
      <p>Email: {user.email}</p>
      {user.isAdmin && <span>Eres administrador</span>}
    </div>
  );
}
```

### Verificar roles

```jsx
import { requireRole, hasRole } from "@/lib/auth";

export default async function AdminPage() {
  // Opción 1: Requerir rol (lanza error si no tiene)
  await requireRole("admin");

  // Opción 2: Verificar rol sin lanzar error
  const canEdit = await hasRole("editor");

  return <div>...</div>;
}
```

### Botón de login (Client Component)

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
    });
    window.location.href = url;
  };

  return <button onClick={handleLogin}>Iniciar sesión</button>;
}
```

### Enlace de logout

```jsx
export function LogoutButton() {
  return <a href="/api/auth/logout">Cerrar sesión</a>;
}
```

## API Reference

### `createGateProxy(options)`

Crea un proxy para proteger rutas en Next.js 16.

| Opción           | Tipo     | Requerido | Descripción                                  |
| ---------------- | -------- | --------- | -------------------------------------------- |
| `jwtSecret`      | string   | ✓         | Secret para verificar JWT                    |
| `loginUrl`       | string   | ✓         | URL de login en Gate                         |
| `clientId`       | string   | ✓         | Client ID de la app                          |
| `redirectUri`    | string   | ✓         | URI de callback                              |
| `protectedPaths` | string[] |           | Rutas a proteger (default: `["/dashboard"]`) |
| `publicPaths`    | string[] |           | Rutas públicas dentro de protectedPaths      |
| `cookieName`     | string   |           | Nombre de la cookie (default: `"am25_sess"`) |

### `createCallbackHandler(options)`

Crea el handler para intercambiar el code por tokens.

| Opción            | Tipo   | Requerido | Descripción                                      |
| ----------------- | ------ | --------- | ------------------------------------------------ |
| `issuer`          | string | ✓         | URL del servidor Gate                            |
| `clientId`        | string | ✓         | Client ID                                        |
| `clientSecret`    | string | ✓         | Client Secret                                    |
| `redirectUri`     | string | ✓         | URI de callback                                  |
| `cookieName`      | string |           | Nombre de la cookie                              |
| `cookieDomain`    | string |           | Dominio de la cookie (ej: `.am25.app`)           |
| `cookieMaxAge`    | number |           | Duración en segundos (default: 7 días)           |
| `defaultRedirect` | string |           | Ruta después del login (default: `"/dashboard"`) |

### `createLogoutHandler(options)`

Crea el handler para cerrar sesión.

| Opción         | Tipo   | Descripción                             |
| -------------- | ------ | --------------------------------------- |
| `cookieName`   | string | Nombre de la cookie                     |
| `cookieDomain` | string | Dominio de la cookie                    |
| `redirectTo`   | string | URL después del logout (default: `"/"`) |

### `createSessionHelpers(options)`

Crea helpers para acceder a la sesión en Server Components.

Retorna:

- `getSession()` - Payload completo del JWT
- `getUser()` - Datos del usuario formateados
- `isAuthenticated()` - Boolean
- `requireAuth()` - Lanza error si no autenticado
- `requireAdmin()` - Lanza error si no es admin
- `hasRole(roleKey)` - Verifica si tiene un rol
- `requireRole(roleKey)` - Lanza error si no tiene el rol

### `getLoginUrl(options)`

Genera la URL para iniciar el flujo OAuth.

| Opción        | Tipo     | Requerido | Descripción                                        |
| ------------- | -------- | --------- | -------------------------------------------------- |
| `issuer`      | string   | ✓         | URL del servidor Gate                              |
| `clientId`    | string   | ✓         | Client ID                                          |
| `redirectUri` | string   | ✓         | URI de callback                                    |
| `scopes`      | string[] |           | Scopes (default: `["openid", "profile", "email"]`) |
| `returnTo`    | string   |           | Ruta a la que volver después del login             |

## Datos del usuario

```js
{
  id: "user-id",           // ID único (sub del JWT)
  email: "user@email.com", // Email
  name: "Nombre",          // Nombre
  lastName: "Apellido",    // Apellido
  isAdmin: false,          // Si es administrador
  roles: ["editor"],       // Array de keys de roles
}
```

Los campos `id`, `isAdmin` y `roles` siempre están incluidos.

## Flujo de autenticación

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Cliente   │     │      Gate       │     │   App Cliente   │
│   (proxy.js)    │     │  (OAuth Server) │     │   (callback)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Accede a /dashboard                       │
         │ ──────────────────────>                      │
         │                       │                       │
         │ 2. Sin cookie válida  │                       │
         │    Redirect a Gate    │                       │
         │ <──────────────────── │                       │
         │                       │                       │
         │ 3. Login en Gate      │                       │
         │ ──────────────────────>                       │
         │                       │                       │
         │ 4. Redirect con code  │                       │
         │ <──────────────────── │                       │
         │                       │                       │
         │                       │ 5. Intercambia code   │
         │                       │ <─────────────────────│
         │                       │                       │
         │                       │ 6. Retorna tokens     │
         │                       │ ─────────────────────>│
         │                       │                       │
         │ 7. Cookie httpOnly    │                       │
         │ <─────────────────────────────────────────────│
         │                       │                       │
         │ 8. Redirect a /dashboard                     │
         │    (ahora con cookie válida)                 │
         │                       │                       │
```

## Cookies por dominio

Las apps comparten sesión por dominio:

- Apps en `*.am25.app` → cookie en `.am25.app`
- Apps en `*.lorem.com` → cookie en `.lorem.com`

Cada dominio tiene su propia sesión, no se cruzan.

## Notas

- La cookie es `httpOnly` y `secure` en producción
- Los tokens se verifican con el mismo `JWT_SECRET` que usa Gate
- Las funciones de sesión están cacheadas por request (React `cache()`)
- El proxy retorna `null` para continuar, o `NextResponse` para redirigir
