"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { configure, getConfig, getEndpoints } from "./lib/client.js";
import { generateCodeVerifier, generateCodeChallenge } from "./lib/pkce.js";
import {
  saveTokens,
  getTokens,
  clearTokens,
  saveVerifier,
  consumeVerifier,
  isTokenExpired,
  decodeToken,
} from "./lib/tokens.js";

const AuthContext = createContext(null);

export function AuthProvider({ children, config: configOptions }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Configurar el cliente al montar
  useEffect(() => {
    configure(configOptions);
  }, [configOptions]);

  // Verificar tokens existentes y manejar callback
  useEffect(() => {
    async function init() {
      const config = getConfig();
      const endpoints = getEndpoints();

      // Verificar si estamos en el callback
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (code) {
        try {
          const verifier = consumeVerifier();
          if (!verifier) {
            throw new Error("No code verifier found");
          }

          // Intercambiar code por tokens
          const response = await fetch(endpoints.token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: config.redirectUri,
              client_id: config.clientId,
              client_secret: config.clientSecret,
              code_verifier: verifier,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || "Token exchange failed");
          }

          const tokens = await response.json();
          saveTokens(tokens);

          // Limpiar URL
          window.history.replaceState({}, "", window.location.pathname);

          // Obtener usuario
          const userInfo = await fetchUserInfo(tokens.access_token, endpoints);
          setUser(userInfo);
          setIsAuthenticated(true);
        } catch (err) {
          setError(err.message);
          clearTokens();
        }
      } else {
        // Verificar tokens existentes
        const tokens = getTokens();
        if (tokens && !isTokenExpired(tokens)) {
          try {
            const userInfo = await fetchUserInfo(tokens.access_token, endpoints);
            setUser(userInfo);
            setIsAuthenticated(true);
          } catch {
            clearTokens();
          }
        }
      }

      setIsLoading(false);
    }

    init();
  }, []);

  // Función para obtener info del usuario
  async function fetchUserInfo(accessToken, endpoints) {
    const response = await fetch(endpoints.userinfo, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    return response.json();
  }

  // Iniciar flujo de login
  const login = useCallback(async () => {
    const config = getConfig();
    const endpoints = getEndpoints();

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateCodeVerifier(); // Usar como state también

    saveVerifier(verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    window.location.href = `${endpoints.authorize}?${params}`;
  }, []);

  // Cerrar sesión
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Obtener access token actual
  const getAccessToken = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens) return null;

    if (isTokenExpired(tokens)) {
      // Intentar refresh
      if (tokens.refresh_token) {
        try {
          const config = getConfig();
          const endpoints = getEndpoints();

          const response = await fetch(endpoints.token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: tokens.refresh_token,
              client_id: config.clientId,
              client_secret: config.clientSecret,
            }),
          });

          if (response.ok) {
            const newTokens = await response.json();
            saveTokens(newTokens);
            return newTokens.access_token;
          }
        } catch {
          // Refresh falló
        }
      }

      // No se pudo refrescar
      logout();
      return null;
    }

    return tokens.access_token;
  }, [logout]);

  const value = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}
