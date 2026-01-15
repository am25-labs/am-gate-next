# @am25/gate-client

SDK de autenticación OAuth2 para integrar aplicaciones Next.js con AM25 Gate.

## Instalación

```bash
pnpm add @am25/gate-client
```

## Configuración

### 1. Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_GATE_URL=https://gate.am25.app
NEXT_PUBLIC_GATE_CLIENT_ID=tu-client-id
GATE_CLIENT_SECRET=tu-client-secret
```

### 2. Configurar AuthProvider

En `app/layout.jsx`:

```jsx
import { AuthProvider } from "@am25/gate-client";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider
          config={{
            issuer: process.env.NEXT_PUBLIC_GATE_URL,
            clientId: process.env.NEXT_PUBLIC_GATE_CLIENT_ID,
            clientSecret: process.env.GATE_CLIENT_SECRET,
            redirectUri: process.env.BASE_URL + "/callback",
            scopes: ["openid", "profile", "email"],
          }}
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 3. Crear página de callback

Crear `app/callback/page.jsx`:

```jsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@am25/gate-client";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  return <div>Autenticando...</div>;
}
```

## Uso

### Hooks disponibles

#### useAuth()

```jsx
"use client";

import { useAuth } from "@am25/gate-client";

function MiComponente() {
  const {
    isAuthenticated, // boolean - si el usuario está autenticado
    isLoading, // boolean - si está verificando la sesión
    user, // object - datos del usuario (sub, email, name, etc.)
    error, // string - mensaje de error si hubo uno
    login, // function - inicia el flujo OAuth
    logout, // function - cierra la sesión
    getAccessToken, // function - obtiene el access_token actual
  } = useAuth();
}
```

#### useUser()

```jsx
"use client";

import { useUser } from "@am25/gate-client";

function MiComponente() {
  const { user, isLoading } = useUser();

  if (isLoading) return <span>Cargando...</span>;
  if (!user) return <span>No autenticado</span>;

  return <span>Hola, {user.name}</span>;
}
```

### Ejemplo: Botón de login/logout

```jsx
"use client";

import { useAuth, useUser } from "@am25/gate-client";

export function AuthButton() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();
  const { user } = useUser();

  if (isLoading) {
    return <button disabled>Cargando...</button>;
  }

  if (isAuthenticated) {
    return (
      <div>
        <span>{user?.name || user?.email}</span>
        <button onClick={logout}>Cerrar sesión</button>
      </div>
    );
  }

  return <button onClick={login}>Iniciar sesión</button>;
}
```

### Ejemplo: Llamada a API protegida

```jsx
"use client";

import { useAuth } from "@am25/gate-client";

function MiComponente() {
  const { getAccessToken } = useAuth();

  async function fetchData() {
    const token = await getAccessToken();

    const response = await fetch("https://api.ejemplo.com/datos", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  }
}
```

## Middleware (opcional)

Para proteger rutas a nivel de servidor, crear `middleware.js` en la raíz:

```js
import { withAuth } from "@am25/gate-client/middleware";

export default withAuth({
  protectedPaths: ["/dashboard", "/settings", "/admin"],
  loginPath: "/login",
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## Datos del usuario

Después de autenticarse, el objeto `user` contiene:

```js
{
  sub: "user-id",           // ID único del usuario
  email: "user@email.com",  // Email
  name: "Nombre",           // Nombre (si está disponible)
  family_name: "Apellido",  // Apellido (si está disponible)
}
```

## Flujo de autenticación

1. Usuario hace clic en "Iniciar sesión" → `login()`
2. Se genera PKCE (code_verifier + code_challenge)
3. Redirección a Gate `/oauth/authorize`
4. Usuario inicia sesión en Gate (si no tiene sesión)
5. Gate redirige a `/callback?code=...`
6. El SDK intercambia el code por tokens
7. Tokens se guardan en sessionStorage
8. Usuario queda autenticado

## Notas

- Los tokens se almacenan en `sessionStorage` (se pierden al cerrar el navegador)
- El SDK maneja automáticamente el refresh de tokens expirados
- PKCE (S256) es obligatorio y se genera automáticamente
