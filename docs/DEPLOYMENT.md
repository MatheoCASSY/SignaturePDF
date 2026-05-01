# Déploiement — Studio Documents

## Infrastructure

| Service | Rôle | Région |
|---------|------|--------|
| **Vercel** | Hébergement frontend + Serverless Functions | Edge (global) |
| **AWS S3** | Stockage templates JSON + PDFs soumis | `eu-west-1` |
| **AWS Cognito** | Authentification utilisateurs (User Pool) | `eu-west-1` |

## Déploiement sur Vercel

### 1. Lier le projet Vercel

```bash
npm install -g vercel
vercel login
vercel link
# Suivre les instructions pour lier au projet Vercel existant
```

### 2. Configurer les variables d'environnement

Dans Vercel Dashboard → Project → **Settings → Environment Variables**, ajouter :

**Pour le frontend (accessible via `VITE_`)** :
```
VITE_COGNITO_AUTHORITY=https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_XXXX
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_COGNITO_DOMAIN=eu-west-1xxxx.auth.eu-west-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URIS=https://pdfme.nexsite.fr
VITE_COGNITO_SCOPE=openid profile email
VITE_COGNITO_ADMIN_GROUP=admins
```

**Pour les fonctions serverless (non exposées)** :
```
COGNITO_REGION=eu-west-1
COGNITO_USER_POOL_ID=eu-west-1_XXXX
COGNITO_CLIENT_ID=xxxxx
COGNITO_ADMIN_GROUP=admins
S3_BUCKET_ARN=arn:aws:s3:::pdfme-bucket
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxxxx
```

> Définir ces variables pour les environnements **Production**, **Preview** et **Development** selon les besoins.

### 3. Déployer

```bash
# Déploiement en production
vercel --prod

# OU via le script npm
npm run vercel:prebuilt
```

### 4. Auto-deploy

Tout push sur la branche `main` déclenche automatiquement un déploiement de production via l'intégration GitHub de Vercel.

## Configuration S3

### Bucket

Créer un bucket S3 dans `eu-west-1` avec la structure suivante (Vercel Functions gèrent la création des objets) :

```
pdfme-bucket/
├── templates/          # Templates JSON (CRUD admin)
├── submissions/        # PDFs soumis par les signataires
└── grants/             # Fichiers d'autorisation
```

### Policy IAM

Créer un utilisateur IAM dédié avec la policy suivante :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::pdfme-bucket",
        "arn:aws:s3:::pdfme-bucket/*"
      ]
    }
  ]
}
```

### CORS du bucket

Ajouter une CORS configuration sur le bucket S3 pour les URLs présignées :

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://pdfme.nexsite.fr"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Environnements

| Environnement | URL | Branche | Callback URI Cognito |
|---------------|-----|---------|---------------------|
| Production | `https://pdfme.nexsite.fr` | `main` | `https://pdfme.nexsite.fr` |
| Preview | `https://pdfme-git-*.vercel.app` | toutes autres | Ajouter si nécessaire |
| Local | `http://localhost:5173` | — | `http://localhost:5173` |

## Mise à jour Cognito (callback URIs)

Après ajout d'un environnement, mettre à jour l'App Client Cognito :
- **AWS Console** → Cognito → User Pools → App Clients → Edit
- Ajouter la nouvelle URL dans *Allowed callback URLs* et *Allowed sign-out URLs*

## Rollback

Vercel conserve l'historique de tous les déploiements. Pour revenir en arrière :

```bash
vercel rollback
# OU depuis le dashboard Vercel → Deployments → choisir un déploiement → Promote to Production
```
