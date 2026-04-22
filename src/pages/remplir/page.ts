export function renderUserLeft() {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Signature</p>
        <h2>Mes documents à signer</h2>
        <p class="muted">Sélectionnez un document, remplissez les champs et envoyez.</p>
      </div>

      <div id="active-doc-card" class="active-doc-card hidden">
        <div class="active-doc-icon">📄</div>
        <div class="active-doc-body">
          <strong id="active-doc-name">Document</strong>
          <span id="active-doc-meta">—</span>
        </div>
      </div>

      <div id="fill-progress-section" class="section-card hidden">
        <div class="section-card-head">
          <span>Avancement</span>
          <span id="fill-progress-label" class="muted small">—</span>
        </div>
        <div class="progress-track">
          <div id="fill-progress-bar" class="progress-bar" style="width:0%"></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head"><span>Étapes</span></div>
        <div class="step-list">
          <div class="step-item sig-step" id="sig-step-1">
            <div class="step-num">1</div>
            <span>Choisissez un document dans la liste ci-dessous</span>
          </div>
          <div class="step-item sig-step" id="sig-step-2">
            <div class="step-num">2</div>
            <span>Remplissez tous les champs et apposez votre signature</span>
          </div>
          <div class="step-item sig-step" id="sig-step-3">
            <div class="step-num">3</div>
            <span>Cliquez sur <strong>Signer et envoyer</strong></span>
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
        <div class="action-grid">
          <button class="action-button primary" id="submit-btn" data-action="submit-pdf" disabled>Signer et envoyer</button>
          <button class="action-button" data-action="preview-pdf">Aperçu</button>
          <button class="action-button" data-action="clear-inputs">Vider les champs</button>
        </div>
      </div>
    </section>
  `;
}

export function renderUserRight() {
  return `
    <section class="stack gap-lg">
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
          </div>
        </div>
      </div>
    </section>
  `;
}
