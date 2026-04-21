import type { AuthViewState, RouteName } from '../types/app';

export function renderHeader(route: RouteName, pageCount: number, fieldCount: number, auth: AuthViewState) {
  const routeLabel = route === 'design' ? 'Designer le PDF' : 'Remplir le PDF';
  const authLabel = auth.isLoading ? 'Connexion...' : auth.isAuthenticated ? auth.email || 'Connecte' : 'Non connecte';
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
          <h1>Deux pages, un flux clair</h1>
          <p class="brand-subtitle">Crée ton template sur une page, puis remplis-le sur l'autre. Importe aussi ton PDF de base quand tu veux partir d'un document existant.</p>
        </div>
      </div>

      <nav class="mode-switch" aria-label="Navigation">
        <a class="mode-card ${route === 'design' ? 'active' : ''}" href="/design" data-route-link="design">
          <span class="mode-card-label">Page 1</span>
          <strong>Design</strong>
          <small>Importer un PDF, ajouter des champs, construire le template</small>
        </a>
        <a class="mode-card ${route === 'remplir' ? 'active' : ''}" href="/remplir" data-route-link="remplir">
          <span class="mode-card-label">Page 2</span>
          <strong>Remplir</strong>
          <small>Charger le template et les données, puis exporter le PDF final</small>
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
