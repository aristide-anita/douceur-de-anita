import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Loader2, AlertCircle, Sprout } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Ingredient } from '../lib/types'
import { UNITE_LABELS } from '../lib/types'

function formatCHF(n: number, fraction = 2): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: fraction,
    maximumFractionDigits: 4,
  }).format(n)
}

export default function Ingredients() {
  const [recherche, setRecherche] = useState('')

  const { data, isLoading, error } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('nom', { ascending: true })
      if (error) throw error
      return (data ?? []) as Ingredient[]
    },
    staleTime: 60_000,
  })

  const filtres = useMemo(() => {
    const tous = data ?? []
    const r = recherche.trim().toLowerCase()
    if (!r) return tous
    return tous.filter((i) => i.nom.toLowerCase().includes(r))
  }, [data, recherche])

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Ingrédients
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            {data ? `${data.length} ingrédient${data.length > 1 ? 's' : ''}` : '…'}
          </p>
        </div>
        <Link
          to="/ingredients/nouveau"
          className="inline-flex items-center gap-2 rounded-2xl bg-warm-brown text-cream px-4 py-2 text-sm font-medium hover:bg-warm-brown/90 min-h-[44px]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvel ingrédient
        </Link>
      </header>

      <div className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-brown/40"
          aria-hidden="true"
        />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un ingrédient…"
          className="input-field pl-9"
        />
      </div>

      {isLoading && (
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
            Impossible de charger les ingrédients.
            <div className="text-xs mt-1 text-alert-red/80">
              {(error as Error).message}
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && filtres.length === 0 && (
        <div className="card flex flex-col items-center text-center py-14">
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-caramel/20 text-5xl mb-6"
          >
            🌿
          </div>
          <h2 className="font-serif text-2xl mb-2">
            {recherche
              ? 'Aucun ingrédient ne correspond'
              : 'Aucun ingrédient pour l’instant'}
          </h2>
          <p className="text-warm-brown/60 max-w-sm">
            {recherche
              ? 'Essaie un autre mot-clé.'
              : 'Ajoute tes ingrédients pour calculer automatiquement le coût matières de tes recettes.'}
          </p>
          {!recherche && (
            <Link
              to="/ingredients/nouveau"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-warm-brown text-cream px-4 py-2 text-sm font-medium hover:bg-warm-brown/90 min-h-[44px]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Créer le premier ingrédient
            </Link>
          )}
        </div>
      )}

      {!isLoading && !error && filtres.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtres.map((i) => (
            <li key={i.id}>
              <Link
                to={`/ingredients/${i.id}`}
                className="card block hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-dusty-pink/50 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-serif text-lg text-warm-brown truncate">
                    {i.nom}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-soft-taupe/40 text-warm-brown/80 whitespace-nowrap">
                    {UNITE_LABELS[i.unite_achat]}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-warm-brown/60">
                    Prix unitaire
                  </span>
                  <span className="font-serif text-base text-warm-brown tabular-nums">
                    {formatCHF(i.prix_unitaire_chf)} / {UNITE_LABELS[i.unite_achat]}
                  </span>
                </div>
                {!i.actif && (
                  <span className="mt-2 inline-block text-xs text-warm-brown/50">
                    Inactif
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* footer info */}
      {!isLoading && !error && filtres.length > 0 && (
        <div className="mt-6 flex items-center gap-2 text-xs text-warm-brown/50">
          <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
          Ajoute un ingrédient dans la composition d’une recette pour calculer son coût.
        </div>
      )}
    </div>
  )
}
