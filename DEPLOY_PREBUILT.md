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
