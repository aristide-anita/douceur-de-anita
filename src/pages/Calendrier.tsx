import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CalendarDays,
  Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { StatutCommande } from '../lib/types'
import { STATUT_COMMANDE_LABELS } from '../lib/types'

// ----------- Types locaux -----------

interface ClientMini {
  nom: string
}

interface CommandeCal {
  id: string
  numero_commande: string | null
  date_evenement: string
  prix_total: number
  statut: StatutCommande
  client: ClientMini | ClientMini[] | null
}

function pickClient(c: ClientMini | ClientMini[] | null): ClientMini | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}

// ----------- Helpers -----------

const STATUT_COULEURS: Record<StatutCommande, string> = {
  brouillon: 'bg-soft-taupe text-warm-brown',
  confirmee: 'bg-dusty-pink/40 text-warm-brown',
  en_preparation: 'bg-caramel/30 text-warm-brown',
  prete: 'bg-emerald-100 text-emerald-800',
  livree: 'bg-emerald-200 text-emerald-900',
  annulee: 'bg-alert-red/20 text-alert-red',
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_LONGS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function chf(n: number): string {
  return `${n.toFixed(2)} CHF`
}

interface GridCell {
  date: Date
  key: string
  inMonth: boolean
}

function buildGrid(monthRef: Date): GridCell[] {
  const first = startOfMonth(monthRef)
  // Lundi = début de semaine
  const dow = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - dow)
  const cells: GridCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      date: d,
      key: ymd(d),
      inMonth: d.getMonth() === first.getMonth(),
    })
  }
  return cells
}

// ----------- Composant -----------

export default function Calendrier() {
  const [monthRef, setMonthRef] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const monthStart = startOfMonth(monthRef)
  const queryStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), -7)
  const queryEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 14)

  const { data, isLoading, error } = useQuery<CommandeCal[]>({
    queryKey: ['calendrier', ymd(monthStart)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select(
          `id, numero_commande, date_evenement, prix_total, statut,
           client:clients(nom)`
        )
        .gte('date_evenement', ymd(queryStart))
        .lt('date_evenement', ymd(queryEnd))
        .order('date_evenement', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as CommandeCal[]
    },
    staleTime: 60_000,
  })

  const eventsByDay = useMemo(() => {
    const map: Record<string, CommandeCal[]> = {}
    for (const c of data ?? []) {
      const k = c.date_evenement.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(c)
    }
    return map
  }, [data])

  const grid = useMemo(() => buildGrid(monthRef), [monthRef])
  const today = ymd(new Date())
  const monthLabel = `${MOIS_LONGS[monthRef.getMonth()]} ${monthRef.getFullYear()}`

  const moisPrefixe = ymd(monthStart).slice(0, 7)
  const commandesDuMois = (data ?? []).filter((c) =>
    c.date_evenement.startsWith(moisPrefixe)
  )
  const totalMois = commandesDuMois.reduce(
    (s, c) => s + Number(c.prix_total ?? 0),
    0
  )

  const selectedEvents = selectedDay ? eventsByDay[selectedDay] ?? [] : []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Calendrier
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            Vue mensuelle des événements
          </p>
        </div>
        <Link
          to="/commandes/nouvelle"
          className="inline-flex items-center gap-2 rounded-2xl bg-warm-brown text-cream px-4 py-2 text-sm font-medium hover:bg-warm-brown/90 min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Link>
      </header>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthRef(addMonths(monthRef, -1))}
            aria-label="Mois précédent"
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cream/60 hover:bg-soft-taupe/40 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonthRef(startOfMonth(new Date()))
              setSelectedDay(ymd(new Date()))
            }}
            className="text-sm px-3 py-2 rounded-xl bg-cream/60 hover:bg-soft-taupe/40 transition"
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setMonthRef(addMonths(monthRef, 1))}
            aria-label="Mois suivant"
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cream/60 hover:bg-soft-taupe/40 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-xl">{monthLabel}</h2>
          <span className="text-xs text-warm-brown/60">
            {commandesDuMois.length} commande
            {commandesDuMois.length > 1 ? 's' : ''} · {chf(totalMois)}
          </span>
        </div>
      </div>

      {error && (
        <div className="card border-alert-red/40 bg-alert-red/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-alert-red flex-shrink-0 mt-0.5" />
          <div className="text-sm text-alert-red">
            Erreur de chargement.
            <div className="text-xs text-alert-red/80 mt-1">
              {(error as Error).message}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Calendrier */}
        <section className="card overflow-hidden">
          <div className="grid grid-cols-7 gap-1 mb-2 text-xs font-medium text-warm-brown/60 uppercase tracking-wide">
            {JOURS.map((j) => (
              <div key={j} className="px-2 py-1 text-center">
                {j}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-warm-brown/60" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell) => {
                const events = eventsByDay[cell.key] ?? []
                const isToday = cell.key === today
                const isSelected = cell.key === selectedDay
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(cell.key)}
                    className={[
                      'flex flex-col items-stretch gap-1 min-h-[88px] p-1.5 rounded-lg text-left transition',
                      cell.inMonth ? 'bg-cream/40' : 'bg-transparent',
                      isSelected
                        ? 'ring-2 ring-dusty-pink'
                        : 'ring-1 ring-soft-taupe/30',
                      'hover:bg-soft-taupe/30',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={[
                          'inline-flex items-center justify-center h-6 w-6 text-xs tabular-nums rounded-full',
                          isToday
                            ? 'bg-dusty-pink text-warm-brown font-semibold'
                            : '',
                          !cell.inMonth ? 'text-warm-brown/30' : 'text-warm-brown',
                        ].join(' ')}
                      >
                        {cell.date.getDate()}
                      </span>
                      {events.length > 0 && (
                        <span className="text-[10px] text-warm-brown/60 tabular-nums">
                          {events.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {events.slice(0, 3).map((ev) => {
                        const cli = pickClient(ev.client)
                        const nom = cli?.nom ?? ev.numero_commande ?? '—'
                        return (
                          <span
                            key={ev.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate ${STATUT_COULEURS[ev.statut]}`}
                            title={`${ev.numero_commande ?? ''} · ${cli?.nom ?? ''}`}
                          >
                            {nom}
                          </span>
                        )
                      })}
                      {events.length > 3 && (
                        <span className="text-[10px] text-warm-brown/60 px-1.5">
                          +{events.length - 3} autre
                          {events.length - 3 > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Panneau détail jour */}
        <aside className="card h-fit lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-5 w-5 text-warm-brown/70" />
            <h3 className="font-serif text-lg">
              {selectedDay
                ? parseISODate(selectedDay).toLocaleDateString('fr-CH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : 'Détail du jour'}
            </h3>
          </div>
          {!selectedDay ? (
            <p className="text-sm text-warm-brown/60">
              Sélectionne un jour dans le calendrier pour voir les commandes
              prévues.
            </p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-warm-brown/60">
              Aucune commande ce jour-là.
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((ev) => {
                const cli = pickClient(ev.client)
                return (
                  <li key={ev.id}>
                    <Link
                      to={`/commandes/${ev.id}`}
                      className="block px-3 py-2 rounded-xl bg-cream/60 hover:bg-soft-taupe/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-warm-brown truncate">
                          {cli?.nom ?? '—'}
                        </span>
                        <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                          {chf(Number(ev.prix_total ?? 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${STATUT_COULEURS[ev.statut]}`}
                        >
                          {STATUT_COMMANDE_LABELS[ev.statut]}
                        </span>
                        {ev.numero_commande && (
                          <span className="text-xs text-warm-brown/60">
                            {ev.numero_commande}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* Légende statuts */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-warm-brown/60">Statuts :</span>
        {(Object.keys(STATUT_COULEURS) as StatutCommande[]).map((s) => (
          <span
            key={s}
            className={`px-2 py-0.5 rounded-full ${STATUT_COULEURS[s]}`}
          >
            {STATUT_COMMANDE_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
