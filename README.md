# FluffRadio — Studio Documents

> Plateforme web de conception, distribution et signature de documents PDF pour FluffRadio.  
> Les administrateurs créent des templates, accordent des accès aux signataires et consultent les soumissions. Les animateurs remplissent et soumettent les formulaires.

## Rôles

| Rôle | Accès |
|------|-------|
| **Admin** (`admins`) | Designer de templates, gestion des accès, consultation des soumissions |
| **Signataire** (tout utilisateur Cognito autorisé) | Remplissage de formulaire + soumission PDF |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Schéma technique, composants, flux de données |
| [Installation](docs/INSTALLATION.md) | Prérequis, variables d'environnement, lancement local |
| [API](docs/API.md) | Référence complète des endpoints serverless |
| [Authentification](docs/AUTH.md) | Flux OIDC Cognito, groupes, gestion des tokens |
| [Déploiement](docs/DEPLOYMENT.md) | Pipeline Vercel, configuration S3, mise en production |
| [Fonctionnalités](docs/FEATURES.md) | Détail des pages et cas d'usage |

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
# → Renseigner les valeurs Cognito + S3 (voir docs/INSTALLATION.md)

# 3. Lancer le serveur de développement
npm run dev
# → http://localhost:5173
```

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | TypeScript vanilla, Vite 8 |
| **PDF** | [@pdfme](https://pdfme.com/) v6.0.6 — designer, forms, générateur |
| **Auth** | AWS Cognito OIDC (`oidc-client-ts` + `react-oidc-context`) |
| **Backend** | Vercel Serverless Functions (TypeScript, CommonJS) |
| **Stockage** | AWS S3 eu-west-1 (templates JSON + PDFs signés) |
| **Déploiement** | Vercel (auto-deploy sur `main`) |

## Structure du projet

```
pdfme/
├── api/                    # Backend serverless (Vercel Functions)
│   ├── _shared.ts          # Validation JWT Cognito, SDK AWS
│   ├── access.ts           # Gestion des droits de signature
│   ├── submissions.ts      # Soumissions PDF
│   ├── templates.ts        # CRUD templates S3
│   └── health.ts           # Health check
├── src/                    # Frontend SPA TypeScript
│   ├── app.ts              # Machine d'état principale + routeur
│   ├── main.ts             # Bootstrap de l'application
│   ├── components/         # Header, layout, todo
│   ├── config/             # Auth Cognito, storage, options UI
│   ├── core/               # Services : auth, OIDC, API, PDF
│   ├── pages/              # login/, design/, access/, remplir/
│   ├── data/               # Templates exemples, todos
│   ├── types/              # Interfaces TypeScript (AppState, etc.)
│   └── utils/              # DOM, fichiers, routage SPA
├── public/                 # Assets statiques
├── vercel.json             # Config Vercel + rewrites
├── .env.example            # Template des variables d'environnement
├── tsconfig.json
└── vite.config.*
```

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement Vite (`localhost:5173`) |
| `npm run build` | Build de production dans `dist/` |
| `npm run vercel:prebuilt` | Build + déploiement Vercel complet |
