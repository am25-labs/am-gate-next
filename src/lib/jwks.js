import { createRemoteJWKSet, jwtVerify } from "jose";

// Cache de JWKS por issuer
const jwksCache = new Map();

/**
 * Obtiene el JWKS remoto con cache
 * @param {string} issuer - URL del servidor Gate
 */
function getJWKS(issuer) {
  const jwksUri = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;

  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, createRemoteJWKSet(new URL(jwksUri)));
  }

  return jwksCache.get(jwksUri);
}

/**
 * Verifica un JWT usando JWKS remoto
 * @param {string} token - JWT a verificar
 * @param {string} issuer - URL del servidor Gate
 * @param {string} [expectedTyp] - Tipo esperado del token (ej: "at+jwt", "st+jwt")
 * @returns {Promise<Object>} Payload del token
 */
export async function verifyTokenWithJWKS(token, issuer, expectedTyp) {
  const JWKS = getJWKS(issuer);
  const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
    issuer: issuer.replace(/\/$/, ""),
  });
  if (expectedTyp && protectedHeader.typ !== expectedTyp) {
    throw new Error(
      `Expected token type ${expectedTyp}, got ${protectedHeader.typ}`
    );
  }
  return payload;
}

/**
 * Limpia el cache de JWKS (útil si las claves rotan)
 * @param {string} issuer - URL del servidor Gate (opcional, si no se pasa limpia todo)
 */
export function clearJWKSCache(issuer) {
  if (issuer) {
    const jwksUri = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    jwksCache.delete(jwksUri);
  } else {
    jwksCache.clear();
  }
}
