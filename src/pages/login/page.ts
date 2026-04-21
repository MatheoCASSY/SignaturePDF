import type { AuthViewState } from '../../types/app';

export function renderLoginPage(auth: AuthViewState) {
  const statusLabel = auth.isLoading
    ? 'Vérification de la session en cours'
    : auth.isAuthenticated
      ? auth.isAdmin
        ? 'Session admin prête'
        : 'Session utilisateur prête'
      : 'Connexion requise';

  return `
    <main class="login-page">
      <section class="login-hero panel">
        <div class="login-copy">
          <p class="eyebrow">Page 1</p>
          <h2>Accès à l espace documentaire</h2>
          <p class="muted">Après authentification, l utilisateur est redirigé vers la page Admin ou Signature selon son rôle.</p>

          <div class="login-actions">
            <button class="action-button primary" data-action="auth-signin">Se connecter avec Cognito</button>
            <button class="ghost-button" data-action="goto-admin">Aller vers l’admin</button>
            <button class="ghost-button" data-action="goto-user">Aller vers la signature</button>
          </div>

          <div class="login-status-grid">
            <div class="login-status-card">
              <span>État</span>
              <strong>${statusLabel}</strong>
            </div>
            <div class="login-status-card">
              <span>Connexion</span>
              <strong>${auth.isAuthenticated ? auth.email || 'Connecté' : 'Aucune session'}</strong>
            </div>
            <div class="login-status-card">
              <span>Orientation</span>
              <strong>${auth.isAdmin ? 'Admin' : 'Utilisateur'}</strong>
            </div>
          </div>
        </div>

        <aside class="login-panel stack gap-lg">
          <div class="section-card accent-card">
            <div class="section-card-head">
              <span>Parcours</span>
            </div>
            <div class="step-list">
              <div class="step-item"><strong>1.</strong><span>Connexion Cognito.</span></div>
              <div class="step-item"><strong>2.</strong><span>Redirection selon le rôle.</span></div>
              <div class="step-item"><strong>3.</strong><span>Publication ou signature du PDF.</span></div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-card-head">
              <span>Rôles</span>
            </div>
            <div class="summary-stack">
              <div class="summary-row"><strong>Admin</strong><span>Créer, publier, donner des accès.</span></div>
              <div class="summary-row"><strong>User</strong><span>Voir ses documents, remplir et exporter.</span></div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  `;
}