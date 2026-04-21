const DEFAULT_COGNITO_AUTHORITY = 'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_e3giVfjQy';
const DEFAULT_COGNITO_CLIENT_ID = '6lsst47elspoa8elmdbo8dear9';
const DEFAULT_REDIRECT_URI = 'https://nexsite.fr';
const DEFAULT_COGNITO_DOMAIN = 'https://eu-west-1e3givfjqy.auth.eu-west-1.amazoncognito.com';

export const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY || DEFAULT_COGNITO_AUTHORITY,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || DEFAULT_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || DEFAULT_REDIRECT_URI,
  postLogoutRedirectUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || DEFAULT_REDIRECT_URI,
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || DEFAULT_COGNITO_DOMAIN,
  adminGroup: import.meta.env.VITE_COGNITO_ADMIN_GROUP || 'pdfme-admins',
  responseType: 'code',
  scope: import.meta.env.VITE_COGNITO_SCOPE || 'aws.cognito.signin.user.admin openid profile',
};

export function buildCognitoLogoutUrl() {
  const params = new URLSearchParams({
    client_id: cognitoAuthConfig.clientId,
    logout_uri: cognitoAuthConfig.postLogoutRedirectUri,
  });
  return `${cognitoAuthConfig.cognitoDomain}/logout?${params.toString()}`;
}
