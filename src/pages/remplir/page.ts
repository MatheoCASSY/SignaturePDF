export function renderUserLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Page 3</p>
        <h2>Documents à signer</h2>
        <p class="muted">Sélectionne un document attribué, renseigne les champs, signe puis exporte le PDF final.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Parcours signataire</span>
          <span class="subtle">simple et guidé</span>
        </div>
        <div class="step-list">
          <div class="step-item"><strong>1.</strong><span>Choisis un document dans ta liste.</span></div>
          <div class="step-item"><strong>2.</strong><span>Renseigne les informations demandées dans la popup.</span></div>
          <div class="step-item"><strong>3.</strong><span>Signe, vérifie puis télécharge le PDF à renvoyer.</span></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Démarrage rapide</span>
        </div>
        <div class="action-grid">
          <button class="action-button primary" data-action="final-pdf">PDF final</button>
          <button class="action-button" data-action="refresh-inbox">Actualiser la liste</button>
          <button class="action-button" data-action="preview-pdf">Apercu</button>
          <button class="action-button" data-action="fill-example">Remplir exemple</button>
          <button class="action-button" data-action="clear-inputs">Vider</button>
          <button class="action-button" data-action="load-remote-template">Ouvrir par ID</button>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Documents à signer</span>
          <span class="subtle">Inbox</span>
        </div>
        <div id="remote-inbox-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Ouverture manuelle</span>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>ID du template publié</span>
            <input id="remote-template-id" type="text" placeholder="uuid du template publié" />
          </label>
          <label class="field-stack">
            <span>Jeton Cognito</span>
            <input id="auth-token" type="password" placeholder="Colle ici ton token Cognito" />
          </label>
          <div class="import-stack">
            <label class="file-button">
              Importer un template JSON
              <input type="file" id="template-file" accept="application/json" hidden />
            </label>
            <label class="file-button">
              Importer des inputs JSON
              <input type="file" id="inputs-file" accept="application/json" hidden />
            </label>
          </div>
          <p class="card-note">Cette zone sert surtout à l’ouverture directe d’un document. En usage normal, sélectionne d’abord un document depuis l’inbox de gauche.</p>
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
          <span>Accès Cognito</span>
          <span class="subtle">contrôle</span>
        </div>
        <div id="access-status" class="summary-stack"></div>
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

      <div id="document-modal" class="document-modal hidden" aria-hidden="true">
        <div class="document-modal-backdrop" data-action="close-document-modal"></div>
        <div class="document-modal-card panel">
          <div class="section-card-head">
            <span>Document sélectionné</span>
            <button class="ghost-button" data-action="close-document-modal">Fermer</button>
          </div>
          <div id="document-modal-content" class="summary-stack"></div>
          <div class="modal-actions">
            <button class="action-button primary" data-action="load-selected-document">Ouvrir le document</button>
            <button class="action-button" data-action="final-pdf">Signer et exporter</button>
          </div>
        </div>
      </div>
    </section>
  `;
}
