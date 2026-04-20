import { quickFieldLibrary } from '../../config/ui';

export function renderDesignLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Design</p>
        <h2>Template et champs</h2>
        <p class="muted">Charge un PDF de fond, ajoute des champs et exporte un PDF interactif pour le remplissage.</p>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Actions rapides</span>
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
          <span>Importer</span>
        </div>
        <div class="import-stack">
          <label class="file-button">
            Charger un template JSON
            <input type="file" id="template-file" accept="application/json" hidden />
          </label>
          <label class="file-button">
            Charger un PDF de fond
            <input type="file" id="basepdf-file" accept="application/pdf" hidden />
          </label>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Palette de champs</span>
          <span class="subtle">ajout direct</span>
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
          <span>Plan IA</span>
          <span class="subtle">${progress.done}/${progress.total}</span>
        </div>
        <div id="todo-list" class="todo-list"></div>
      </div>
    </section>
  `;
}

export function renderDesignRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card">
        <div class="section-card-head">
          <span>Resume template</span>
          <span class="subtle">live</span>
        </div>
        <div id="template-summary" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Template JSON</span>
          <div class="mini-actions">
            <button class="mini-button" data-action="download-template">Telecharger</button>
            <button class="mini-button" data-action="reset-template">Reinitialiser</button>
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
