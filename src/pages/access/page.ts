export function renderAccessLeft() {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Accès</p>
        <h2>Gérer les signataires</h2>
        <p class="muted">Sélectionnez un template publié dans S3, choisissez les comptes autorisés à le signer et accordez-leur l'accès.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Templates publiés</span>
          <button class="mini-button" data-action="refresh-remote">Actualiser</button>
        </div>
        <div id="remote-template-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Attribuer l'accès</span>
          <button class="mini-button" data-action="refresh-user-directory">Rafraîchir</button>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>Rechercher un compte</span>
            <input id="user-directory-search" type="text" placeholder="Email, nom d'utilisateur…" />
          </label>
          <div id="user-directory-list" class="summary-stack"></div>
          <label class="field-stack">
            <span>Nombre de signatures autorisées</span>
            <input id="access-max-uses" type="number" min="1" step="1" value="1" />
          </label>
          <p class="card-note">Cliquez sur un compte pour le sélectionner. Cliquez sur <strong>Accorder l'accès</strong> pour enregistrer.</p>
          <button class="action-button primary" data-action="grant-access">Accorder l'accès</button>
        </div>
      </div>
    </section>
  `;
}

export function renderAccessRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Suivi des signatures</span>
          <button class="mini-button" data-action="refresh-grants">Actualiser</button>
        </div>
        <div id="grants-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Documents signés reçus</span>
          <button class="mini-button" data-action="refresh-submissions">Actualiser</button>
        </div>
        <div id="submission-list" class="summary-stack"></div>
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
