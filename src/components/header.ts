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
          <h1>Connexion, administration et signature</h1>
          <p class="brand-subtitle">Un espace pour préparer les documents, un autre pour les signer, et une porte d’entrée Cognito qui oriente automatiquement chaque utilisateur.</p>
        </div>
      </div>

      <nav class="mode-switch" aria-label="Navigation">
        <a class="mode-card ${route === 'login' ? 'active' : ''}" href="/login" data-route-link="login">
          <span class="mode-card-label">Page 1</span>
          <strong>Connexion</strong>
          <small>Entrer dans l’espace Cognito puis être orienté automatiquement</small>
        </a>
        <a class="mode-card ${route === 'admin' ? 'active' : ''}" href="/admin" data-route-link="admin">
          <span class="mode-card-label">Page 2</span>
          <strong>Admin</strong>
          <small>Créer les templates, publier dans S3 et donner l’accès aux users</small>
        </a>
        <a class="mode-card ${route === 'user' ? 'active' : ''}" href="/user" data-route-link="user">
          <span class="mode-card-label">Page 3</span>
          <strong>Signature</strong>
          <small>Voir les documents à signer, remplir les champs et exporter le PDF</small>
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
