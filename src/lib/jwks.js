import { createRemoteJWKSet, jwtVerify } from "jose";

// JWKS cache by issuer
const jwksCache = new Map();

/**
 * Gets the remote JWKS with cache
 * @param {string} issuer - URL of the Gate server
 * @returns {Object} Remote JWKS
 */
function getJWKS(issuer) {
  const jwksUri = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;

  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, createRemoteJWKSet(new URL(jwksUri)));
  }

  return jwksCache.get(jwksUri);
}

/**
 * Verifies a JWT using the remote JWKS
 * @param {string} token - JWT to verify
 * @param {string} issuer - URL of the Gate server
 * @param {string} [expectedTyp] - Expected type of the token (e.g., "at+jwt", "st+jwt")
 * @returns {Promise<Object>} Payload of the token
 */
export async function verifyTokenWithJWKS(token, issuer, expectedTyp) {
  const JWKS = getJWKS(issuer);
  const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
    issuer: issuer.replace(/\/$/, ""),
  });
  if (expectedTyp && protectedHeader.typ !== expectedTyp) {
    throw new Error(
      `Expected token type ${expectedTyp}, got ${protectedHeader.typ}`,
    );
  }
  return payload;
}

/**
 * Clear the JWKS cache (useful if keys rotate)
 * @param {string} issuer - URL of the Gate server (optional, if not passed clears all)
 */
export function clearJWKSCache(issuer) {
  if (issuer) {
    const jwksUri = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    jwksCache.delete(jwksUri);
  } else {
    jwksCache.clear();
  }
}
