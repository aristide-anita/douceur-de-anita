-- Migration : passage de photo_url (string) à photos (text[]) sur les recettes.
-- À exécuter dans Supabase SQL Editor avant le déploiement.

-- 1. Ajoute la colonne `photos` (tableau de URLs publiques Storage)
ALTER TABLE recettes
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- 2. Backfill : pour les recettes existantes qui ont un photo_url, on le pousse dans photos.
UPDATE recettes
SET photos = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND (photos IS NULL OR cardinality(photos) = 0);

-- 3. (Optionnel — à exécuter plus tard, quand on est sûr que tout le code a migré)
-- ALTER TABLE recettes DROP COLUMN photo_url;
