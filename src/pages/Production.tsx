import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  AlertCircle,
  Printer,
  ChefHat,
  ShoppingCart,
  Clock,
  MessageCircle,
  Sprout,
  ChevronRight,
  Package,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  Recette,
  RecetteIngredient,
  Ingredient,
} from '../lib/types'
import { UNITE_LABELS } from '../lib/types'
import {
  chargerCommandesProduction,
  regrouperParRecette,
  calculerBesoinsIngredients,
  type CommandePourPlan,
} from '../lib/production'

type Horizon = '1' | '3' | '7'

const HORIZONS: { value: Horizon; label: string; jours: number }[] = [
  { value: '1', label: "Aujourd'hui", jours: 0 },
  { value: '3', label: '3 jours', jours: 2 },
  { value: '7', label: '7 jours', jours: 6 },
]

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function chf(n: number): string {
  return `${n.toFixed(2)} CHF`
}

function formaterMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return r > 0 ? `${h} h ${r} min` : `${h} h`
}

function formaterQuantite(n: number, unite: string): string {
  const arrondi =
    n >= 100
      ? n.toLocaleString('fr-CH', { maximumFractionDigits: 0 })
      : n.toLocaleString('fr-CH', { maximumFractionDigits: 3 })
  return `${arrondi} ${unite}`
}

function dateFR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function Production() {
  const [dateRef, setDateRef] = useState<string>(() => ymd(new Date()))
  const [horizon, setHorizon] = useState<Horizon>('7')

  const dateMin = dateRef
  const dateMax = useMemo(() => {
    const h = HORIZONS.find((x) => x.value === horizon)
    const [y, m, d] = dateRef.split('-').map(Number)
    const max = new Date(y, m - 1, d + (h?.jours ?? 0))
    return ymd(max)
  }, [dateRef, horizon])

  const { data: commandes = [], isLoading: chargementCmd, error } = useQuery<
    CommandePourPlan[]
  >({
    queryKey: ['production-cmd', dateMin, dateMax],
    queryFn: () => chargerCommandesProduction(dateMin, dateMax),
    staleTime: 30_000,
  })

  // Recettes utilisées (uniques)
  const recetteIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of commandes)
      for (const it of c.items)
        if (it.recette_id) s.add(it.recette_id)
    return Array.from(s)
  }, [commandes])

  const { data: recettesDb = [] } = useQuery<Recette[]>({
    queryKey: ['production-recettes', recetteIds.join(',')],
    enabled: recetteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recettes')
        .select('id, nom, portions, temps_prepa_min')
        .in('id', recetteIds)
      if (error) throw error
      return (data ?? []) as unknown as Recette[]
    },
    staleTime: 60_000,
  })

  const { data: recetteIngredientsDb = [] } = useQuery<RecetteIngredient[]>({
    queryKey: ['production-recette-ing', recetteIds.join(',')],
    enabled: recetteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recette_ingredients')
        .select('*')
        .in('recette_id', recetteIds)
      if (error) throw error
      return (data ?? []) as RecetteIngredient[]
    },
    staleTime: 60_000,
  })

  const ingredientIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of recetteIngredientsDb) s.add(r.ingredient_id)
    return Array.from(s)
  }, [recetteIngredientsDb])

  const { data: ingredientsDb = [] } = useQuery<Ingredient[]>({
    queryKey: ['production-ingredients', ingredientIds.join(',')],
    enabled: ingredientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .in('id', ingredientIds)
      if (error) throw error
      return (data ?? []) as Ingredient[]
    },
    staleTime: 60_000,
  })

  // Maps pour calcul
  const mapRecettes = useMemo(() => {
    const m = new Map<string, Recette>()
    for (const r of recettesDb) m.set(r.id, r)
    return m
  }, [recettesDb])

  const mapRecetteIngredients = useMemo(() => {
    const m = new Map<string, RecetteIngredient[]>()
    for (const ri of recetteIngredientsDb) {
      const arr = m.get(ri.recette_id) ?? []
      arr.push(ri)
      m.set(ri.recette_id, arr)
    }
    return m
  }, [recetteIngredientsDb])

  const mapIngredients = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredientsDb) m.set(i.id, i)
    return m
  }, [ingredientsDb])

  const regroupements = useMemo(
    () => regrouperParRecette(commandes, mapRecettes),
    [commandes, mapRecettes]
  )

  const besoins = useMemo(
    () =>
      calculerBesoinsIngredients(
        commandes,
        mapRecettes,
        mapRecetteIngredients,
        mapIngredients
      ),
    [commandes, mapRecettes, mapRecetteIngredients, mapIngredients]
  )

  const totalTempsMin = regroupements.reduce(
    (s, r) => s + (r.temps_total_min ?? 0),
    0
  )

  const coutTotalManquant = besoins.reduce((s, b) => s + b.cout_manquant, 0)

  const periode =
    dateMin === dateMax
      ? dateFR(dateMin)
      : `${dateFR(dateMin)} → ${dateFR(dateMax)}`

  // Liste de courses sous forme de texte (pour WhatsApp / impression)
  const texteCourses = useMemo(() => {
    const aAcheter = besoins.filter((b) => b.manquant > 0)
    if (aAcheter.length === 0) return null
    const lignes = [`🛒 Liste de courses — ${periode}`, '']
    for (const b of aAcheter) {
      lignes.push(
        `• ${b.nom} : ${formaterQuantite(b.manquant, UNITE_LABELS[b.unite])}`
      )
    }
    lignes.push('')
    lignes.push(`Total estimé : ${chf(coutTotalManquant)}`)
    return lignes.join('\n')
  }, [besoins, periode, coutTotalManquant])

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-warm-brown/80" aria-hidden="true" />
            Plan de production
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            Vue agrégée par recette + liste de courses générée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 border border-soft-taupe/60 px-4 py-2 text-sm font-medium text-warm-brown min-h-[40px]"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimer
        </button>
      </header>

      {/* Bandeau impression */}
      <header className="hidden print:block mb-6">
        <h1 className="font-serif text-2xl text-warm-brown">
          Plan de production — {periode}
        </h1>
        <p className="text-sm text-warm-brown/70">DouceurDeANITA</p>
      </header>

      {/* Sélecteurs */}
      <div className="card mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <label className="block">
          <span className="text-sm text-warm-brown/80 mb-2 block">
            À partir du
          </span>
          <input
            type="date"
            value={dateRef}
            onChange={(e) => setDateRef(e.target.value)}
            className="input-field"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHorizon(h.value)}
              className={
                'px-3 py-2 rounded-2xl text-sm font-medium transition min-h-[40px] ' +
                (horizon === h.value
                  ? 'bg-warm-brown text-cream'
                  : 'bg-cream/60 text-warm-brown hover:bg-soft-taupe/40')
              }
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {chargementCmd && (
        <div className="card flex items-center justify-center py-14 text-warm-brown/60">
          <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
          Chargement…
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="card flex items-start gap-3 py-6 bg-alert-red/5 border-alert-red/30"
        >
          <AlertCircle
            className="h-5 w-5 text-alert-red flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm text-alert-red">
            Impossible de charger le plan de production.
            <div className="text-xs mt-1 text-alert-red/80">
              {(error as Error).message}
            </div>
          </div>
        </div>
      )}

      {!chargementCmd && !error && commandes.length === 0 && (
        <div className="card flex flex-col items-center text-center py-14 print:hidden">
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-caramel/20 text-5xl mb-6"
          >
            🍰
          </div>
          <h2 className="font-serif text-2xl mb-2">
            Rien à préparer sur cette période
          </h2>
          <p className="text-warm-brown/60 max-w-sm">
            Aucune commande confirmée ou en préparation entre {dateFR(dateMin)} et{' '}
            {dateFR(dateMax)}.
          </p>
        </div>
      )}

      {!chargementCmd && !error && commandes.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Colonne principale : production par recette */}
          <section>
            <div className="card mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-warm-brown">
                <strong>{commandes.length}</strong> commande
                {commandes.length > 1 ? 's' : ''} ·{' '}
                <strong>{regroupements.length}</strong> recette
                {regroupements.length > 1 ? 's' : ''} à produire
              </div>
              {totalTempsMin > 0 && (
                <div className="text-sm text-warm-brown/80 inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Temps total estimé :{' '}
                  <strong>{formaterMinutes(totalTempsMin)}</strong>
                </div>
              )}
            </div>

            <ul className="space-y-3">
              {regroupements.map((r) => (
                <li
                  key={r.recette_id ?? r.recette_nom}
                  className="card hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl text-warm-brown">
                        {r.recette_nom}
                      </h3>
                      <p className="text-sm text-warm-brown/60 mt-0.5">
                        <strong className="text-warm-brown">
                          {r.quantite_totale}
                        </strong>{' '}
                        à préparer
                        {r.fournees !== undefined && r.fournees > 0 && (
                          <>
                            {' '}· {r.fournees.toLocaleString('fr-CH', {
                              maximumFractionDigits: 2,
                            })}{' '}
                            fournée{r.fournees > 1 ? 's' : ''}
                          </>
                        )}
                        {r.temps_total_min !== undefined &&
                          r.temps_total_min > 0 && (
                            <> · {formaterMinutes(r.temps_total_min)}</>
                          )}
                      </p>
                    </div>
                    {r.recette_id && (
                      <Link
                        to={`/recettes/${r.recette_id}`}
                        className="text-sm text-warm-brown/70 hover:text-warm-brown inline-flex items-center gap-1 print:hidden"
                      >
                        Voir
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>

                  <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                    {r.lignes.map((l, idx) => (
                      <li
                        key={idx}
                        className="flex items-baseline justify-between gap-3 rounded-xl bg-cream/60 px-3 py-2"
                      >
                        <span className="text-warm-brown truncate">
                          <Link
                            to={`/commandes/${l.commande_id}`}
                            className="hover:underline"
                          >
                            {l.client_nom ?? 'Client retiré'}
                          </Link>
                          <span className="text-warm-brown/50 ml-1.5 text-xs">
                            {dateFR(l.date_evenement)}
                          </span>
                        </span>
                        <span className="font-medium text-warm-brown tabular-nums">
                          × {l.quantite}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {/* Colonne droite : liste de courses */}
          <aside className="space-y-4 print:contents">
            <div className="card">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-serif text-xl inline-flex items-center gap-2">
                  <ShoppingCart
                    className="h-5 w-5 text-warm-brown/70"
                    aria-hidden="true"
                  />
                  Liste de courses
                </h2>
                {besoins.length > 0 && (
                  <span className="text-xs text-warm-brown/60">
                    {besoins.filter((b) => b.manquant > 0).length} à acheter
                  </span>
                )}
              </div>

              {besoins.length === 0 ? (
                <p className="text-sm text-warm-brown/60">
                  Aucun ingrédient référencé sur les recettes commandées —
                  associe d’abord des ingrédients à tes recettes.
                </p>
              ) : (
                <>
                  <ul className="space-y-2 mb-4">
                    {besoins.map((b) => {
                      const stockOk = b.manquant === 0
                      return (
                        <li
                          key={b.ingredient_id}
                          className={
                            'rounded-xl px-3 py-2 ' +
                            (stockOk
                              ? 'bg-emerald-100/40 text-emerald-900'
                              : 'bg-cream/60 text-warm-brown')
                          }
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium truncate">
                              <Link
                                to={`/ingredients/${b.ingredient_id}`}
                                className="hover:underline"
                              >
                                {b.nom}
                              </Link>
                            </span>
                            <span className="text-sm tabular-nums whitespace-nowrap">
                              {stockOk ? (
                                <span className="inline-flex items-center gap-1">
                                  <Sprout
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Stock OK
                                </span>
                              ) : (
                                <strong>
                                  {formaterQuantite(
                                    b.manquant,
                                    UNITE_LABELS[b.unite]
                                  )}
                                </strong>
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-warm-brown/60 mt-0.5 flex items-baseline justify-between gap-2">
                            <span>
                              Besoin {formaterQuantite(b.quantite_totale, UNITE_LABELS[b.unite])} ·
                              stock{' '}
                              {formaterQuantite(b.stock_actuel, UNITE_LABELS[b.unite])}
                            </span>
                            {b.cout_manquant > 0 && (
                              <span className="tabular-nums">
                                ≈ {chf(b.cout_manquant)}
                              </span>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {coutTotalManquant > 0 && (
                    <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-soft-taupe/40">
                      <span className="text-sm text-warm-brown/80 inline-flex items-center gap-1">
                        <Package className="h-4 w-4" aria-hidden="true" />
                        Budget courses estimé
                      </span>
                      <strong className="font-serif text-lg tabular-nums">
                        {chf(coutTotalManquant)}
                      </strong>
                    </div>
                  )}

                  {texteCourses && (
                    <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          texteCourses
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 px-3 py-2 text-sm font-medium min-h-[40px]"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        WhatsApp
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
