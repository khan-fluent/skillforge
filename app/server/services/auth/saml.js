/**
 * SAML 2.0 Authentication Service
 *
 * SP-initiated SSO flow for enterprise IdPs (ADFS, Okta SAML, Shibboleth, etc.)
 *
 * Env vars:
 *   SAML_ENTRY_POINT  — IdP SSO URL (e.g. https://idp.example.com/sso/saml)
 *   SAML_ISSUER       — SP entity ID (e.g. "skillforge" or your app URL)
 *   SAML_CALLBACK_URL — ACS URL (e.g. https://skillforge.example.com/api/auth/sso/callback)
 *   SAML_CERT         — IdP's public signing certificate (PEM, newlines replaced with \n)
 *
 * Install:  npm install @node-saml/node-saml
 */

let _saml = null;

async function getSaml() {
  if (_saml) return _saml;

  let SAML;
  try {
    ({ SAML } = await import("@node-saml/node-saml"));
  } catch {
    throw new Error(
      'SAML provider requires "@node-saml/node-saml". Run: npm install @node-saml/node-saml'
    );
  }

  const entryPoint = process.env.SAML_ENTRY_POINT;
  const issuer = process.env.SAML_ISSUER;
  const callbackUrl = process.env.SAML_CALLBACK_URL;
  const cert = process.env.SAML_CERT;

  if (!entryPoint || !issuer || !callbackUrl || !cert) {
    throw new Error(
      "SAML requires SAML_ENTRY_POINT, SAML_ISSUER, SAML_CALLBACK_URL, and SAML_CERT."
    );
  }

  _saml = new SAML({
    entryPoint,
    issuer,
    callbackUrl,
    cert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
  });

  return _saml;
}

/**
 * Build the SAML AuthnRequest redirect URL.
 */
export async function getAuthorizationUrl() {
  const saml = await getSaml();
  const url = await saml.getAuthorizeUrlAsync("", undefined, {});
  return { url, state: null };
}

/**
 * Validate the SAML assertion from the IdP POST callback.
 * Returns { email, name, subject, provider: "saml" }.
 */
export async function handleCallback(body) {
  const saml = await getSaml();
  const { profile } = await saml.validatePostResponseAsync(body);

  if (!profile) throw new Error("SAML assertion validation failed.");

  const email =
    profile.email ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    profile.nameID;

  const name =
    profile.displayName ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
    profile.firstName ||
    email.split("@")[0];

  return {
    email,
    name,
    subject: profile.nameID || profile.issuer,
    provider: "saml",
  };
}
