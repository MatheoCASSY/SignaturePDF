export function renderRemplirLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Page 2</p>
        <h2>Remplir le document</h2>
        <p class="muted">Charge un template existant, complète les champs, signe en ligne, puis télécharge le PDF final.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Parcours signataire</span>
          <span class="subtle">simple et guidé</span>
        </div>
        <div class="step-list">
          <div class="step-item"><strong>1.</strong><span>Ouvre le template envoyé.</span></div>
          <div class="step-item"><strong>2.</strong><span>Les champs obligatoires et la date du jour sont déjà prêts.</span></div>
          <div class="step-item"><strong>3.</strong><span>Signe, vérifie puis télécharge le PDF à renvoyer.</span></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Démarrage rapide</span>
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
          <span>Importer un fichier</span>
        </div>
        <div class="import-stack">
          <label class="file-button">
            Importer un template JSON
            <input type="file" id="template-file" accept="application/json" hidden />
          </label>
          <label class="file-button">
            Importer des inputs JSON
            <input type="file" id="inputs-file" accept="application/json" hidden />
          </label>
          <p class="card-note">Si tu veux repartir d’un PDF de base, retourne sur la page Design et réimporte ton document.</p>
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

export function renderRemplirRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card">
        <div class="section-card-head">
          <span>Champs détectés</span>
          <span class="subtle">live</span>
        </div>
        <div id="field-summary" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>JSON des données</span>
          <div class="mini-actions">
            <button class="mini-button" data-action="download-inputs">Télécharger</button>
            <button class="mini-button" data-action="apply-json">Appliquer</button>
          </div>
        </div>
        <textarea id="inputs-json" spellcheck="false"></textarea>
        <p class="card-note">Tu peux laisser la date vide dans tes données: elle sera remplie automatiquement au jour du remplissage.</p>
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
