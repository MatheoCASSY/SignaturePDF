export function renderRemplirLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Remplissage</p>
        <h2>Charger puis completer</h2>
        <p class="muted">Importe un template, remplit les champs, puis recupere le PDF final en un clic.</p>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Actions rapides</span>
        </div>
        <div class="action-grid">
          <button class="action-button primary" data-action="final-pdf">PDF final</button>
          <button class="action-button" data-action="preview-pdf">Apercu</button>
          <button class="action-button" data-action="fill-example">Remplir exemple</button>
          <button class="action-button" data-action="clear-inputs">Vider</button>
          <button class="action-button" data-action="load-contract">Contrat</button>
          <button class="action-button" data-action="load-invoice">Facture</button>
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
            Charger des inputs JSON
            <input type="file" id="inputs-file" accept="application/json" hidden />
          </label>
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

export function renderRemplirRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card">
        <div class="section-card-head">
          <span>Champs detectes</span>
          <span class="subtle">live</span>
        </div>
        <div id="field-summary" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Inputs JSON</span>
          <div class="mini-actions">
            <button class="mini-button" data-action="download-inputs">Telecharger</button>
            <button class="mini-button" data-action="apply-json">Appliquer</button>
          </div>
        </div>
        <textarea id="inputs-json" spellcheck="false"></textarea>
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
