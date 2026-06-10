import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, AlertCircle, Sprout } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Ingredient, UniteIngredient } from '../lib/types'
import { UNITE_LABELS } from '../lib/types'
import { coutLigneCHF, convertirQuantite } from '../lib/coutIngredient'

/** Ligne de composition affichée dans le formulaire (état local React). */
export interface LigneCompo {
  /** id UI local */
  uid: string
  /** id en base si la ligne existait déjà (sinon null pour nouvelle ligne) */
  dbId: string | null
  ingredient_id: string
  quantite: number
  unite: UniteIngredient
  note: string
}

interface Props {
  lignes: LigneCompo[]
  onChange: (next: LigneCompo[]) => void
  /** Coût total calculé renvoyé au parent (pour préremplir cout_matieres). */
  onCoutTotalChange?: (cout: number, lignesValables: boolean) => void
  disabled?: boolean
}

function nouvelleLigne(): LigneCompo {
  return {
    uid: crypto.randomUUID(),
    dbId: null,
    ingredient_id: '',
    quantite: 0,
    unite: 'g',
    note: '',
  }
}

function formatCHF(n: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(n)
}

/**
 * Section UI pour composer une recette à partir d'ingrédients.
 * Charge la liste des ingrédients depuis Supabase, calcule le coût total
 * et expose les lignes au parent (qui gère la persistance).
 */
export default function CompositionRecette({
  lignes,
  onChange,
  onCoutTotalChange,
  disabled = false,
}: Props) {
  const [erreurLocale, setErreurLocale] = useState<string | null>(null)

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ['ingredients-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('actif', true)
        .order('nom', { ascending: true })
      if (error) throw error
      return (data ?? []) as Ingredient[]
    },
    staleTime: 60_000,
  })

  const indexIng = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredients) m.set(i.id, i)
    return m
  }, [ingredients])

  const { coutTotal, toutesValables } = useMemo(() => {
    let total = 0
    let valables = true
    for (const l of lignes) {
      const ing = indexIng.get(l.ingredient_id)
      if (!ing || !l.quantite) continue
      const c = coutLigneCHF(
        l.quantite,
        l.unite,
        ing.prix_unitaire_chf,
        ing.unite_achat
      )
      if (c === null) {
        valables = false
        continue
      }
      total += c
    }
    return { coutTotal: total, toutesValables: valables }
  }, [lignes, indexIng])

  // Remonte le total au parent
  useEffect(() => {
    onCoutTotalChange?.(coutTotal, toutesValables)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coutTotal, toutesValables])

  const ajouterLigne = () => {
    if (disabled) return
    onChange([...lignes, nouvelleLigne()])
  }

  const retirerLigne = (uid: string) => {
    if (disabled) return
    onChange(lignes.filter((l) => l.uid !== uid))
  }

  const majLigne = (uid: string, patch: Partial<LigneCompo>) => {
    if (disabled) return
    setErreurLocale(null)
    onChange(
      lignes.map((l) => {
        if (l.uid !== uid) return l
        const next = { ...l, ...patch }
        // Si on change d'ingrédient, on aligne l'unité par défaut
        if (patch.ingredient_id && patch.ingredient_id !== l.ingredient_id) {
          const ing = indexIng.get(patch.ingredient_id)
          if (ing) next.unite = ing.unite_achat
        }
        return next
      })
    )
  }

  return (
    <div>
      {ingredients.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-soft-taupe/70 bg-cream/40 p-5 text-sm text-warm-brown/70">
          Aucun ingrédient n’existe encore.{' '}
          <Link
            to="/ingredients/nouveau"
            className="underline text-warm-brown font-medium hover:no-underline"
          >
            Créer le premier ingrédient
          </Link>
          .
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="space-y-3">
          {lignes.length === 0 && (
            <p className="text-sm text-warm-brown/60 italic">
              Aucun ingrédient ajouté. Le coût matières restera saisi à la main.
            </p>
          )}

          {lignes.map((l) => {
            const ing = indexIng.get(l.ingredient_id)
            const cout =
              ing && l.quantite
                ? coutLigneCHF(l.quantite, l.unite, ing.prix_unitaire_chf, ing.unite_achat)
                : null
            const incompatible = cout === null && ing && l.quantite > 0
            return (
              <div
                key={l.uid}
                className="rounded-2xl border border-soft-taupe/50 bg-cream/30 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="text-xs text-warm-brown/70 mb-1 block">
                      Ingrédient
                    </span>
                    <select
                      value={l.ingredient_id}
                      onChange={(e) =>
                        majLigne(l.uid, { ingredient_id: e.target.value })
                      }
                      className="input-field"
                      disabled={disabled}
                    >
                      <option value="">— Choisir —</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nom} ({formatCHF(i.prix_unitaire_chf)}/
                          {UNITE_LABELS[i.unite_achat]})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-warm-brown/70 mb-1 block">
                      Quantité
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.001}
                      value={l.quantite || ''}
                      onChange={(e) =>
                        majLigne(l.uid, { quantite: Number(e.target.value) || 0 })
                      }
                      className="input-field"
                      placeholder="0"
                      disabled={disabled}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-warm-brown/70 mb-1 block">
                      Unité
                    </span>
                    <select
                      value={l.unite}
                      onChange={(e) =>
                        majLigne(l.uid, {
                          unite: e.target.value as UniteIngredient,
                        })
                      }
                      className="input-field"
                      disabled={disabled}
                    >
                      {(Object.keys(UNITE_LABELS) as UniteIngredient[]).map((u) => {
                        const compat =
                          !ing ||
                          convertirQuantite(1, u, ing.unite_achat) !== null
                        return (
                          <option key={u} value={u} disabled={!compat}>
                            {UNITE_LABELS[u]}
                            {!compat ? ' (incompatible)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => retirerLigne(l.uid)}
                    disabled={disabled}
                    aria-label="Retirer cet ingrédient"
                    className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-alert-red/10 hover:bg-alert-red/20 text-alert-red disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {cout !== null && (
                    <span className="text-warm-brown/70">
                      Coût ligne :{' '}
                      <strong className="text-warm-brown tabular-nums">
                        {formatCHF(cout)}
                      </strong>
                    </span>
                  )}
                  {incompatible && (
                    <span className="inline-flex items-center gap-1 text-alert-red">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Unité incompatible avec l’unité d’achat (
                      {ing && UNITE_LABELS[ing.unite_achat]}).
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={ajouterLigne}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 border border-soft-taupe/60 px-3 py-2 text-sm font-medium text-warm-brown disabled:opacity-60 min-h-[40px]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajouter un ingrédient
            </button>
            {lignes.length > 0 && (
              <div className="text-sm text-warm-brown">
                <Sprout className="inline h-4 w-4 mr-1" aria-hidden="true" />
                Coût matières calculé :{' '}
                <strong className="tabular-nums">{formatCHF(coutTotal)}</strong>
                {!toutesValables && (
                  <span className="text-alert-red ml-2">
                    (lignes incompatibles ignorées)
                  </span>
                )}
              </div>
            )}
          </div>

          {erreurLocale && (
            <p className="text-sm text-alert-red">{erreurLocale}</p>
          )}
        </div>
      )}
    </div>
  )
}
