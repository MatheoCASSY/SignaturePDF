# Installation — Studio Documents

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 20.x LTS |
| npm | 10.x |
| Compte AWS | Cognito + S3 configurés |
| Compte Vercel | Pour le déploiement (optionnel en local) |

## 1. Cloner et installer

```bash
git clone <url-du-dépôt>
cd pdfme
npm install
```

## 2. Variables d'environnement

Copier le fichier exemple et renseigner toutes les valeurs :

```bash
cp .env.example .env
```

### Variables frontend (exposées au navigateur via `VITE_`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_COGNITO_AUTHORITY` | URL de l'IDP Cognito | `https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_XXXX` |
| `VITE_COGNITO_CLIENT_ID` | Client ID de l'App Client Cognito | `6lsst47elspoa8elmdbo8dear9` |
| `VITE_COGNITO_DOMAIN` | Domaine Cognito (sans https://) | `eu-west-1xxxx.auth.eu-west-1.amazoncognito.com` |
| `VITE_COGNITO_REDIRECT_URIS` | URIs de callback (séparées par virgule) | `http://localhost:5173,https://pdfme.nexsite.fr` |
| `VITE_COGNITO_SCOPE` | Scopes OIDC | `openid profile email` |
| `VITE_COGNITO_ADMIN_GROUP` | Nom du groupe admin Cognito | `admins` |

### Variables backend (Vercel Functions — non exposées)

| Variable | Description |
|----------|-------------|
| `COGNITO_REGION` | Région AWS | `eu-west-1` |
| `COGNITO_USER_POOL_ID` | ID du User Pool | `eu-west-1_XXXX` |
| `COGNITO_CLIENT_ID` | Client ID (même que VITE_) | |
| `COGNITO_ADMIN_GROUP` | Groupe admin (même valeur) | `admins` |
| `S3_BUCKET_ARN` | ARN du bucket S3 | `arn:aws:s3:::pdfme-bucket` |
| `AWS_REGION` | Région du bucket | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | Clé d'accès IAM | |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète IAM | |

> En production sur Vercel, ces variables sont définies dans **Project Settings → Environment Variables**, pas dans `.env`.

## 3. Configuration Cognito

### User Pool

Le User Pool doit avoir les groupes suivants créés manuellement :

| Groupe | Usage |
|--------|-------|
| `admins` | Accès au designer et à la gestion des soumissions |

### App Client

Dans l'App Client Cognito, les **Allowed callback URLs** doivent inclure :

```
http://localhost:5173
https://pdfme.nexsite.fr
```

Et les **Allowed sign-out URLs** :

```
http://localhost:5173
https://pdfme.nexsite.fr
```

**Grant types** requis : `Authorization code grant`  
**Scopes** requis : `openid`, `profile`, `email`

## 4. Lancer en développement

```bash
npm run dev
# Serveur Vite → http://localhost:5173
```

Les fonctions `api/` ne tournent **pas** avec `npm run dev`. Pour les tester localement, utiliser la CLI Vercel :

```bash
npm install -g vercel
vercel dev
# Expose le frontend + les fonctions → http://localhost:3000
```

## 5. Build de production

```bash
npm run build
# Génère le dossier dist/
```

Vérifier le build localement :

```bash
npm run preview
# → http://localhost:4173
```

## Dépannage courant

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| Redirect loop après login | Callback URI non enregistrée dans Cognito | Ajouter l'URI dans l'App Client |
| `401 Unauthorized` sur l'API | Token JWT expiré ou mal transmis | Vérifier `Authorization: Bearer <token>` dans les headers |
| `403 Forbidden` sur templates | Permissions IAM insuffisantes sur S3 | Vérifier la policy IAM de la clé d'accès |
| PDFMe Designer ne charge pas | CDN bloqué ou version incompatible | Vérifier la console réseau, forcer `?v=6.0.6` |
