# Référence API — Studio Documents

Toutes les routes sont des Vercel Serverless Functions dans `api/`. Chaque requête (sauf `/api/health`) requiert un header `Authorization: Bearer <token>` avec un JWT Cognito valide.

## Authentification

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Le token est validé via les JWKS publics du User Pool Cognito. En cas d'échec, la réponse est `401 Unauthorized`.

---

## GET `/api/health`

Vérifie que les fonctions serverless répondent.

**Auth** : Non requis

**Réponse 200**
```json
{ "status": "ok", "timestamp": "2025-01-01T12:00:00.000Z" }
```

---

## Templates (`api/templates.ts`)

### GET `/api/templates`

Liste tous les templates disponibles depuis S3.

**Auth** : Tout utilisateur connecté

**Réponse 200**
```json
[
  {
    "id": "contract-v1",
    "name": "Contrat animateur",
    "schema": { ... },
    "createdAt": "2025-01-01T10:00:00.000Z"
  }
]
```

### POST `/api/templates`

Crée ou met à jour un template.

**Auth** : Groupe `admins` requis

**Corps**
```json
{
  "id": "contract-v1",
  "name": "Contrat animateur",
  "schema": { ... }
}
```

**Réponse 201**
```json
{ "id": "contract-v1", "saved": true }
```

### DELETE `/api/templates?id={templateId}`

Supprime un template par son ID.

**Auth** : Groupe `admins` requis

**Réponse 200**
```json
{ "deleted": true }
```

---

## Accès (`api/access.ts`)

### POST `/api/access/grant`

Accorde à un utilisateur le droit de remplir un template.

**Auth** : Groupe `admins` requis

**Corps**
```json
{
  "userId": "user-sub-cognito",
  "templateId": "contract-v1",
  "email": "animateur@fluffradio.fr"
}
```

**Réponse 200**
```json
{ "granted": true }
```

### POST `/api/access/check`

Vérifie si l'utilisateur courant a accès à un template.

**Auth** : Tout utilisateur connecté

**Corps**
```json
{ "templateId": "contract-v1" }
```

**Réponse 200**
```json
{ "hasAccess": true }
```

### DELETE `/api/access/revoke`

Révoque l'accès d'un utilisateur à un template.

**Auth** : Groupe `admins` requis

**Corps**
```json
{ "userId": "user-sub-cognito", "templateId": "contract-v1" }
```

**Réponse 200**
```json
{ "revoked": true }
```

### GET `/api/access/list?templateId={templateId}`

Liste tous les utilisateurs ayant accès à un template.

**Auth** : Groupe `admins` requis

**Réponse 200**
```json
[
  { "userId": "...", "email": "animateur@fluffradio.fr", "grantedAt": "..." }
]
```

---

## Soumissions (`api/submissions.ts`)

### GET `/api/submissions`

Liste toutes les soumissions de PDFs signés.

**Auth** : Groupe `admins` requis

**Réponse 200**
```json
[
  {
    "id": "sub-abc123",
    "templateId": "contract-v1",
    "userId": "user-sub-cognito",
    "email": "animateur@fluffradio.fr",
    "submittedAt": "2025-01-15T14:30:00.000Z",
    "downloadUrl": "https://s3.../submissions/..."
  }
]
```

### GET `/api/submissions/download?id={submissionId}`

Génère une URL présignée S3 pour télécharger un PDF soumis (valable 15 minutes).

**Auth** : Groupe `admins` requis

**Réponse 200**
```json
{ "url": "https://s3.amazonaws.com/...?X-Amz-Signature=..." }
```

### POST `/api/submissions`

Soumet un PDF rempli et signé.

**Auth** : Utilisateur ayant accès au template

**Corps** : `multipart/form-data` avec champs :
- `templateId` : ID du template
- `pdf` : fichier PDF (Blob)

**Réponse 201**
```json
{ "id": "sub-abc123", "submitted": true }
```

---

## Codes d'erreur

| Code | Signification |
|------|---------------|
| `400` | Corps de requête invalide ou paramètre manquant |
| `401` | Token absent, invalide ou expiré |
| `403` | Utilisateur non autorisé (groupe insuffisant ou accès non accordé) |
| `404` | Ressource introuvable dans S3 |
| `500` | Erreur interne (AWS SDK, S3 inaccessible) |
