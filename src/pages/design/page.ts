import { quickFieldLibrary } from '../../config/ui';

export function renderAdminLeft() {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Formatage</p>
        <h2>Créer un template</h2>
        <p class="muted">Importez un PDF, ajoutez vos champs et sauvegardez dans S3. La gestion des accès se fait depuis l'onglet dédié.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Base du document</span>
        </div>
        <div class="stack gap-md">
          <div class="import-stack">
            <label class="file-button">
              Importer mon PDF
              <input type="file" id="basepdf-file" accept="application/pdf" hidden />
            </label>
            <label class="file-button">
              Importer un template JSON
              <input type="file" id="template-file" accept="application/json" hidden />
            </label>
          </div>
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
          <span>Actions</span>
        </div>
        <div class="action-grid">
          <button class="action-button" data-action="add-page">Ajouter une page</button>
          <button class="action-button" data-action="reset-template">Réinitialiser</button>
        </div>
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

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Sauvegarder dans S3</span>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>Nom du template</span>
            <input id="template-name" type="text" placeholder="Ex : Contrat bénévole 2025" />
          </label>
          <div class="action-grid">
            <button class="action-button primary" data-action="publish-template">Sauvegarder dans S3</button>
            <button class="action-button" data-action="refresh-remote">Actualiser</button>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Templates dans S3</span>
        </div>
        <div id="remote-template-list" class="summary-stack"></div>
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
