import type { RouteName } from '../types/app';

export function renderHeader(route: RouteName, pageCount: number, fieldCount: number) {
  const routeLabel = route === 'design' ? 'Designer le PDF' : 'Remplir le PDF';
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
      </div>
    </header>
  `;
}
