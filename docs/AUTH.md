# Authentification — Studio Documents

## Protocole : OIDC Authorization Code + PKCE

L'authentification repose sur AWS Cognito en tant qu'Identity Provider OIDC. Le flux utilisé est **Authorization Code with PKCE** — adapté aux SPAs car il n'expose jamais de secret côté client.

## Flux complet

```
Utilisateur         Frontend (SPA)          Cognito             API Vercel
    │                     │                    │                     │
    │  Clic "Se connecter"│                    │                     │
    │────────────────────►│                    │                     │
    │                     │  Génère PKCE       │                     │
    │                     │  (code_verifier,   │                     │
    │                     │   code_challenge)  │                     │
    │                     │                    │                     │
    │                     │ GET /authorize     │                     │
    │                     │ ?response_type=code│                     │
    │                     │ &code_challenge=...│                     │
    │                     │────────────────────►                    │
    │                     │                    │                     │
    │  ◄─────────────────────────────────────── Formulaire login    │
    │  Saisit identifiants│                    │                     │
    │────────────────────────────────────────►│                     │
    │                     │                    │  Valide credentials │
    │                     │  Redirect callback │                     │
    │                     │◄───────────────────│                     │
    │                     │  ?code=AUTH_CODE   │                     │
    │                     │                    │                     │
    │                     │ POST /token        │                     │
    │                     │ code + code_verifier                     │
    │                     │────────────────────►                    │
    │                     │                    │                     │
    │                     │◄───────────────────│                     │
    │                     │  id_token          │                     │
    │                     │  access_token      │                     │
    │                     │  refresh_token     │                     │
    │                     │                    │                     │
    │                     │  Stocke tokens     │                     │
    │                     │  (localStorage)    │                     │
    │                     │                    │                     │
    │                     │  GET /api/templates│                     │
    │                     │  Authorization: Bearer access_token      │
    │                     │─────────────────────────────────────────►│
    │                     │                    │  Vérifie JWT (JWKS) │
    │                     │◄─────────────────────────────────────────│
    │  Page chargée       │  200 OK            │                     │
    │◄────────────────────│                    │                     │
```

## Librairie utilisée

- **`oidc-client-ts`** : gestion du flux PKCE, échange de code, refresh automatique
- **`react-oidc-context`** : wrapper React autour d'`oidc-client-ts`

Configuration dans `src/config/auth.ts` :

```typescript
export const oidcConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URIS.split(',')[0],
  scope: import.meta.env.VITE_COGNITO_SCOPE,
  response_type: 'code',
}
```

## Groupes Cognito et rôles

Les rôles sont déterminés par l'appartenance aux **groupes Cognito**. Le groupe est inclus dans le `id_token` sous la claim `cognito:groups`.

| Groupe | Rôle dans l'app | Accès |
|--------|----------------|-------|
| `admins` | Administrateur | Designer, gestion accès, soumissions |
| *(aucun groupe)* | Signataire | Formulaire de remplissage uniquement |

### Vérification côté frontend

```typescript
const user = await getUser()
const groups = user?.profile['cognito:groups'] ?? []
const isAdmin = groups.includes('admins')
```

### Vérification côté API

Dans `api/_shared.ts`, la claim `cognito:groups` du JWT est vérifiée :

```typescript
if (!payload['cognito:groups']?.includes(COGNITO_ADMIN_GROUP)) {
  return res.status(403).json({ error: 'Admin access required' })
}
```

## Stockage des tokens

Les tokens sont persistés dans `localStorage` par `oidc-client-ts`. Clés gérées par `src/config/storage.ts`.

> **Sécurité** : Pour une application à haute criticité, préférer un stockage en mémoire avec refresh via cookie HttpOnly. Ici, le compromis est accepté pour la simplicité d'une SPA BTS.

## Expiration et refresh

- **`access_token`** : expire après 1 heure (configurable dans Cognito)
- **`refresh_token`** : expire après 30 jours (configurable)
- `oidc-client-ts` renouvelle automatiquement l'access_token via le refresh_token avant expiration

## Déconnexion

La déconnexion appelle l'endpoint `/logout` de Cognito pour invalider la session SSO, puis nettoie le `localStorage`.

```typescript
await auth.signoutRedirect({
  post_logout_redirect_uri: window.location.origin
})
```

## Configuration Cognito requise

| Paramètre App Client | Valeur |
|---------------------|--------|
| Grant type | Authorization code |
| PKCE | Activé |
| Callback URLs | `http://localhost:5173`, `https://pdfme.nexsite.fr` |
| Sign-out URLs | `http://localhost:5173`, `https://pdfme.nexsite.fr` |
| Scopes | `openid profile email` |
| Token expiration (access) | 3600 secondes (1h) |
| Refresh token expiration | 30 jours |
