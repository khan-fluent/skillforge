/**
 * OIDC (OpenID Connect) Authentication Service
 *
 * Implements Authorization Code flow. Works with any OIDC-compliant IdP:
 * Okta, Azure AD, Google Workspace, Auth0, Keycloak, etc.
 *
 * Env vars:
 *   OIDC_ISSUER_URL    — IdP issuer (e.g. https://accounts.google.com,
 *                         https://login.microsoftonline.com/{tenant}/v2.0)
 *   OIDC_CLIENT_ID     — OAuth client ID
 *   OIDC_CLIENT_SECRET — OAuth client secret
 *   OIDC_REDIRECT_URI  — Callback URL (e.g. https://skillforge.example.com/api/auth/sso/callback)
 *   OIDC_SCOPES        — Optional, space-separated (default: "openid email profile")
 *
 * Install:  npm install openid-client
 */

import crypto from "crypto";

let _client = null;
let _config = null;

async function getClient() {
  if (_client) return _client;

  let discovery;
  try {
    ({ discovery } = await import("openid-client"));
  } catch {
    throw new Error(
      'OIDC provider requires the "openid-client" package. Run: npm install openid-client'
    );
  }

  _config = {
    issuer: process.env.OIDC_ISSUER_URL,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri: process.env.OIDC_REDIRECT_URI,
    scopes: process.env.OIDC_SCOPES || "openid email profile",
  };

  if (!_config.issuer || !_config.clientId || !_config.clientSecret || !_config.redirectUri) {
    throw new Error(
      "OIDC requires OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI."
    );
  }

  _client = await discovery(new URL(_config.issuer), _config.clientId, _config.clientSecret);
  return _client;
}

// In-memory store for OIDC state + nonce (short-lived, keyed by state).
// Production at scale: use Redis or a DB table. For single-instance ECS this is fine.
const pending = new Map();
const PENDING_TTL = 300_000; // 5 minutes

/**
 * Build the authorization URL and return it along with the state param.
 * The caller should store `state` in a cookie or session, then redirect the user.
 */
export async function getAuthorizationUrl() {
  const client = await getClient();

  const state = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  pending.set(state, { nonce, codeVerifier, createdAt: Date.now() });

  // Garbage-collect expired entries
  for (const [k, v] of pending) {
    if (Date.now() - v.createdAt > PENDING_TTL) pending.delete(k);
  }

  const params = {
    redirect_uri: _config.redirectUri,
    scope: _config.scopes,
    state,
    nonce,
    code_challenge: codeVerifier,
    code_challenge_method: "S256",
  };

  const url = client.buildAuthorizationUrl(params);
  return { url: url.href, state };
}

/**
 * Exchange the authorization code for tokens and extract user claims.
 * Returns { email, name, subject, provider: "oidc" }.
 */
export async function handleCallback(callbackUrl, state) {
  const client = await getClient();

  const entry = pending.get(state);
  if (!entry) throw new Error("Invalid or expired SSO state. Please try again.");
  pending.delete(state);

  const tokens = await client.authorizationCodeGrant(
    new URL(_config.redirectUri),
    new URLSearchParams(new URL(callbackUrl).search),
    {
      expectedState: state,
      expectedNonce: entry.nonce,
      pkceCodeVerifier: entry.codeVerifier,
    }
  );

  const claims = tokens.claims();

  return {
    email: claims.email,
    name: claims.name || claims.preferred_username || claims.email.split("@")[0],
    subject: claims.sub,
    provider: "oidc",
  };
}
