import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Star,
  ImageIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Recette, CategorieRecette } from '../lib/types'

const CATEGORIE_LABELS: Record<CategorieRecette, string> = {
  patisserie: 'Pâtisserie',
  traiteur_salee: 'Traiteur salé',
  traiteur_sucree: 'Traiteur sucré',
  boisson: 'Boisson',
  autre: 'Autre',
}

const CATEGORIE_BADGE: Record<CategorieRecette, string> = {
  patisserie: 'bg-dusty-pink/20 text-warm-brown',
  traiteur_salee: 'bg-caramel/25 text-warm-brown',
  traiteur_sucree: 'bg-soft-taupe/40 text-warm-brown',
  boisson: 'bg-emerald-100 text-emerald-900',
  autre: 'bg-warm-brown/15 text-warm-brown',
}

function formatCHF(n: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(n)
}

function calculerMarge(r: Recette): { brut: number; pct: number } {
  const cout =
    Number(r.cout_matieres_forfait || 0) + Number(r.cout_emballage || 0)
  const prix = Number(r.prix_vente || 0)
  const brut = prix - cout
  const pct = prix > 0 ? (brut / prix) * 100 : 0
  return { brut, pct }
}

export default function Recettes() {
  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState<
    CategorieRecette | 'toutes'
  >('toutes')

  const { data, isLoading, error } = useQuery<Recette[]>({
    queryKey: ['recettes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recettes')
        .select('*')
        .order('favori', { ascending: false })
        .order('nom', { ascending: true })
        .limit(500)
      if (error) throw error
      return (data ?? []) as Recette[]
    },
  })

  const recettesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return (data ?? []).filter((r) => {
      if (categorieFiltre !== 'toutes' && r.categorie !== categorieFiltre) {
        return false
      }
      if (!q) return true
      return (
        r.nom.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, recherche, categorieFiltre])

  const total = data?.length ?? 0
  const affichees = recettesFiltrees.length

  return (
    <div>
      <header className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Recettes
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            {total === 0
              ? 'Aucune recette'
              : affichees === total
              ? `${total} recette${total > 1 ? 's' : ''}`
              : `${affichees} sur ${total}`}
          </p>
        </div>
        <Link
          to="/recettes/nouvelle"
          className="btn-primary"
          aria-label="Nouvelle recette"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouvelle</span>
        </Link>
      </header>

      {/* Recherche + filtre catégorie */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] mb-6">
        <label className="relative block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-brown/50"
            aria-hidden="true"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom ou description…"
            className="input-field pl-10"
            aria-label="Rechercher une recette"
          />
        </label>
        <select
          value={categorieFiltre}
          onChange={(e) =>
            setCategorieFiltre(
              e.target.value as CategorieRecette | 'toutes'
            )
          }
          className="input-field sm:w-52"
          aria-label="Filtrer par catégorie"
        >
          <option value="toutes">Toutes les catégories</option>
          {(Object.keys(CATEGORIE_LABELS) as CategorieRecette[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORIE_LABELS[c]}
            </option>
          ))}
        </select>
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
          <div>
            <p className="font-medium text-alert-red">
              Impossible de charger les recettes
            </p>
            <p className="text-sm text-warm-brown/70 mt-1">
              {(error as Error).message}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && total === 0 && (
        <div className="card flex flex-col items-center text-center py-14">
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-caramel/20 text-5xl mb-6"
          >
            📖
          </div>
          <h2 className="font-serif text-2xl mb-2">
            Aucune recette pour l'instant
          </h2>
          <p className="text-warm-brown/60 max-w-sm mb-6">
            Ajoute tes recettes pour calculer tes coûts de revient et ta marge.
          </p>
          <Link to="/recettes/nouvelle" className="btn-primary">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Créer une recette
          </Link>
        </div>
      )}

      {!isLoading && !error && total > 0 && affichees === 0 && (
        <div className="card flex flex-col items-center text-center py-10 text-warm-brown/60">
          <p>Aucune recette ne correspond à cette recherche.</p>
        </div>
      )}

      {affichees > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {recettesFiltrees.map((r) => {
            const { brut, pct } = calculerMarge(r)
            const margePositive = brut >= 0
            return (
              <li key={r.id}>
                <Link
                  to={`/recettes/${r.id}`}
                  className="card block hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-dusty-pink/50 overflow-hidden p-0"
                >
                  {/* Photo (ou placeholder) */}
                  <div className="relative w-full h-44 bg-soft-taupe/20 overflow-hidden">
                    {r.photo_url ? (
                      <img
                        src={r.photo_url}
                        alt={r.nom}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-warm-brown/30">
                        <ImageIcon
                          className="h-10 w-10"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    {!r.actif && (
                      <span className="absolute top-2 right-2 rounded-full bg-cream/90 text-warm-brown/80 text-xs px-2 py-0.5 backdrop-blur">
                        Inactif
                      </span>
                    )}
                    {r.favori && (
                      <span className="absolute top-2 left-2 rounded-full bg-cream/90 px-2 py-0.5 backdrop-blur inline-flex items-center gap-1">
                        <Star
                          className="h-3.5 w-3.5 fill-caramel text-caramel"
                          aria-label="Favori"
                        />
                      </span>
                    )}
                  </div>

                  {/* Contenu carte */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl text-warm-brown truncate">
                          {r.nom}
                        </h3>
                        <span
                          className={
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-2 ' +
                            CATEGORIE_BADGE[r.categorie]
                          }
                        >
                          {CATEGORIE_LABELS[r.categorie]}
                        </span>
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-sm text-warm-brown/70 mt-2 line-clamp-2">
                        {r.description}
                      </p>
                    )}

                    <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-soft-taupe/40">
                      <div>
                        <p className="text-xs text-warm-brown/60">Prix de vente</p>
                        <p className="font-serif text-lg text-warm-brown">
                          {formatCHF(Number(r.prix_vente))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-warm-brown/60">Marge</p>
                        <p
                          className={
                            'font-medium ' +
                            (margePositive
                              ? 'text-emerald-700'
                              : 'text-alert-red')
                          }
                        >
                          {formatCHF(brut)}{' '}
                          <span className="text-xs text-warm-brown/60">
                            ({pct.toFixed(0)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
