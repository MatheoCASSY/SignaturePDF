import { renderHeader } from './header';
import { renderDesignLeft, renderDesignRight } from '../pages/design/page';
import { renderRemplirLeft, renderRemplirRight } from '../pages/remplir/page';
import type { RouteName } from '../types/app';

type LayoutProps = {
  route: RouteName;
  pageCount: number;
  fieldCount: number;
  progress: { done: number; total: number };
};

export function renderAppShell(props: LayoutProps) {
  const stageTitle = props.route === 'design' ? 'Designer le template' : 'Remplir le document';
  const stageDescription =
    props.route === 'design'
      ? 'Ajoute, deplace et configure les champs dans le canvas pdfme.'
      : 'Renseigne les champs du formulaire puis exporte le PDF final.';

  const leftSidebar = props.route === 'design' ? renderDesignLeft(props.progress) : renderRemplirLeft(props.progress);
  const rightSidebar = props.route === 'design' ? renderDesignRight() : renderRemplirRight();

  return `
    <div class="app-shell">
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>

      ${renderHeader(props.route, props.pageCount, props.fieldCount)}

      <main class="workspace ${props.route === 'design' ? 'workspace-design' : 'workspace-fill'}">
        <aside class="panel sidebar left-sidebar">${leftSidebar}</aside>

        <section class="panel stage-panel">
          <div class="stage-header">
            <div>
              <p class="eyebrow">Surface de travail</p>
              <h2 id="stage-title">${stageTitle}</h2>
              <p class="muted">${stageDescription}</p>
            </div>
            <div class="stage-actions">
              <button class="ghost-button" data-action="apply-json">Appliquer JSON</button>
              <button class="ghost-button" data-action="save-local">Sauvegarder</button>
            </div>
          </div>
          <div class="canvas-frame">
            <div id="pdfme-mount" class="pdfme-mount"></div>
          </div>
        </section>

        <aside class="panel sidebar right-sidebar">${rightSidebar}</aside>
      </main>
    </div>
  `;
}
