import type { AuthViewState, RouteName } from '../types/app';

export function renderHeader(route: RouteName, pageCount: number, fieldCount: number, auth: AuthViewState) {
  const authLabel = auth.isLoading
    ? 'Connexion…'
    : auth.isAuthenticated
      ? auth.email || (auth.isAdmin ? 'Admin' : 'Connecté')
      : 'Non connecté';

  const expiresAtLabel =
    auth.isAuthenticated && auth.expiresAt
      ? `Expire ${new Date(auth.expiresAt * 1000).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
      : auth.isAuthenticated
        ? 'Session active'
        : 'Aucune session';

  const authAction = auth.isAuthenticated
    ? `<button class="ghost-button" data-action="auth-refresh">Rafraîchir</button>
       <button class="ghost-button" data-action="auth-signout">Se déconnecter</button>`
    : `<button class="ghost-button" data-action="auth-signin">Se connecter</button>`;

  const adminOnly = (label: string) =>
    auth.isAdmin ? label : `<span style="opacity:.4;pointer-events:none;cursor:default">${label}</span>`;

  return `
    <header class="topbar panel">
      <div class="brand">
        <img src="/fr-logo.png" alt="FluffRadio" class="brand-logo" />
        <div>
          <p class="eyebrow">Studio Documents</p>
          <p class="brand-subtitle">Conception, publication et signature de documents PDF.</p>
        </div>
      </div>

      <nav class="mode-switch" aria-label="Navigation">
        <a class="mode-card ${route === 'login' ? 'active' : ''}" href="/login" data-route-link="login">
          <span class="mode-card-label">Accès</span>
          <strong>Connexion</strong>
          <small>Authentification Cognito</small>
        </a>
        <a class="mode-card ${route === 'admin' ? 'active' : ''}" href="/admin" data-route-link="admin">
          <span class="mode-card-label">Admin</span>
          <strong>Formatage</strong>
          <small>Création et mise en page des templates</small>
        </a>
        <a class="mode-card ${route === 'access' ? 'active' : ''}" href="/access" data-route-link="access">
          <span class="mode-card-label">Admin</span>
          <strong>Gestion des accès</strong>
          <small>Publication et droits de signature</small>
        </a>
        <a class="mode-card ${route === 'user' ? 'active' : ''}" href="/user" data-route-link="user">
          <span class="mode-card-label">Utilisateur</span>
          <strong>Signature</strong>
          <small>Remplissage et envoi du document</small>
        </a>
      </nav>

      <div class="topbar-meta">
        ${auth.isAuthenticated ? `<div class="pill">${authLabel}</div>` : ''}
        ${auth.isAuthenticated && auth.isAdmin ? `<div class="pill" style="background:linear-gradient(150deg,var(--purple),var(--purple-dark));color:#fff;border-color:var(--purple-dark)">Admin</div>` : ''}
        <div class="pill pill-soft">${pageCount} page${pageCount > 1 ? 's' : ''} · ${fieldCount} champ${fieldCount > 1 ? 's' : ''}</div>
        <div class="pill pill-soft">${expiresAtLabel}</div>
        ${authAction}
      </div>
    </header>
  `;
}
