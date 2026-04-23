# DouceurDeANITA

Application de gestion pour pâtisserie et traiteur artisanal suisse.

Construit avec React, Vite, TypeScript, Tailwind CSS et Supabase.

## Installation

```bash
npm install
```

## Configuration

Copier le fichier d'exemple et renseigner les variables d'environnement :

```bash
cp .env.local.example .env.local
```

Variables requises :

- `VITE_SUPABASE_URL` — l'URL de votre projet Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — la clé publiable (anon) Supabase

## Démarrage en développement

```bash
npm run dev
```

L'application est disponible sur [http://localhost:5173](http://localhost:5173).

## Build de production

```bash
npm run build
npm run preview
```

## Déploiement sur Vercel

1. Pousser le projet sur un dépôt Git (GitHub, GitLab, Bitbucket).
2. Importer le projet sur [Vercel](https://vercel.com/new).
3. Framework preset : **Vite**.
4. Renseigner les variables d'environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Déployer.

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run preview` — prévisualisation du build
- `npm run lint` — analyse statique du code
