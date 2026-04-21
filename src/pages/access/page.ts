export function renderAccessLeft(progress: { done: number; total: number }) {
  return `
    <section class="stack gap-lg">
      <div>
        <p class="eyebrow">Page 3</p>
        <h2>Gestion des accès</h2>
        <p class="muted">Publie un template, attribue les signataires et vérifie que chaque accès sera consommé après la signature.</p>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Démarrage rapide</span>
        </div>
        <div class="action-grid">
          <button class="action-button primary" data-action="publish-template">Publier le template</button>
          <button class="action-button" data-action="refresh-remote">Actualiser</button>
          <button class="action-button" data-action="load-remote-template">Ouvrir par ID</button>
          <button class="action-button" data-action="template-json">Template JSON</button>
          <button class="action-button" data-action="load-contract">Contrat</button>
          <button class="action-button" data-action="load-invoice">Facture</button>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-head">
          <span>Publication et accès</span>
        </div>
        <div class="stack gap-md">
          <label class="field-stack">
            <span>Nom du template</span>
            <input id="template-name" type="text" placeholder="Contrat signé par les clients" />
          </label>
          <label class="field-stack">
            <span>Jeton Cognito</span>
            <input id="auth-token" type="password" placeholder="Colle ici le token Cognito" />
          </label>
          <label class="field-stack">
            <span>Nombre d’utilisations</span>
            <input id="access-max-uses" type="number" min="1" step="1" value="1" />
          </label>
          <label class="field-stack">
            <span>Accès à donner</span>
            <textarea id="access-principals" placeholder="email1@domaine.fr\nuser-sub-123"></textarea>
          </label>
          <div class="section-card">
            <div class="section-card-head">
              <span>Liste des users</span>
              <button class="mini-button" data-action="refresh-user-directory">Rafraîchir</button>
            </div>
            <label class="field-stack">
              <span>Rechercher un user</span>
              <input id="user-directory-search" type="text" placeholder="email, username, sub..." />
            </label>
            <div id="user-directory-list" class="summary-stack"></div>
            <p class="card-note">Clique sur un user pour l’ajouter ou le retirer de la liste d’accès avant publication.</p>
          </div>
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
          <p class="card-note">Publie ici le template puis donne les accès aux principaux autorisés. Chaque accès peut ensuite être consommé au moment de la signature.</p>
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
          <span>Accès Cognito</span>
          <span class="subtle">contrôle</span>
        </div>
        <div id="access-status" class="summary-stack"></div>
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
