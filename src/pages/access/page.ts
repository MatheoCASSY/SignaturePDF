export function renderAccessLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Gestion des accès</p>
        <h2>Publier et autoriser</h2>
        <p class="muted">Publiez votre template dans S3, sélectionnez les signataires parmi les comptes Cognito et définissez le nombre de signatures autorisées.</p>
      </div>

      <div class="section-card accent-card">
        <div class="section-card-head">
          <span>Publication</span>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>Nom du document</span>
            <input id="template-name" type="text" placeholder="Ex : Contrat bénévole 2025" />
          </label>
          <label class="field-stack">
            <span>Nombre de signatures autorisées</span>
            <input id="access-max-uses" type="number" min="1" step="1" value="1" />
          </label>
          <div class="action-grid">
            <button class="action-button primary" data-action="publish-template">Publier le template</button>
            <button class="action-button" data-action="refresh-remote">Actualiser</button>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Signataires autorisés</span>
          <button class="mini-button" data-action="refresh-user-directory">Rafraîchir</button>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>Rechercher un compte</span>
            <input id="user-directory-search" type="text" placeholder="Email, nom d'utilisateur…" />
          </label>
          <div id="user-directory-list" class="summary-stack"></div>
          <label class="field-stack">
            <span>Ou saisir manuellement</span>
            <textarea id="access-principals" placeholder="email1@domaine.fr&#10;email2@domaine.fr"></textarea>
          </label>
          <p class="card-note">Cliquez sur un compte pour l'ajouter ou le retirer de la liste. Publiez ensuite le template pour enregistrer les accès.</p>
          <button class="action-button primary" data-action="publish-template">Enregistrer les accès</button>
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

export function renderAccessRight() {
  return `
    <section class="stack gap-lg">
      <div class="section-card">
        <div class="section-card-head">
          <span>Template actif</span>
          <span class="subtle">live</span>
        </div>
        <div id="template-summary" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Templates publiés dans S3</span>
          <button class="mini-button" data-action="refresh-remote">Actualiser</button>
        </div>
        <div id="remote-template-list" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Statut d'accès Cognito</span>
          <span class="subtle">contrôle</span>
        </div>
        <div id="access-status" class="summary-stack"></div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Documents reçus</span>
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
