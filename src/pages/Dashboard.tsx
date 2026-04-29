import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays,
  CreditCard,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ----------- Types locaux -----------

interface ClientMini {
  nom: string
}

interface CommandeSemaine {
  id: string
  numero_commande: string | null
  date_evenement: string
  heure_evenement: string | null
  prix_total: number
  client: ClientMini | ClientMini[] | null
}

interface CommandeImpayee {
  id: string
  prix_total: number
  acompte_recu: number
}

interface CommandeMoisDB {
  prix_total: number
}

function pickClient(c: ClientMini | ClientMini[] | null): ClientMini | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}

function chf(n: number): string {
  return `${n.toFixed(2)} CHF`
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// ----------- Composant principal -----------

export default function Dashboard() {
  const todayStr = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Bonjour, Anita
        </h1>
        <p className="mt-1 text-warm-brown/70 capitalize">{todayStr}</p>
      </header>

      <section
        aria-label="Aperçu"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <SemaineCard />
        <ImpayesCard />
        <MoisCard />
      </section>
    </div>
  )
}

// ----------- Card 1 : À préparer cette semaine -----------

function SemaineCard() {
  const today = new Date()
  const fin = endOfWeek(today, { weekStartsOn: 1 })

  const { data, isLoading, error } = useQuery<CommandeSemaine[]>({
    queryKey: ['dashboard', 'semaine', ymd(today), ymd(fin)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select(
          `id, numero_commande, date_evenement, heure_evenement, prix_total,
           client:clients(nom)`
        )
        .gte('date_evenement', ymd(today))
        .lte('date_evenement', ymd(fin))
        .not('statut', 'in', '(annulee,livree)')
        .order('date_evenement', { ascending: true })
        .order('heure_evenement', { ascending: true })
        .limit(5)
      if (error) throw error
      return (data ?? []) as unknown as CommandeSemaine[]
    },
    staleTime: 60_000,
  })

  return (
    <article className="card">
      <div className="flex items-center gap-3 mb-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-warm-brown bg-dusty-pink/15"
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-lg">À préparer cette semaine</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-warm-brown/60 mt-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-alert-red mt-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Erreur de chargement</span>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-warm-brown/60 mt-4">
          Rien de prévu cette semaine.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((c) => {
            const cli = pickClient(c.client)
            const dateLabel = format(new Date(c.date_evenement), 'EEE d MMM', {
              locale: fr,
            })
            return (
              <li key={c.id}>
                <Link
                  to={`/commandes/${c.id}`}
                  className="flex items-baseline justify-between gap-3 px-2 py-1.5 -mx-2 rounded-xl hover:bg-soft-taupe/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {cli?.nom ?? c.numero_commande ?? 'Commande'}
                    </p>
                    <p className="text-xs text-warm-brown/60 capitalize">
                      {dateLabel}
                      {c.heure_evenement
                        ? ` · ${c.heure_evenement.slice(0, 5)}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-warm-brown/70 shrink-0">
                    {chf(Number(c.prix_total ?? 0))}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

// ----------- Card 2 : Impayés -----------

interface ImpayesData {
  totalDu: number
  count: number
}

function ImpayesCard() {
  const { data, isLoading, error } = useQuery<ImpayesData>({
    queryKey: ['dashboard', 'impayes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('id, prix_total, acompte_recu')
        .in('statut_paiement', ['impaye', 'acompte'])
        .neq('statut', 'annulee')
      if (error) throw error
      const rows = (data ?? []) as CommandeImpayee[]
      const totalDu = rows.reduce(
        (s, r) =>
          s + (Number(r.prix_total ?? 0) - Number(r.acompte_recu ?? 0)),
        0
      )
      return { totalDu, count: rows.length }
    },
    staleTime: 60_000,
  })

  return (
    <article className="card">
      <div className="flex items-center gap-3 mb-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-warm-brown bg-soft-taupe/70"
        >
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-lg">Impayés</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-warm-brown/60 mt-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-alert-red mt-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Erreur de chargement</span>
        </div>
      ) : !data || data.count === 0 ? (
        <p className="text-sm text-warm-brown/60 mt-4">
          Tout est réglé.
        </p>
      ) : (
        <div className="mt-2">
          <p className="font-serif text-3xl tabular-nums">
            {chf(data.totalDu)}
          </p>
          <Link
            to="/commandes"
            className="text-sm text-warm-brown/70 hover:text-warm-brown underline-offset-2 hover:underline"
          >
            {data.count} commande{data.count > 1 ? 's' : ''} à encaisser
          </Link>
        </div>
      )}
    </article>
  )
}

// ----------- Card 3 : Ce mois-ci -----------

interface MoisData {
  total: number
  count: number
}

function MoisCard() {
  const today = new Date()
  const start = startOfMonth(today)
  const end = endOfMonth(today)
  const moisLabel = format(today, 'MMMM', { locale: fr })

  const { data, isLoading, error } = useQuery<MoisData>({
    queryKey: ['dashboard', 'mois', ymd(start), ymd(end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('prix_total')
        .gte('date_evenement', ymd(start))
        .lte('date_evenement', ymd(end))
        .neq('statut', 'annulee')
      if (error) throw error
      const rows = (data ?? []) as CommandeMoisDB[]
      const total = rows.reduce((s, r) => s + Number(r.prix_total ?? 0), 0)
      return { total, count: rows.length }
    },
    staleTime: 60_000,
  })

  return (
    <article className="card">
      <div className="flex items-center gap-3 mb-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-warm-brown bg-caramel/20"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-lg">Ce mois-ci</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-warm-brown/60 mt-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-alert-red mt-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Erreur de chargement</span>
        </div>
      ) : !data || data.count === 0 ? (
        <p className="text-sm text-warm-brown/60 mt-4">
          Aucune commande en{' '}
          <span className="capitalize">{moisLabel}</span>.
        </p>
      ) : (
        <div className="mt-2">
          <p className="font-serif text-3xl tabular-nums">
            {chf(data.total)}
          </p>
          <p className="text-sm text-warm-brown/70">
            {data.count} commande{data.count > 1 ? 's' : ''} en{' '}
            <span className="capitalize">{moisLabel}</span>
          </p>
        </div>
      )}
    </article>
  )
}
