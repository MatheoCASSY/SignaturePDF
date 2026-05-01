# Fonctionnalités — Studio Documents

## Pages de l'application

### Page Login (`src/pages/login/page.ts`)

**Accès** : Public (redirection automatique si déjà connecté)

Interface de connexion via AWS Cognito. Un clic sur le bouton "Se connecter" redirige vers le formulaire de login Cognito hébergé. Après authentification, Cognito renvoie vers la callback URI et l'app route automatiquement vers la page appropriée selon le rôle.

**Comportement :**
- Si token valide en `localStorage` → skip login, route directement
- Après login admin → `/admin`
- Après login signataire → `/user`

---

### Page Designer (`src/pages/design/page.ts`)

**Accès** : Groupe `admins` uniquement

Interface de création et d'édition de templates PDF. S'appuie sur le composant **PDFMe Designer** chargé depuis le CDN ESM.

**Fonctionnalités :**

| Fonctionnalité | Description |
|----------------|-------------|
| **Canvas de design** | Glisser-déposer des champs (texte, image, QR code, table…) sur un fond PDF |
| **Types de champs** | Text, Image, QR Code, Table, Rectangle, Line, SVG, Date/Time |
| **Propriétés de champ** | Position, taille, police, couleur, alignement, valeur par défaut |
| **Import de PDF** | Charger un PDF existant comme fond de page |
| **Ajout de pages** | Templates multi-pages supportés |
| **Sauvegarde** | Export du template en JSON → envoyé à `/api/templates` → stocké en S3 |
| **Chargement** | Liste des templates existants, chargement en un clic |
| **Prévisualisation** | Génération d'un PDF d'aperçu avec `@pdfme/generator` |

**Flux de sauvegarde :**
1. L'admin clique "Sauvegarder"
2. Le Designer retourne le template JSON (schéma + fond PDF en base64)
3. `core/remote.ts` → `POST /api/templates`
4. L'API valide le token admin et stocke dans S3

---

### Page Accès (`src/pages/access/page.ts`)

**Accès** : Groupe `admins` uniquement

Tableau de bord de gestion des droits de signature et des soumissions.

**Section "Accorder un accès" :**
- Saisie de l'email Cognito d'un utilisateur
- Sélection d'un template depuis la liste
- Appel `POST /api/access/grant`
- L'utilisateur peut désormais remplir ce template

**Section "Accès existants" :**
- Liste de tous les grants actifs (par template)
- Bouton de révocation par grant → `DELETE /api/access/revoke`

**Section "Soumissions" :**
- Tableau de toutes les soumissions reçues
- Colonnes : template, utilisateur, date, statut
- Bouton de téléchargement par soumission → URL présignée S3 (15 min)
- Filtre par template ou par utilisateur

---

### Page Remplir (`src/pages/remplir/page.ts`)

**Accès** : Utilisateurs Cognito ayant reçu un grant

Interface de remplissage et soumission de formulaire PDF. S'appuie sur le composant **PDFMe Form**.

**Flux utilisateur :**
1. Chargement des templates auxquels l'utilisateur a accès (`POST /api/access/check`)
2. Sélection du template
3. Affichage du formulaire interactif (champs à remplir)
4. Validation + génération du PDF final avec `@pdfme/generator`
5. Soumission du PDF → `POST /api/submissions` (upload S3)
6. Confirmation de soumission

**Fonctionnalités :**

| Fonctionnalité | Description |
|----------------|-------------|
| **Formulaire dynamique** | Champs générés selon le schéma du template |
| **Validation** | Champs requis vérifiés avant soumission |
| **Aperçu live** | PDF mis à jour en temps réel à chaque saisie |
| **Signature** | Champ signature dessinable (si configuré dans le template) |
| **Sauvegarde brouillon** | Draft sauvegardé en `localStorage` (reprise possible) |
| **Génération PDF** | `@pdfme/generator` compile le template + les inputs → PDF Blob |
| **Soumission** | Upload du PDF vers S3 via `/api/submissions` |

---

## Gestion d'état global

L'`AppState` dans `app.ts` est la source de vérité unique. Toute mise à jour passe par des fonctions de mutation centralisées, ce qui évite les états incohérents entre pages.

**Persistance locale :**
- Template actif → `localStorage`
- Brouillon du formulaire → `localStorage`
- Token OIDC → géré par `oidc-client-ts`

---

## Types de champs PDF supportés (PDFMe v6)

| Type | Description |
|------|-------------|
| `text` | Champ texte libre ou calculé |
| `image` | Upload ou URL d'image |
| `qrcode` | QR Code généré depuis une valeur |
| `table` | Tableau à lignes dynamiques |
| `rectangle` | Forme géométrique (décoration) |
| `line` | Ligne horizontale/verticale |
| `svg` | Illustration vectorielle |
| `dateTime` | Date/heure formatée |
| `readOnlyText` | Texte fixe non modifiable par le signataire |
