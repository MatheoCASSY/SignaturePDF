import type { AuthViewState, RouteName } from '../types/app';

export function renderHeader(route: RouteName, pageCount: number, fieldCount: number, auth: AuthViewState) {
  const routeLabel = route === 'login' ? 'Connexion' : route === 'admin' ? 'Administration' : 'Signature';
  const authLabel = auth.isLoading
    ? 'Connexion...'
    : auth.isAuthenticated
      ? auth.email || (auth.isAdmin ? 'Admin' : 'Connecte')
      : 'Non connecte';
  const expiresAtLabel =
    auth.isAuthenticated && auth.expiresAt
      ? `Expire ${new Date(auth.expiresAt * 1000).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
      : auth.isAuthenticated
        ? 'Expiration inconnue'
        : 'Pas de session';
  const authAction = auth.isAuthenticated
    ? '<button class="ghost-button" data-action="auth-refresh">Rafraichir session</button><button class="ghost-button" data-action="auth-signout">Se deconnecter</button>'
    : '<button class="ghost-button" data-action="auth-signin">Se connecter</button>';

  return `
    <header class="topbar panel">
      <div class="brand">
        <span class="brand-mark">FR</span>
        <div>
          <p class="eyebrow">pdfme studio</p>
          <h1>Studio signature</h1>
          <p class="brand-subtitle">Connexion, préparation des documents, puis signature dans un flux simple.</p>
        </div>
      </div>

      <nav class="mode-switch" aria-label="Navigation">
        <a class="mode-card ${route === 'login' ? 'active' : ''}" href="/login" data-route-link="login">
          <span class="mode-card-label">Page 1</span>
          <strong>Connexion</strong>
          <small>Accès Cognito et orientation automatique</small>
        </a>
        <a class="mode-card ${route === 'admin' ? 'active' : ''}" href="/admin" data-route-link="admin">
          <span class="mode-card-label">Page 2</span>
          <strong>Admin</strong>
          <small>Templates, publication S3 et autorisations</small>
        </a>
        <a class="mode-card ${route === 'user' ? 'active' : ''}" href="/user" data-route-link="user">
          <span class="mode-card-label">Page 3</span>
          <strong>Signature</strong>
          <small>Documents à signer et export PDF</small>
        </a>
      </nav>

      <div class="topbar-meta">
        <div class="pill">${routeLabel}</div>
        <div class="pill pill-soft">${pageCount} page${pageCount > 1 ? 's' : ''}</div>
        <div class="pill pill-soft">${fieldCount} champ${fieldCount > 1 ? 's' : ''}</div>
        <div class="pill">${authLabel}</div>
        <div class="pill pill-soft">${expiresAtLabel}</div>
        ${authAction}
      </div>
    </header>
  `;
}
