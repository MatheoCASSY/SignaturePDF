import type { RouteName } from '../types/app';

export function renderHeader(route: RouteName, pageCount: number, fieldCount: number) {
  const routeLabel = route === 'design' ? 'Designer' : 'Remplissage';
  return `
    <header class="topbar panel">
      <div class="brand">
        <span class="brand-mark">FR</span>
        <div>
          <p class="eyebrow">pdfme studio</p>
          <h1>PDF Studio A a Z</h1>
        </div>
      </div>

      <nav class="top-nav">
        <a class="route-link ${route === 'design' ? 'active' : ''}" href="/design" data-route-link="design">/design</a>
        <a class="route-link ${route === 'remplir' ? 'active' : ''}" href="/remplir" data-route-link="remplir">/remplir</a>
      </nav>

      <div class="topbar-meta">
        <div class="pill">${routeLabel}</div>
        <div class="pill pill-soft">${pageCount} page${pageCount > 1 ? 's' : ''}</div>
        <div class="pill pill-soft">${fieldCount} champ${fieldCount > 1 ? 's' : ''}</div>
      </div>
    </header>
  `;
}
