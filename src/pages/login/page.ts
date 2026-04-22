import type { AuthViewState } from '../../types/app';

export function renderLoginPage(auth: AuthViewState) {
  const statusLabel = auth.isLoading
    ? 'Vérification en cours…'
    : auth.isAuthenticated
      ? auth.isAdmin
        ? 'Session admin active'
        : 'Session utilisateur active'
      : 'Aucune session';

  const orientationLabel = auth.isAuthenticated
    ? auth.isAdmin
      ? 'Admin → Formatage & Accès'
      : 'Utilisateur → Signature'
    : '—';

  return `
    <main class="login-page">
      <section class="login-hero panel">

        <div class="login-left">
          <img src="/fr-logo.png" alt="FluffRadio" class="login-brand-logo" />

          <div>
            <h2 class="login-headline">
              Studio de<br><span>documents officiels</span>
            </h2>
            <p class="login-desc">
              Connectez-vous avec votre compte FluffRadio pour accéder à l'espace de
              création, de publication et de signature de documents PDF.
            </p>
          </div>

          <div class="login-actions">
            <button class="login-cta" data-action="auth-signin">
              Se connecter avec Cognito
            </button>
            ${auth.isAuthenticated ? `
              <button class="action-button" data-action="goto-${auth.isAdmin ? 'admin' : 'user'}">
                Continuer vers ${auth.isAdmin ? 'l\'administration' : 'la signature'}
              </button>
            ` : ''}
          </div>

          <div class="login-status-grid">
            <div class="login-status-card">
              <span>État</span>
              <strong>${statusLabel}</strong>
            </div>
            <div class="login-status-card">
              <span>Compte</span>
              <strong>${auth.isAuthenticated ? auth.email || 'Connecté' : '—'}</strong>
            </div>
            <div class="login-status-card">
              <span>Orientation</span>
              <strong>${orientationLabel}</strong>
            </div>
          </div>
        </div>

        <div class="login-right">
          <h3>Comment ça fonctionne</h3>

          <div class="step-list">
            <div class="login-step">
              <div class="login-step-num">1</div>
              <div class="login-step-body">
                <strong>Connexion Cognito</strong>
                <span>Authentification sécurisée avec votre compte FluffRadio.</span>
              </div>
            </div>
            <div class="login-step">
              <div class="login-step-num">2</div>
              <div class="login-step-body">
                <strong>Redirection automatique</strong>
                <span>Les admins accèdent au formatage, les autres à la signature.</span>
              </div>
            </div>
            <div class="login-step">
              <div class="login-step-num">3</div>
              <div class="login-step-body">
                <strong>Signature et envoi</strong>
                <span>Le document signé est téléchargé et transmis à l'équipe.</span>
              </div>
            </div>
          </div>

          <div class="login-roles">
            <div class="login-role-card">
              <strong>Administrateur</strong>
              <span>Créer · Publier · Gérer les accès</span>
            </div>
            <div class="login-role-card">
              <strong>Utilisateur</strong>
              <span>Consulter · Signer · Envoyer</span>
            </div>
          </div>
        </div>

      </section>
    </main>
  `;
}
