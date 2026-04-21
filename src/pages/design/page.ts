import { quickFieldLibrary } from '../../config/ui';

export function renderAdminLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Page 1</p>
        <h2>Administration des templates</h2>
        <p class="muted">Prépare le template, publie dans S3 et attribue les accès de signature.</p>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Démarrage rapide</span>
        </div>
        <div class="action-grid">
          <button class="action-button primary" data-action="interactive-pdf">PDF interactif</button>
          <button class="action-button" data-action="template-json">Template JSON</button>
          <button class="action-button" data-action="load-contract">Contrat</button>
          <button class="action-button" data-action="load-invoice">Facture</button>
          <button class="action-button" data-action="load-onboarding">Onboarding</button>
          <button class="action-button" data-action="add-page">Ajouter page</button>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Base du document</span>
        </div>
        <div class="stack gap-md">
          <div class="import-stack">
            <label class="file-button">
              Importer un template JSON
              <input type="file" id="template-file" accept="application/json" hidden />
            </label>
            <label class="file-button">
              Importer mon PDF
              <input type="file" id="basepdf-file" accept="application/pdf" hidden />
            </label>
          </div>
          <p class="card-note">Cette page reste centrée sur la structure du document. La publication et les accès sont gérés dans la page dédiée Accès.</p>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Ajouter des champs</span>
          <span class="subtle">clic direct</span>
        </div>
        <div class="field-grid">
          ${quickFieldLibrary
            .map(
              (field) => `
                <button class="field-button" data-field-kind="${field.kind}">
                  <strong>${field.label}</strong>
                  <small>${field.hint}</small>
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Suivi</span>
          <span class="subtle">${progress.done}/${progress.total}</span>
        </div>
        <div id="todo-list" class="todo-list"></div>
      </div>
    </section>
  `;
}

export function renderAdminRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card">
        <div class="section-card-head">
          <span>Résumé du template</span>
          <span class="subtle">live</span>
        </div>
        <div id="template-summary" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Templates publiés</span>
          <span class="subtle">Vercel</span>
        </div>
        <div id="remote-template-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>JSON du template</span>
          <div class="mini-actions">
            <button class="mini-button" data-action="download-template">Télécharger</button>
            <button class="mini-button" data-action="reset-template">Réinitialiser</button>
          </div>
        </div>
        <textarea id="template-json" spellcheck="false"></textarea>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Journal</span>
        </div>
        <div id="notice-list" class="notice-list"></div>
      </div>
    </section>
  `;
}
