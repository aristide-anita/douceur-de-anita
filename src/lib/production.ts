import { supabase } from './supabase'
import type {
  CommandeAvecClient,
  CommandeItem,
  Ingredient,
  Recette,
  RecetteIngredient,
  UniteIngredient,
} from './types'
import { convertirQuantite } from './coutIngredient'

/** Commande enrichie pour la planification (avec items et client court). */
export interface CommandePourPlan extends CommandeAvecClient {
  items: CommandeItem[]
}

export interface RegroupementRecette {
  recette_id: string | null
  recette_nom: string
  /** Quantité totale demandée (somme des items.quantite). */
  quantite_totale: number
  /** Lignes individuelles, pour drilldown. */
  lignes: {
    commande_id: string
    client_nom: string | null
    quantite: number
    date_evenement: string
  }[]
  /** Si la recette a une portions de base, nombre de "fournées" estimées. */
  fournees?: number
  /** Temps de prépa cumulé estimé (minutes). */
  temps_total_min?: number
}

export interface BesoinIngredient {
  ingredient_id: string
  nom: string
  /** Unité d'achat (utilisée pour la quantité affichée). */
  unite: UniteIngredient
  /** Quantité totale à avoir, exprimée en `unite`. */
  quantite_totale: number
  /** Stock actuel disponible. */
  stock_actuel: number
  /** Quantité manquante à acheter (= max(0, totale - stock)). */
  manquant: number
  /** Prix unitaire indicatif (CHF). */
  prix_unitaire: number
  /** Coût estimé du manquant. */
  cout_manquant: number
}

/**
 * Charge toutes les commandes "en production" sur [dateMin, dateMax] (inclus),
 * avec leurs items + client court. Filtre par statut.
 */
export async function chargerCommandesProduction(
  dateMin: string,
  dateMax: string
): Promise<CommandePourPlan[]> {
  const { data, error } = await supabase
    .from('commandes')
    .select(
      '*, client:clients(id, nom, telephone), items:commande_items(*)'
    )
    .gte('date_evenement', dateMin)
    .lte('date_evenement', dateMax)
    .in('statut', ['confirmee', 'en_preparation', 'prete'])
    .order('date_evenement', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CommandePourPlan[]
}

/** Regroupe les items par recette (utilisé pour la vue "production par recette"). */
export function regrouperParRecette(
  commandes: CommandePourPlan[],
  recettes: Map<string, Pick<Recette, 'id' | 'nom' | 'portions' | 'temps_prepa_min'>>
): RegroupementRecette[] {
  const map = new Map<string, RegroupementRecette>()

  for (const cmd of commandes) {
    for (const item of cmd.items) {
      const key = item.recette_id ?? `libre:${item.nom_libre ?? 'Article'}`
      const recetteRef = item.recette_id
        ? recettes.get(item.recette_id)
        : undefined
      const nom =
        recetteRef?.nom ?? item.nom_libre ?? 'Article'
      const courant =
        map.get(key) ??
        ({
          recette_id: item.recette_id,
          recette_nom: nom,
          quantite_totale: 0,
          lignes: [],
        } as RegroupementRecette)
      courant.quantite_totale += item.quantite
      courant.lignes.push({
        commande_id: cmd.id,
        client_nom: cmd.client?.nom ?? null,
        quantite: item.quantite,
        date_evenement: cmd.date_evenement,
      })

      if (recetteRef) {
        const portions = recetteRef.portions || 1
        courant.fournees = (courant.quantite_totale || 0) / portions
        if (recetteRef.temps_prepa_min) {
          courant.temps_total_min =
            (courant.fournees ?? 0) * recetteRef.temps_prepa_min
        }
      }

      map.set(key, courant)
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.recette_nom.localeCompare(b.recette_nom)
  )
}

/**
 * Calcule les besoins en ingrédients à partir des commandes filtrées,
 * en croisant recette_ingredients × facteur (quantite item / portions recette).
 * Soustrait le stock actuel pour donner la quantité à acheter.
 */
export function calculerBesoinsIngredients(
  commandes: CommandePourPlan[],
  recettes: Map<string, Pick<Recette, 'id' | 'portions'>>,
  recetteIngredients: Map<string, RecetteIngredient[]>,
  ingredients: Map<string, Ingredient>
): BesoinIngredient[] {
  // Accumulateur : { ingredient_id : quantite_totale en unite d'achat }
  const accu = new Map<string, number>()

  for (const cmd of commandes) {
    for (const item of cmd.items) {
      if (!item.recette_id) continue
      const recette = recettes.get(item.recette_id)
      if (!recette) continue
      const composition = recetteIngredients.get(item.recette_id) ?? []
      const portions = recette.portions || 1
      const facteur = item.quantite / portions

      for (const ri of composition) {
        const ing = ingredients.get(ri.ingredient_id)
        if (!ing) continue
        const qDansAchat = convertirQuantite(
          Number(ri.quantite) * facteur,
          ri.unite,
          ing.unite_achat
        )
        if (qDansAchat === null) continue
        accu.set(
          ri.ingredient_id,
          (accu.get(ri.ingredient_id) ?? 0) + qDansAchat
        )
      }
    }
  }

  const besoins: BesoinIngredient[] = []
  for (const [id, total] of accu.entries()) {
    const ing = ingredients.get(id)
    if (!ing) continue
    const stock = Number(ing.stock_actuel ?? 0)
    const manquant = Math.max(0, total - stock)
    besoins.push({
      ingredient_id: id,
      nom: ing.nom,
      unite: ing.unite_achat,
      quantite_totale: total,
      stock_actuel: stock,
      manquant,
      prix_unitaire: Number(ing.prix_unitaire_chf ?? 0),
      cout_manquant: manquant * Number(ing.prix_unitaire_chf ?? 0),
    })
  }

  return besoins.sort((a, b) => a.nom.localeCompare(b.nom))
}
