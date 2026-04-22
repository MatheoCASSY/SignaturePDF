import type { AuthViewState, RouteName } from '../types/app';

export function renderHeader(route: RouteName, _pageCount: number, _fieldCount: number, auth: AuthViewState) {
  const authLabel = auth.isLoading
    ? 'Connexion...'
    : auth.isAuthenticated
      ? auth.email || (auth.isAdmin ? 'Admin' : 'Connecte')
      : '';

  const authAction = auth.isAuthenticated
    ? `<button class="nav-action" data-action="auth-signout">Se deconnecter</button>`
    : `<button class="nav-action nav-action--primary" data-action="auth-signin">Se connecter</button>`;

  const adminTabs = auth.isAdmin ? `
    <a class="nav-tab ${route === 'admin' ? 'nav-tab--active' : ''}" href="/admin" data-route-link="admin">Formatage</a>
    <a class="nav-tab ${route === 'access' ? 'nav-tab--active' : ''}" href="/access" data-route-link="access">Acces</a>
  ` : '';

  return `
    <header class="topbar panel">
      <a href="/login" data-route-link="login" class="topbar-brand">
        <img src="/fr-logo.png" alt="FluffRadio" class="brand-logo" />
      </a>

      <nav class="nav-tabs-group" aria-label="Navigation">
        <a class="nav-tab ${route === 'login' ? 'nav-tab--active' : ''}" href="/login" data-route-link="login">Connexion</a>
        ${adminTabs}
        <a class="nav-tab ${route === 'user' ? 'nav-tab--active' : ''}" href="/user" data-route-link="user">Signature</a>
      </nav>

      <div class="topbar-right">
        ${auth.isAuthenticated ? `
          ${auth.isAdmin ? `<span class="role-badge">Admin</span>` : ''}
          <span class="user-label">${authLabel}</span>
        ` : ''}
        ${authAction}
      </div>
    </header>
  `;
}
