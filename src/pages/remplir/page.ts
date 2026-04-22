export function renderUserLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Signature</p>
        <h2>Mes documents à signer</h2>
        <p class="muted">Sélectionnez un document qui vous a été attribué, remplissez les champs demandés, signez puis envoyez-le à l'équipe FluffRadio.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Comment procéder</span>
        </div>
        <div class="step-list">
          <div class="step-item">
            <strong>1</strong>
            <span>Choisissez un document dans la liste ci-dessous.</span>
          </div>
          <div class="step-item">
            <strong>2</strong>
            <span>Renseignez les champs et apposez votre signature.</span>
          </div>
          <div class="step-item">
            <strong>3</strong>
            <span>Cliquez sur <strong>Signer et envoyer</strong> pour transmettre le document.</span>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Documents attribués</span>
          <button class="mini-button" data-action="refresh-inbox">Actualiser</button>
        </div>
        <div id="remote-inbox-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Actions</span>
        </div>
        <div class="action-grid">
          <button class="action-button primary" data-action="submit-pdf">Signer et envoyer</button>
          <button class="action-button" data-action="final-pdf">Télécharger seulement</button>
          <button class="action-button" data-action="preview-pdf">Aperçu</button>
          <button class="action-button" data-action="clear-inputs">Vider les champs</button>
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

export function renderUserRight() {
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
          <span>Statut d'accès</span>
          <span class="subtle">Cognito</span>
        </div>
        <div id="access-status" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Données du formulaire</span>
          <div class="mini-actions">
            <button class="mini-button" data-action="download-inputs">Télécharger</button>
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

      <div id="document-modal" class="document-modal hidden" aria-hidden="true">
        <div class="document-modal-backdrop" data-action="close-document-modal"></div>
        <div class="document-modal-card panel">
          <div class="section-card-head">
            <span>Document sélectionné</span>
            <button class="ghost-button" data-action="close-document-modal">Fermer</button>
          </div>
          <div id="document-modal-content" class="summary-stack"></div>
          <div class="modal-actions" style="margin-top:10px">
            <button class="action-button primary" data-action="load-selected-document">Ouvrir le document</button>
            <button class="action-button primary" data-action="submit-pdf">Signer et envoyer</button>
            <button class="action-button" data-action="final-pdf">Télécharger seulement</button>
          </div>
        </div>
      </div>
    </section>
  `;
}
