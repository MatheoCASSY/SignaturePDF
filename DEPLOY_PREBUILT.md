# Deploiement Vercel prebuilt

Ce mode contourne le build distant Vercel (et donc la limite de 45 min) en construisant localement puis en envoyant un artefact prebuilt.

## Prerequis

- Etre connecte a Vercel (`npx vercel login`)
- Avoir lie le projet au moins une fois (`npx vercel link`)

## Commande unique

```bash
npm run vercel:prebuilt
```

Cette commande enchaine:

1. `vercel pull` pour recuperer la configuration environnement
2. `vercel build --prod` pour generer `.vercel/output` localement
3. `vercel deploy --prebuilt --prod` pour deployer sans build distant

## Commandes separees

```bash
npm run vercel:pull
npm run vercel:build:prebuilt
npm run vercel:deploy:prebuilt
```

## Verification rapide

Dans les logs Vercel du deploiement, tu dois voir un flux prebuilt (pas d'etape d'installation npm ni de build Vite cote remote).

## Backend de publication

Cette version de l'application publie les templates dans S3 et controle l'accès avec Cognito JWT.

Bucket cible:

- `arn:aws:s3:::pdfme-235500188147-eu-west-1-an`

Variables attendues dans l'environnement Vercel:

- `S3_BUCKET_ARN` ou `S3_BUCKET_NAME`
- `AWS_REGION` ou `S3_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_ADMIN_GROUP` si tu utilises un groupe dédié pour l'administration

Variables frontend OIDC (Vite) pour le login Cognito:

- `VITE_COGNITO_AUTHORITY` (issuer user pool, ex: `https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_e3giVfjQy`)
- `VITE_COGNITO_CLIENT_ID` (ex: `6lsst47elspoa8elmdbo8dear9`)
- `VITE_COGNITO_REDIRECT_URI` (ex: `https://nexsite.fr`)
- `VITE_COGNITO_LOGOUT_URI` (souvent la meme URL que le redirect)
- `VITE_COGNITO_DOMAIN` (domaine Hosted UI Cognito, ex: `https://<ton-domaine>.auth.eu-west-1.amazoncognito.com`)
- `VITE_COGNITO_ADMIN_GROUP` si tu veux personnaliser le groupe admin détecté côté client
- `VITE_COGNITO_SCOPE` (recommandé: `openid profile email`)

Comportement:

- La page Login oriente automatiquement vers Admin ou Signature selon le rôle Cognito.
- La page Admin sert à publier un template, l'enregistrer dans S3 et lui attribuer des accès Cognito.
- La page Signature liste les documents attribués à l'utilisateur, permet de remplir les champs puis d'exporter le PDF final.
- Les templates et les accès sont persistés dans des objets JSON S3.
- Un accès est consommé après export du PDF final, ou peut autoriser plusieurs usages si l'admin le configure.

## IAM minimale recommandee

Utilise la policy prête dans:

- `infra/iam-policy-s3-pdfme.json`

Cette policy limite l'accès au bucket cible uniquement sur les prefixes `templates/` et `access/`.

## Synchroniser les variables vers Vercel

Tu peux pousser toutes les variables depuis un fichier `.env.local` avec:

```bash
npm run vercel:env:sync
```

Optionnel avec cible explicite:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/vercel-env-sync.ps1 -EnvFile .env.local -Target production
```
