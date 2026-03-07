# @am25/gate-client

SDK server-side para integrar aplicaciones Next.js 16+ con [AM25 Gate](https://gate.am25.app), un Identity Provider compatible con OAuth 2.0 y OpenID Connect.

## Caracteristicas

- 100% Server-Side: Sin AuthProvider, sin CSR forzado
- OAuth 2.0 + OIDC: Authorization Code flow con soporte completo de scopes
- Proxy para Next.js 16: Proteccion de rutas a nivel servidor
- Cookie httpOnly: Sesion segura compartida por dominio (`.am25.app`)
- Helpers React: Funciones cacheadas para Server Components
- RS256 (JWKS): Verificacion de tokens con clave publica, sin compartir secrets
- Roles y permisos: Acceso a roles del usuario via scope `roles`

## Instalacion

```bash
pnpm add @am25/gate-client
```

## Requisitos

- Next.js 16+
- React 19+
- Una app registrada como cliente OAuth en Gate

## Configuracion

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

# Para componentes client-side (LoginButton)
NEXT_PUBLIC_GATE_ISSUER=https://gate.am25.app
NEXT_PUBLIC_GATE_CLIENT_ID=tu-client-id
NEXT_PUBLIC_GATE_REDIRECT_URI=https://miapp.am25.app/api/auth/callback
```

No necesitas `JWT_SECRET`. Los tokens se verifican usando la clave publica de Gate (JWKS).

### 2. Crear API Routes

#### `/api/auth/callback/route.js`

Intercambia el authorization code por tokens y setea la cookie de sesion.

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

Borra la cookie local y opcionalmente cierra la sesion en Gate (logout federado).

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

### 3. Configurar Proxy (Next.js 16)

El proxy protege rutas verificando la cookie de sesion. Si no hay sesion valida, redirige al usuario a Gate para autenticarse.

Crear `src/proxy.js`:

```js
import { createGateProxy } from "@am25/gate-client";

const gateProxy = createGateProxy({
  issuer: process.env.GATE_ISSUER,
  clientId: process.env.GATE_CLIENT_ID,
  redirectUri: process.env.GATE_REDIRECT_URI,
  protectedPaths: ["/dashboard", "/settings"],
  publicPaths: ["/dashboard/public"],
  // scopes: ["openid", "profile", "email", "roles"], // opcional
});

export async function proxy(request) {
  return gateProxy(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
```

### 4. Crear helpers de sesion

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
});
```

## Uso

### En Server Components

```jsx
import { getUser, requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

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

Los roles solo estan disponibles si el token fue emitido con el scope `roles`. Configura el scope en el proxy o en `getLoginUrl`.

```jsx
import { requireRole, hasRole } from "@/lib/auth";

export default async function EditorPage() {
  // Opcion 1: Requerir rol (lanza error si no tiene)
  await requireRole("editor");

  // Opcion 2: Verificar rol sin lanzar error
  const canPublish = await hasRole("publisher");

  return <div>...</div>;
}
```

### En Server Actions

```js
import { getUser } from "@/lib/auth";

export async function createPost(data) {
  const user = await getUser();
  if (!user) throw new Error("No autenticado");

  await prisma.post.create({
    data: {
      ...data,
      authorId: user.id,
    },
  });
}
```

### Boton de login (Client Component)

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
      // scopes: ["openid", "profile", "email", "roles"],
    });
    window.location.href = url;
  };

  return <button onClick={handleLogin}>Iniciar sesion</button>;
}
```

### Enlace de logout

```jsx
export function LogoutButton() {
  return <a href="/api/auth/logout">Cerrar sesion</a>;
}
```

## Scopes

Gate soporta los siguientes scopes OIDC:

| Scope     | Claims incluidos en el token                |
| --------- | ------------------------------------------- |
| `openid`  | `sub` (requerido para OIDC)                 |
| `profile` | `name`, `lastName`                          |
| `email`   | `email`                                     |
| `roles`   | `{issuer}/is_admin`, `{issuer}/roles`       |

El scope por defecto es `openid profile email`. Si necesitas roles, agrega `roles`:

```js
scopes: ["openid", "profile", "email", "roles"]
```

Los claims de roles usan namespace URI para compatibilidad con el estandar OIDC. El SDK los resuelve automaticamente en `getUser()`.

## Datos del usuario

El objeto retornado por `getUser()`:

```js
{
  id: "user-id",           // sub del JWT
  email: "user@email.com", // requiere scope "email"
  name: "Nombre",          // requiere scope "profile"
  lastName: "Apellido",    // requiere scope "profile"
  isAdmin: false,          // requiere scope "roles" (default: false)
  roles: ["editor"],       // requiere scope "roles" (default: [])
}
```

### Diferencia entre getSession y getUser

| Funcion        | Retorna              | ID del usuario | Uso recomendado     |
| -------------- | -------------------- | -------------- | ------------------- |
| `getSession()` | Payload raw del JWT  | `session.sub`  | Acceso a claims raw |
| `getUser()`    | Objeto formateado    | `user.id`      | Logica de negocio   |

Usa `getUser()` para logica de negocio. Usa `getSession()` solo si necesitas acceso directo a los claims del JWT.

## API Reference

### `createGateProxy(options)`

Crea un proxy para proteger rutas en Next.js 16.

| Opcion           | Tipo     | Requerido | Default                          | Descripcion                              |
| ---------------- | -------- | --------- | -------------------------------- | ---------------------------------------- |
| `issuer`         | string   | Si        |                                  | URL del servidor Gate                    |
| `clientId`       | string   | Si        |                                  | Client ID de la app                      |
| `redirectUri`    | string   | Si        |                                  | URI de callback                          |
| `protectedPaths` | string[] | No        | `["/dashboard"]`                 | Rutas a proteger                         |
| `publicPaths`    | string[] | No        | `[]`                             | Rutas publicas dentro de protectedPaths  |
| `cookieName`     | string   | No        | `"am25_sess"`                    | Nombre de la cookie                      |
| `scopes`         | string[] | No        | `["openid", "profile", "email"]` | Scopes a solicitar en el redirect        |

Retorna `null` si la ruta no necesita proteccion o la sesion es valida. Retorna `NextResponse.redirect` si necesita autenticacion.

### `createCallbackHandler(options)`

Crea el handler para intercambiar el authorization code por tokens.

| Opcion            | Tipo   | Requerido | Default         | Descripcion                               |
| ----------------- | ------ | --------- | --------------- | ----------------------------------------- |
| `issuer`          | string | Si        |                 | URL del servidor Gate                     |
| `clientId`        | string | Si        |                 | Client ID                                 |
| `clientSecret`    | string | Si        |                 | Client Secret                             |
| `redirectUri`     | string | Si        |                 | URI de callback (debe coincidir con Gate) |
| `cookieName`      | string | No        | `"am25_sess"`   | Nombre de la cookie                       |
| `cookieDomain`    | string | No        |                 | Dominio de la cookie (ej: `.am25.app`)    |
| `cookieMaxAge`    | number | No        | `2592000` (30d) | Duracion en segundos                      |
| `defaultRedirect` | string | No        | `"/dashboard"`  | Ruta despues del login                    |

El handler almacena el `session_token` (o `access_token` como fallback) en una cookie httpOnly.

### `createLogoutHandler(options)`

Crea el handler para cerrar sesion.

| Opcion         | Tipo   | Requerido | Default       | Descripcion                                     |
| -------------- | ------ | --------- | ------------- | ----------------------------------------------- |
| `redirectUri`  | string | Si        |               | URI de callback (para determinar origen de app) |
| `issuer`       | string | No        |               | URL de Gate (habilita logout federado)          |
| `cookieName`   | string | No        | `"am25_sess"` | Nombre de la cookie                             |
| `cookieDomain` | string | No        |               | Dominio de la cookie                            |
| `redirectTo`   | string | No        | `"/"`         | Ruta despues del logout                         |

**Logout federado:** Si pasas `issuer`, el logout redirige a Gate para cerrar la sesion global del usuario en todas las apps. Si no lo pasas, solo borra la cookie local.

### `createSessionHelpers(options)`

Crea helpers para acceder a la sesion en Server Components.

| Opcion       | Tipo   | Requerido | Default       | Descripcion           |
| ------------ | ------ | --------- | ------------- | --------------------- |
| `issuer`     | string | Si        |               | URL del servidor Gate |
| `cookieName` | string | No        | `"am25_sess"` | Nombre de la cookie   |

Retorna:

| Helper                 | Retorna          | Descripcion                                       |
| ---------------------- | ---------------- | ------------------------------------------------- |
| `getSession()`         | `Object \| null` | Payload raw del JWT                               |
| `getUser()`            | `Object \| null` | Datos del usuario formateados                     |
| `isAuthenticated()`    | `boolean`        | Si hay sesion activa                              |
| `requireAuth()`        | `Object`         | Datos del usuario, lanza error si no autenticado  |
| `requireAdmin()`       | `Object`         | Datos del usuario, lanza error si no es admin     |
| `hasRole(roleKey)`     | `boolean`        | Verifica si tiene un rol                          |
| `requireRole(roleKey)` | `Object`         | Datos del usuario, lanza error si no tiene el rol |

Todas las funciones estan cacheadas por request usando `React.cache()`.

### `getLoginUrl(options)`

Genera la URL para iniciar el flujo OAuth.

| Opcion        | Tipo     | Requerido | Default                          | Descripcion                            |
| ------------- | -------- | --------- | -------------------------------- | -------------------------------------- |
| `issuer`      | string   | Si        |                                  | URL del servidor Gate                  |
| `clientId`    | string   | Si        |                                  | Client ID                              |
| `redirectUri` | string   | Si        |                                  | URI de callback                        |
| `scopes`      | string[] | No        | `["openid", "profile", "email"]` | Scopes a solicitar                     |
| `returnTo`    | string   | No        |                                  | Ruta a la que volver despues del login |

### `getLogoutUrl(options)`

Genera la URL para el endpoint de logout local.

| Opcion           | Tipo   | Requerido | Default              | Descripcion                |
| ---------------- | ------ | --------- | -------------------- | -------------------------- |
| `logoutEndpoint` | string | No        | `"/api/auth/logout"` | Ruta del handler de logout |
| `returnTo`       | string | No        |                      | URL despues del logout     |

### `createAuthConfig(config)`

Crea una configuracion reutilizable que encapsula `getLoginUrl` y `getLogoutUrl`.

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

Verifica un JWT usando la clave publica de Gate (JWKS). Usado internamente por el SDK, pero disponible para verificacion manual.

| Parametro     | Tipo   | Requerido | Descripcion                                            |
| ------------- | ------ | --------- | ------------------------------------------------------ |
| `token`       | string | Si        | JWT a verificar                                        |
| `issuer`      | string | Si        | URL del servidor Gate                                  |
| `expectedTyp` | string | No        | Tipo esperado del header (ej: `"st+jwt"`, `"at+jwt"`) |

### `clearJWKSCache(issuer)`

Limpia el cache de claves publicas JWKS. Util si Gate rota sus claves.

| Parametro | Tipo   | Requerido | Descripcion                              |
| --------- | ------ | --------- | ---------------------------------------- |
| `issuer`  | string | No        | URL del issuer. Si se omite, limpia todo |

## Flujo de autenticacion

```
Usuario          App (proxy)              Gate (IdP)           App (callback)
  |                  |                       |                      |
  | GET /dashboard   |                       |                      |
  | ---------------> |                       |                      |
  |                  |                       |                      |
  |                  | Sin cookie valida     |                      |
  |                  | Redirect a Gate       |                      |
  | <--------------- |                       |                      |
  |                  |                       |                      |
  | Login en Gate                            |                      |
  | ---------------------------------------->|                      |
  |                  |                       |                      |
  | Redirect con authorization code         |                      |
  | <----------------------------------------|                      |
  |                  |                       |                      |
  | GET /api/auth/callback?code=xxx                                |
  | -------------------------------------------------------------->|
  |                  |                       |                      |
  |                  |                       | POST /oauth/token    |
  |                  |                       |<---------------------|
  |                  |                       |                      |
  |                  |                       | Retorna tokens       |
  |                  |                       |--------------------->|
  |                  |                       |                      |
  | Set-Cookie: am25_sess (httpOnly, RS256)                        |
  | <--------------------------------------------------------------|
  |                  |                       |                      |
  | Redirect a /dashboard                                          |
  | ---------------> |                       |                      |
  |                  |                       |                      |
  |                  | Verifica token (JWKS) |                      |
  |                  | --------------------->|                      |
  |                  |                       |                      |
  |                  | Clave publica (cache) |                      |
  |                  | <---------------------|                      |
  |                  |                       |                      |
  | Pagina OK        |                       |                      |
  | <--------------- |                       |                      |
```

## Verificacion de tokens (RS256)

El SDK verifica los tokens usando la clave publica de Gate obtenida del endpoint JWKS:

```
GET {issuer}/.well-known/jwks.json
```

- Solo Gate tiene la clave privada (firma tokens)
- Las apps solo necesitan la clave publica (verifica tokens)
- La clave publica se cachea automaticamente en memoria

## Cookies por dominio

Las apps comparten sesion por dominio:

- Apps en `*.am25.app` -> cookie en `.am25.app`
- Apps en `*.ejemplo.com` -> cookie en `.ejemplo.com`

Cada dominio tiene su propia sesion, no se cruzan.

## Control de acceso

Gate gestiona el acceso a dos niveles:

**Por aplicacion:** En el dashboard de Gate se configura que usuarios pueden acceder a cada app. Los administradores tienen acceso automatico a todas. Si un usuario no autorizado intenta autenticarse, Gate retorna error 403.

**Por rol (dentro de la app):** Los roles viajan como claims en el token cuando se solicita el scope `roles`. Cada app decide como usarlos internamente (ej: mostrar/ocultar funcionalidad, proteger rutas).

## Clientes internos vs terceros

Gate distingue dos tipos de clientes OAuth:

| Tipo                    | Consentimiento       | Caso de uso                        |
| ----------------------- | -------------------- | ---------------------------------- |
| **Interno** (first-party)  | No, auto-aprobado    | Apps del ecosistema AM25           |
| **Tercero** (third-party)  | Si, pantalla consent | Apps externas que integren Gate    |

Se configura en el dashboard de Gate al crear o editar un cliente.

## Migracion desde v1.x

### Breaking changes en v2.0

1. **Scopes configurables:** El proxy y `getLoginUrl` aceptan un parametro `scopes`. El default es `["openid", "profile", "email"]`. Si necesitas roles, agrega `"roles"` explicitamente.

2. **Claims con namespace:** Los claims `isAdmin` y `roles` usan namespace URI en el token raw (`{issuer}/is_admin`, `{issuer}/roles`). `getUser()` los resuelve automaticamente, pero si usas `getSession()` debes actualizar:

   ```js
   // v1.x
   session.isAdmin
   session.roles

   // v2.0 (claims raw)
   session["https://gate.am25.app/is_admin"]
   session["https://gate.am25.app/roles"]

   // Recomendado: usa getUser()
   const user = await getUser();
   user.isAdmin  // resuelto automaticamente
   user.roles    // resuelto automaticamente
   ```

3. **Sin allowedClients:** Los tokens ya no incluyen `allowedClients`. El control de acceso se verifica en Gate durante `/oauth/authorize`, no en el token.

## Compatibilidad con librerias estandar

Gate es un Identity Provider compatible con OAuth 2.0 y OpenID Connect. Ademas de este SDK, puedes integrarlo con cualquier libreria que soporte OIDC Discovery:

```
Discovery: {issuer}/.well-known/openid-configuration
JWKS:      {issuer}/.well-known/jwks.json
```
