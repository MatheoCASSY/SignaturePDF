import { renderHeader } from './header';
import { renderAdminLeft, renderAdminRight } from '../pages/design/page';
import { renderAccessLeft, renderAccessRight } from '../pages/access/page';
import { renderLoginPage } from '../pages/login/page';
import { renderUserLeft, renderUserRight } from '../pages/remplir/page';
import type { AuthViewState, RouteName } from '../types/app';

type LayoutProps = {
  route: RouteName;
  pageCount: number;
  fieldCount: number;
  progress: { done: number; total: number };
  auth: AuthViewState;
};

export function renderAppShell(props: LayoutProps) {
  if (props.route === 'login') {
    return `
      <div class="app-shell login-shell">
        <div class="orb orb-one"></div>
        <div class="orb orb-two"></div>

        ${renderHeader(props.route, props.pageCount, props.fieldCount, props.auth)}

        ${renderLoginPage(props.auth)}
      </div>
    `;
  }

  const stageTitle =
    props.route === 'admin'
      ? 'Éditeur de template'
      : props.route === 'access'
        ? 'Publication et droits de signature'
        : 'Document à signer';
  const stageDescription =
    props.route === 'admin'
      ? 'Construisez la mise en page de votre document, ajoutez les champs et sauvegardez.'
      : props.route === 'access'
        ? 'Publiez le template dans S3 et attribuez les droits de signature aux membres concernés.'
        : 'Remplissez les champs, apposez votre signature puis envoyez le document complété.';

  const leftSidebar =
    props.route === 'admin'
      ? renderAdminLeft(props.progress)
      : props.route === 'access'
        ? renderAccessLeft(props.progress)
        : renderUserLeft(props.progress);
  const rightSidebar =
    props.route === 'admin'
      ? renderAdminRight()
      : props.route === 'access'
        ? renderAccessRight()
        : renderUserRight();

  return `
    <div class="app-shell">
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>

      ${renderHeader(props.route, props.pageCount, props.fieldCount, props.auth)}

      <main class="workspace ${props.route === 'user' ? 'workspace-user' : 'workspace-admin'}">
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
