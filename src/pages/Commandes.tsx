import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Loader2,
  CalendarDays,
  Phone,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  CommandeAvecClient,
  StatutCommande,
  STATUT_COMMANDE_LABELS,
  STATUT_PAIEMENT_LABELS,
} from '../lib/types'

type FiltreStatut = 'toutes' | StatutCommande

const FILTRES: { key: FiltreStatut; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'confirmee', label: 'Confirmées' },
  { key: 'en_preparation', label: 'En prépa' },
  { key: 'prete', label: 'Prêtes' },
  { key: 'livree', label: 'Livrées' },
]

const STATUT_BADGE: Record<StatutCommande, string> = {
  brouillon: 'bg-soft-taupe/40 text-warm-brown',
  confirmee: 'bg-dusty-pink/20 text-warm-brown',
  en_preparation: 'bg-caramel/25 text-warm-brown',
  prete: 'bg-emerald-100 text-emerald-900',
  livree: 'bg-warm-brown/15 text-warm-brown',
  annulee: 'bg-alert-red/10 text-alert-red',
}

const PAIEMENT_BADGE: Record<string, string> = {
  impaye: 'bg-alert-red/10 text-alert-red',
  acompte: 'bg-caramel/25 text-warm-brown',
  paye: 'bg-emerald-100 text-emerald-900',
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatHeure(h: string | null): string {
  if (!h) return ''
  return h.slice(0, 5)
}

function formatCHF(n: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(n)
}

export default function Commandes() {
  const qc = useQueryClient()
  const [filtre, setFiltre] = useState<FiltreStatut>('toutes')
  const [recherche, setRecherche] = useState('')

  const { data, isLoading, error } = useQuery<CommandeAvecClient[]>({
    queryKey: ['commandes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, client:clients(id, nom, telephone)')
        .order('date_evenement', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as CommandeAvecClient[]
    },
  })

  const changerStatut = useMutation({
    mutationFn: async (args: { id: string; statut: StatutCommande }) => {
      const { error } = await supabase
        .from('commandes')
        .update({ statut: args.statut, modifie_le: new Date().toISOString() })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes'] })
    },
  })

  const commandesFiltrees = useMemo(() => {
    if (!data) return []
    const recLower = recherche.trim().toLowerCase()
    return data.filter((c) => {
      if (filtre !== 'toutes' && c.statut !== filtre) return false
      if (recLower) {
        const nom = c.client?.nom?.toLowerCase() ?? ''
        const num = c.numero_commande?.toLowerCase() ?? ''
        if (!nom.includes(recLower) && !num.includes(recLower)) return false
      }
      return true
    })
  }, [data, filtre, recherche])

  return (
    <div>
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Commandes
          </h1>
          <p className="mt-1 text-warm-brown/70">
            {data ? `${data.length} commande${data.length > 1 ? 's' : ''}` : '…'}
          </p>
        </div>
        <Link
          to="/commandes/nouvelle"
          className="btn-primary"
          aria-label="Nouvelle commande"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouvelle</span>
        </Link>
      </header>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {FILTRES.map((f) => {
          const actif = filtre === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltre(f.key)}
              className={
                'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ' +
                (actif
                  ? 'bg-warm-brown text-cream'
                  : 'bg-soft-taupe/30 text-warm-brown/80 hover:bg-soft-taupe/50')
              }
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Recherche */}
      <div className="relative mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-warm-brown/50"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher un client ou un n° de commande…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="input-field pl-10"
          aria-label="Rechercher"
        />
      </div>

      {/* Contenu */}
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
              Impossible de charger les commandes
            </p>
            <p className="text-sm text-warm-brown/70 mt-1">
              {(error as Error).message}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && commandesFiltrees.length === 0 && (
        <EtatVide filtre={filtre} rechercheActive={recherche.length > 0} />
      )}

      <ul className="grid gap-3">
        {commandesFiltrees.map((c) => (
          <li key={c.id}>
            <Link
              to={`/commandes/${c.id}`}
              className="block card hover:shadow-md transition p-5 focus:outline-none focus:ring-2 focus:ring-dusty-pink/50"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-lg sm:text-xl leading-tight truncate">
                    {c.client?.nom ?? 'Client supprimé'}
                  </h2>
                  {c.numero_commande && (
                    <p className="text-xs text-warm-brown/50 mt-0.5">
                      {c.numero_commande}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                      STATUT_BADGE[c.statut]
                    }
                  >
                    {STATUT_COMMANDE_LABELS[c.statut]}
                  </span>
                  <span
                    className={
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs ' +
                      (PAIEMENT_BADGE[c.statut_paiement] ?? 'bg-soft-taupe/40')
                    }
                  >
                    {STATUT_PAIEMENT_LABELS[c.statut_paiement]}
                  </span>
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-warm-brown/80">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <dt className="sr-only">Date</dt>
                  <dd>
                    {formatDate(c.date_evenement)}
                    {c.heure_evenement ? ` · ${formatHeure(c.heure_evenement)}` : ''}
                  </dd>
                </div>
                {c.client?.telephone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <dt className="sr-only">Téléphone</dt>
                    <dd>
                      <a
                        href={`tel:${c.client.telephone}`}
                        className="hover:text-warm-brown"
                      >
                        {c.client.telephone}
                      </a>
                    </dd>
                  </div>
                )}
                {c.lieu_livraison && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Lieu</dt>
                    <dd className="truncate">{c.lieu_livraison}</dd>
                  </div>
                )}
              </dl>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-soft-taupe/40">
                <div>
                  <p className="text-lg font-medium text-warm-brown">
                    {formatCHF(Number(c.prix_total))}
                  </p>
                  {Number(c.acompte_recu) > 0 && (
                    <p className="text-xs text-warm-brown/60">
                      Acompte : {formatCHF(Number(c.acompte_recu))}
                    </p>
                  )}
                </div>
                <label
                  className="text-sm"
                  onClick={(e) => {
                    // Empêcher la navigation vers la fiche quand on
                    // change juste le statut depuis la liste.
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <span className="sr-only">Changer le statut</span>
                  <select
                    value={c.statut}
                    onChange={(e) =>
                      changerStatut.mutate({
                        id: c.id,
                        statut: e.target.value as StatutCommande,
                      })
                    }
                    disabled={changerStatut.isPending}
                    className="rounded-xl border border-soft-taupe/60 bg-cream px-3 py-1.5 text-sm text-warm-brown focus:outline-none focus:ring-2 focus:ring-dusty-pink/50"
                  >
                    {(
                      Object.keys(STATUT_COMMANDE_LABELS) as StatutCommande[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {STATUT_COMMANDE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EtatVide({
  filtre,
  rechercheActive,
}: {
  filtre: FiltreStatut
  rechercheActive: boolean
}) {
  if (rechercheActive) {
    return (
      <div className="card text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-soft-taupe/30 text-3xl mb-4 mx-auto"
        >
          🔍
        </div>
        <p className="text-warm-brown/70">Aucune commande ne correspond à ta recherche.</p>
      </div>
    )
  }
  if (filtre !== 'toutes') {
    return (
      <div className="card text-center py-14">
        <p className="text-warm-brown/70">
          Aucune commande dans cette catégorie pour l'instant.
        </p>
      </div>
    )
  }
  return (
    <div className="card flex flex-col items-center text-center py-14">
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-dusty-pink/15 text-5xl mb-6"
      >
        🧁
      </div>
      <h2 className="font-serif text-2xl mb-2">Aucune commande pour l'instant</h2>
      <p className="text-warm-brown/60 max-w-sm mb-6">
        Crée ta première commande pour l'ajouter au planning d'Anita.
      </p>
      <Link to="/commandes/nouvelle" className="btn-primary">
        <Plus className="h-5 w-5" aria-hidden="true" />
        Nouvelle commande
      </Link>
    </div>
  )
}
