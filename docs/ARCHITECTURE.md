# Architecture — Studio Documents

## Vue d'ensemble

Studio Documents est une SPA TypeScript déployée sur Vercel. Le frontend est un fichier `app.ts` central (machine d'état) qui orchestre le routage, l'auth OIDC et les appels API. Le backend est constitué de Vercel Serverless Functions qui valident les JWT Cognito avant chaque opération S3.

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur (SPA)                     │
│                                                         │
│  ┌───────────┐   ┌────────────┐   ┌─────────────────┐  │
│  │  login/   │   │  design/   │   │    access/      │  │
│  │  page.ts  │   │  page.ts   │   │    page.ts      │  │
│  └───────────┘   └────────────┘   └─────────────────┘  │
│         │               │                  │            │
│         └───────────────┼──────────────────┘            │
│                         ▼                               │
│                    app.ts (AppState)                    │
│              routeur + machine d'état                   │
│                         │                               │
│          ┌──────────────┼──────────────┐                │
│          ▼              ▼              ▼                 │
│     core/auth.ts   core/remote.ts  core/template.ts    │
│     (OIDC session) (fetch API)     (PDF builder)        │
└─────────────────────────────────────────────────────────┘
                          │
              HTTPS (JWT Bearer token)
                          │
┌─────────────────────────────────────────────────────────┐
│              Vercel Serverless Functions                │
│                                                         │
│  /api/templates   /api/access   /api/submissions        │
│         │               │              │                │
│         └───────────────┼──────────────┘                │
│                         ▼                               │
│               api/_shared.ts                            │
│         Validation JWT (jose + Cognito JWKS)            │
└─────────────────────────────────────────────────────────┘
                          │
               AWS SDK @3.x (eu-west-1)
                          │
          ┌───────────────┴──────────────┐
          ▼                              ▼
   AWS Cognito                       AWS S3
   (User Pool +                  (templates/*.json
    groupes IAM)                  submissions/*.pdf)
```

## Frontend — Machine d'état (`app.ts`)

### AppState

```typescript
interface AppState {
  route: 'login' | 'admin' | 'access' | 'user'
  auth: AuthViewState          // token OIDC, user info, groupe
  template: Template | null    // template PDFMe actif
  inputs: Record<string, any>  // valeurs du formulaire en cours
  remoteTemplates: Template[]  // templates chargés depuis S3
  submissions: Submission[]    // soumissions admin
  grants: Grant[]              // droits d'accès accordés
}
```

### Routage SPA

Le routage est géré par `utils/routing.ts`. L'URL (`/login`, `/admin`, `/access`, `/user`) détermine la page affichée. La transition vers `/admin` ou `/access` vérifie l'appartenance au groupe `admins`.

### Cycle de vie d'une session

1. `main.ts` → initialise l'état depuis `localStorage` (token + template)
2. `core/auth.ts` → vérifie la validité du token OIDC
3. Si token expiré → redirect Cognito
4. Si token valide → `app.ts` route vers la page appropriée

## Backend — Vercel Serverless Functions

### Validation des requêtes (`api/_shared.ts`)

Chaque handler commence par :
```typescript
const token = req.headers.authorization?.replace('Bearer ', '')
const payload = await verifyJWT(token, cognitoJwksUri)
// Lève une 401 si invalide ou expiré
```

La vérification utilise `jose` avec les JWKS publics de Cognito (mis en cache 24h).

### Pattern CRUD S3

- **Templates** : objets JSON dans `s3://bucket/templates/{id}.json`
- **Soumissions** : PDFs dans `s3://bucket/submissions/{userId}/{timestamp}.pdf`
- **Grants** : JSON dans `s3://bucket/grants/{templateId}/{userId}.json`

## Modules frontend

| Module | Rôle |
|--------|------|
| `src/config/auth.ts` | Constantes Cognito (authority, client_id, scopes) |
| `src/config/storage.ts` | Clés localStorage |
| `src/config/ui.ts` | Options du Designer et du Form PDFMe |
| `src/core/auth.ts` | Session OIDC : login, logout, refresh, getUser |
| `src/core/remote.ts` | Appels API : CRUD templates, soumissions, grants |
| `src/core/fillablePdf.ts` | Génération PDF final avec `@pdfme/generator` |
| `src/core/fields.ts` | Ajout dynamique de champs au template |
| `src/core/storage.ts` | Persistance locale (template + draft) |
| `src/core/template.ts` | Utilitaires de transformation de template |
| `src/utils/dom.ts` | Helpers HTML, échappement XSS |
| `src/utils/files.ts` | Upload/download de fichiers |
| `src/utils/routing.ts` | Logique de routage SPA |

## Décisions architecturales

**TypeScript vanilla sans framework UI**  
Réduit la taille du bundle et évite une couche d'abstraction inutile pour une SPA à 4 pages. PDFMe intègre ses propres composants (Designer, Form).

**Serverless sur Vercel**  
Pas de serveur à maintenir. Les fonctions API sont colocalisées avec le frontend dans le même dépôt et déployées automatiquement.

**S3 comme base de données**  
Les templates et soumissions sont des artefacts binaires ou JSON de taille variable. S3 est plus adapté qu'une base relationnelle pour du stockage de fichiers avec accès IAM.
