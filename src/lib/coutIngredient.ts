import type { UniteIngredient } from './types'

/**
 * Tente de convertir une quantité d'une unité vers une autre.
 * Retourne null si la conversion n'est pas définie (unités incompatibles).
 *
 * Conversions supportées :
 *  - g ↔ kg (×/÷ 1000)
 *  - ml ↔ l (×/÷ 1000)
 *  - piece, cuillere, pincee : pas de conversion → seulement si unités identiques.
 */
export function convertirQuantite(
  quantite: number,
  depuis: UniteIngredient,
  vers: UniteIngredient
): number | null {
  if (depuis === vers) return quantite

  // Masse
  if (depuis === 'g' && vers === 'kg') return quantite / 1000
  if (depuis === 'kg' && vers === 'g') return quantite * 1000

  // Volume
  if (depuis === 'ml' && vers === 'l') return quantite / 1000
  if (depuis === 'l' && vers === 'ml') return quantite * 1000

  // Sinon : pas de conversion possible
  return null
}

/**
 * Calcule le coût d'une ligne de composition (un ingrédient dans une recette).
 * - `quantiteRecette` : quantité utilisée dans la recette
 * - `uniteRecette` : unité utilisée dans la recette
 * - `prixUnitaireAchat` : prix unitaire dans l'unité d'achat
 * - `uniteAchat` : unité d'achat de l'ingrédient
 *
 * Retourne le coût en CHF, ou null si conversion impossible.
 */
export function coutLigneCHF(
  quantiteRecette: number,
  uniteRecette: UniteIngredient,
  prixUnitaireAchat: number,
  uniteAchat: UniteIngredient
): number | null {
  const qConvertie = convertirQuantite(quantiteRecette, uniteRecette, uniteAchat)
  if (qConvertie === null) return null
  return qConvertie * prixUnitaireAchat
}
