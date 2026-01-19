# @am25/gate-client

SDK server-side de autenticación OAuth2 para integrar aplicaciones Next.js 16+ con AM25 Gate.

## Características

- 100% Server-Side: Sin AuthProvider, sin CSR forzado
- Proxy para Next.js 16: Protección de rutas a nivel servidor
- Control de acceso por app: Solo usuarios autorizados pueden acceder a cada aplicación
- Cookie httpOnly: Sesión segura compartida por dominio
- Helpers React: Funciones cacheadas para Server Components
- RS256 (Clave asimétrica): Verificación de tokens sin compartir secrets

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

# Cookie
COOKIE_DOMAIN=.am25.app
```

**Nota:** Ya no necesitas `JWT_SECRET`. Los tokens se verifican usando la clave pública de Gate (JWKS).

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
  issuer: process.env.GATE_ISSUER,
  redirectUri: process.env.GATE_REDIRECT_URI,
  cookieDomain: process.env.COOKIE_DOMAIN,
  redirectTo: "/",
});

export async function GET(request) {
  return handler(request);
}
```

> **Nota:** Al pasar `issuer`, el logout cierra la sesión en Gate (logout federado). El `redirectUri` determina el origen de la app para la redirección.

### 3. Configurar Proxy (Next.js 16)

Crear `src/proxy.js`:

```js
import { createGateProxy } from "@am25/gate-client";

const gateProxy = createGateProxy({
  issuer: process.env.GATE_ISSUER,
  clientId: process.env.GATE_CLIENT_ID,
  redirectUri: process.env.GATE_REDIRECT_URI,
  protectedPaths: ["/dashboard", "/settings"],
  publicPaths: ["/dashboard/public"],
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
  issuer: process.env.GATE_ISSUER,
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
| `issuer`         | string   | ✓         | URL del servidor Gate                        |
| `clientId`       | string   | ✓         | Client ID de la app                          |
| `redirectUri`    | string   | ✓         | URI de callback                              |
| `protectedPaths` | string[] |           | Rutas a proteger (default: `["/dashboard"]`) |
| `publicPaths`    | string[] |           | Rutas públicas dentro de protectedPaths      |
| `cookieName`     | string   |           | Nombre de la cookie (default: `"am25_sess"`) |

**Control de acceso:** El proxy verifica automáticamente que el usuario tenga acceso a la aplicación. Si el usuario no tiene permiso (configurado en Gate), retorna un error 403. Los administradores tienen acceso a todas las aplicaciones.

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

| Opción         | Tipo   | Requerido | Descripción                                      |
| -------------- | ------ | --------- | ------------------------------------------------ |
| `redirectUri`  | string | ✓         | URI de callback (para determinar origen de app)  |
| `issuer`       | string |           | URL del servidor Gate (habilita logout federado) |
| `cookieName`   | string |           | Nombre de la cookie                              |
| `cookieDomain` | string |           | Dominio de la cookie                             |
| `redirectTo`   | string |           | Ruta después del logout (default: `"/"`)         |

**Logout federado:** Si pasas `issuer`, el logout redirige a Gate para cerrar la sesión global, evitando re-login silencioso.

### `createSessionHelpers(options)`

Crea helpers para acceder a la sesión en Server Components.

| Opción       | Tipo   | Requerido | Descripción                                  |
| ------------ | ------ | --------- | -------------------------------------------- |
| `issuer`     | string | ✓         | URL del servidor Gate                        |
| `cookieName` | string |           | Nombre de la cookie (default: `"am25_sess"`) |

Retorna:

- `getSession()` - Payload raw del JWT (usa `session.sub` para el ID)
- `getUser()` - Datos del usuario formateados (usa `user.id` para el ID)
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

El objeto retornado por `getUser()` tiene esta estructura:

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

### Diferencia entre getSession y getUser

| Función        | Retorna                | ID del usuario  |
| -------------- | ---------------------- | --------------- |
| `getSession()` | Payload raw del JWT    | `session.sub`   |
| `getUser()`    | Objeto formateado      | `user.id`       |

**En Server Actions**, usa `getUser()` si necesitas `user.id`:

```js
import { getUser } from "@/lib/auth";

export async function createPost(data) {
  const user = await getUser();

  await prisma.post.create({
    data: {
      ...data,
      authorId: user.id  // ✅ correcto
    }
  });
}
```

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
         │                       │    (firmados RS256)   │
         │                       │ ─────────────────────>│
         │                       │                       │
         │ 7. Cookie httpOnly    │                       │
         │ <─────────────────────────────────────────────│
         │                       │                       │
         │ 8. Redirect a /dashboard                     │
         │    (ahora con cookie válida)                 │
         │                       │                       │
         │ 9. Verifica token     │                       │
         │    usando JWKS        │                       │
         │ ──────────────────────>                      │
         │                       │                       │
         │ 10. Retorna clave     │                       │
         │     pública (cached)  │                       │
         │ <──────────────────── │                       │
```

## Verificación de tokens (RS256)

El SDK verifica los tokens usando la clave pública de Gate, obtenida del endpoint JWKS:

```
GET https://gate.am25.app/.well-known/jwks.json
```

**Ventajas:**
- No necesitas compartir `JWT_SECRET` con las apps cliente
- Solo Gate tiene la clave privada (firma tokens)
- Las apps cliente solo necesitan la clave pública (verifica tokens)
- La clave pública se cachea automáticamente

## Cookies por dominio

Las apps comparten sesión por dominio:

- Apps en `*.am25.app` → cookie en `.am25.app`
- Apps en `*.lorem.com` → cookie en `.lorem.com`

Cada dominio tiene su propia sesión, no se cruzan.

## Control de acceso por aplicación

Gate permite configurar qué usuarios tienen acceso a cada aplicación. El proxy verifica automáticamente este permiso:

1. **Administradores**: Tienen acceso a todas las aplicaciones
2. **Usuarios normales**: Solo pueden acceder a las aplicaciones asignadas en Gate

Si un usuario sin acceso intenta entrar a una app protegida, el proxy lo redirige a `{issuer}/unauthorized` donde Gate muestra una página amigable de acceso denegado.

## API de Gate

### GET /api/users

Retorna la lista de usuarios registrados en Gate. Requiere autenticación.

> **Importante:** El formato de `roles` en este endpoint es diferente al de `getUser()`. Aquí viene la estructura completa de Prisma, mientras que `getUser()` retorna solo un array de strings con las keys.

**Respuesta:**

```json
[
  {
    "id": "cuid123",
    "email": "usuario@ejemplo.com",
    "name": "Juan",
    "lastName": "Pérez",
    "isAdmin": false,
    "roles": [
      {
        "role": {
          "id": "cuid456",
          "key": "editor",
          "name": "Editor"
        }
      }
    ],
    "clientAccess": [
      {
        "client": {
          "id": "cuid789",
          "clientId": "flowboard-client-id",
          "name": "Flowboard"
        }
      }
    ]
  }
]
```

**Extraer roles como array de strings (igual que getUser):**

```js
const userRoles = user.roles.map((r) => r.role.key);
// Resultado: ["editor"]
```

**Filtrar usuarios por acceso a una app:**

```js
const users = await fetch(`${GATE_ISSUER}/api/users`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const appClientId = process.env.GATE_CLIENT_ID;

const usersWithAccess = users.filter(
  (user) =>
    user.isAdmin ||
    user.clientAccess.some((access) => access.client.clientId === appClientId)
);
```

## Notas

- La cookie es `httpOnly` y `secure` en producción
- Los tokens se verifican usando JWKS (clave pública de Gate)
- Las funciones de sesión están cacheadas por request (React `cache()`)
- El JWKS se cachea en memoria para evitar llamadas repetidas
- El proxy retorna `null` para continuar, o `NextResponse` para redirigir
- El control de acceso se valida en cada request a rutas protegidas
