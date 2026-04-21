const DEFAULT_COGNITO_AUTHORITY = 'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_e3giVfjQy';
const DEFAULT_COGNITO_CLIENT_ID = '6lsst47elspoa8elmdbo8dear9';
const DEFAULT_REDIRECT_URIS = ['https://nexsite.fr', 'https://pdfme.nexsite.fr'];
const DEFAULT_COGNITO_DOMAIN = 'https://eu-west-1e3givfjqy.auth.eu-west-1.amazoncognito.com';
const DEFAULT_COGNITO_SCOPE = 'openid profile email';

function parseAllowedUrls(value: unknown, fallback: string[]) {
  if (typeof value !== 'string' || !value.trim()) return fallback;

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pickCurrentUrl(candidates: string[]) {
  if (typeof window === 'undefined') return candidates[0] || '';

  const currentOrigin = window.location.origin;
  const matching = candidates.find((candidate) => candidate === currentOrigin);
  if (matching) return matching;

  return candidates[0] || currentOrigin;
}

const allowedRedirectUris = parseAllowedUrls(import.meta.env.VITE_COGNITO_REDIRECT_URIS, DEFAULT_REDIRECT_URIS);
const allowedLogoutUris = parseAllowedUrls(import.meta.env.VITE_COGNITO_LOGOUT_URIS, allowedRedirectUris);

export const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY || DEFAULT_COGNITO_AUTHORITY,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || DEFAULT_COGNITO_CLIENT_ID,
  redirectUri: pickCurrentUrl(allowedRedirectUris),
  postLogoutRedirectUri: pickCurrentUrl(allowedLogoutUris),
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || DEFAULT_COGNITO_DOMAIN,
  adminGroup: import.meta.env.VITE_COGNITO_ADMIN_GROUP || 'pdfme-admins',
  responseType: 'code',
  scope: DEFAULT_COGNITO_SCOPE,
};

export function buildCognitoLogoutUrl() {
  const params = new URLSearchParams({
    client_id: cognitoAuthConfig.clientId,
    logout_uri: cognitoAuthConfig.postLogoutRedirectUri,
  });
  return `${cognitoAuthConfig.cognitoDomain}/logout?${params.toString()}`;
}
