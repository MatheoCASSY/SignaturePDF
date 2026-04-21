import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { buildCognitoLogoutUrl, cognitoAuthConfig } from '../config/auth';

const oidcManager = new UserManager({
  authority: cognitoAuthConfig.authority,
  client_id: cognitoAuthConfig.clientId,
  redirect_uri: cognitoAuthConfig.redirectUri,
  response_type: cognitoAuthConfig.responseType,
  scope: cognitoAuthConfig.scope,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  post_logout_redirect_uri: cognitoAuthConfig.postLogoutRedirectUri,
  monitorSession: false,
  automaticSilentRenew: false,
});

function hasSigninCallbackParams() {
  const query = new URLSearchParams(window.location.search);
  return query.has('code') && query.has('state');
}

function normalizeReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/login';
  if (!value.startsWith('/')) return '/login';
  return value;
}

function isAdminProfile(profile: Record<string, unknown> | undefined) {
  if (!profile) return false;

  const groups = Array.isArray(profile['cognito:groups']) ? profile['cognito:groups'].map((value) => String(value).toLowerCase()) : [];
  const customRole = String(profile['custom:role'] || '').toLowerCase();
  const adminGroup = String(cognitoAuthConfig.adminGroup || 'pdfme-admins').toLowerCase();

  return groups.includes(adminGroup) || customRole === 'admin' || customRole === 'administrator';
}

export async function hydrateAuthSession() {
  if (hasSigninCallbackParams()) {
    const user = await oidcManager.signinCallback();
    const target = normalizeReturnTo(user.state?.returnTo);
    history.replaceState({}, '', target);
    return user;
  }

  return oidcManager.getUser();
}

export async function getStoredAuthSession() {
  return oidcManager.getUser();
}

export async function startSigninRedirect() {
  await oidcManager.signinRedirect({
    state: {
      returnTo: `${window.location.pathname}${window.location.search || ''}`,
    },
  });
}

export async function clearOidcSession() {
  await oidcManager.removeUser();
}

export function startCognitoLogoutRedirect() {
  window.location.href = buildCognitoLogoutUrl();
}

export function toAuthSnapshot(user: User | null) {
  const profile = (user?.profile || undefined) as Record<string, unknown> | undefined;
  return {
    isAuthenticated: Boolean(user && !user.expired),
    isAdmin: isAdminProfile(profile),
    email: String(profile?.email || profile?.['cognito:username'] || ''),
    expiresAt: typeof user?.expires_at === 'number' ? user.expires_at : null,
    accessToken: user?.access_token || '',
    idToken: user?.id_token || '',
    refreshToken: user?.refresh_token || '',
  };
}
