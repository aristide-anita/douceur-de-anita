import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Package,
  ShoppingBag,
  ChefHat,
  Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  StatutCommande,
} from '../lib/types'
import { STATUT_COMMANDE_LABELS } from '../lib/types'

// ----------- Helpers dates -----------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function ymd(d: Date): string {
  // format YYYY-MM-DD pour Supabase
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthKey(d: Date): string {
  // format YYYY-MM
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const MOIS_COURTS = [
  'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
]

function moisShort(d: Date): string {
  return `${MOIS_COURTS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

// ----------- Types locaux -----------

interface RecetteMini {
  nom: string
  cout_matieres_forfait: number
  cout_emballage: number
}

interface ItemAvecRecette {
  quantite: number
  prix_unitaire: number
  recette_id: string | null
  recette: RecetteMini | null
}

interface CommandeFinance {
  id: string
  numero_commande: string | null
  prix_total: number
  statut: StatutCommande
  statut_paiement: 'impaye' | 'acompte' | 'paye'
  date_evenement: string
  cree_le: string
  items: ItemAvecRecette[]
}

// ----------- Composant -----------

const STATUTS_PIPELINE: StatutCommande[] = [
  'brouillon',
  'confirmee',
  'en_preparation',
  'prete',
]

const STATUT_COULEURS: Record<StatutCommande, string> = {
  brouillon: 'bg-soft-taupe text-warm-brown',
  confirmee: 'bg-dusty-pink/30 text-warm-brown',
  en_preparation: 'bg-caramel/30 text-warm-brown',
  prete: 'bg-emerald-100 text-emerald-800',
  livree: 'bg-emerald-200 text-emerald-900',
  annulee: 'bg-alert-red/20 text-alert-red',
}

function chf(n: number): string {
  return `${n.toFixed(2)} CHF`
}

export default function Finances() {
  // 6 mois glissants (mois courant inclus)
  const now = new Date()
  const debutFenetre = startOfMonth(addMonths(now, -5))
  const finFenetre = addMonths(startOfMonth(now), 1) // 1er du mois suivant exclus

  const { data, isLoading, error } = useQuery<CommandeFinance[]>({
    queryKey: ['finances', 'commandes', monthKey(debutFenetre)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select(
          `id, numero_commande, prix_total, statut, statut_paiement, date_evenement, cree_le,
           items:commande_items(
             quantite, prix_unitaire, recette_id,
             recette:recettes(nom, cout_matieres_forfait, cout_emballage)
           )`
        )
        .gte('date_evenement', ymd(debutFenetre))
        .order('date_evenement', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CommandeFinance[]
    },
    staleTime: 60_000,
  })

  // Pour le pipeline on regarde TOUTES les commandes en cours, pas juste les 6 mois.
  const { data: pipeline } = useQuery<CommandeFinance[]>({
    queryKey: ['finances', 'pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('id, prix_total, statut, date_evenement')
        .in('statut', STATUTS_PIPELINE)
        .order('date_evenement', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as CommandeFinance[]
    },
    staleTime: 60_000,
  })

  const stats = useMemo(() => {
    const moisCourantKey = monthKey(now)

    // Coût d'une commande (sur articles liés à une recette)
    const coutCommande = (c: CommandeFinance): number => {
      let total = 0
      for (const it of c.items ?? []) {
        if (it.recette_id && it.recette) {
          total +=
            it.quantite *
            (it.recette.cout_matieres_forfait + it.recette.cout_emballage)
        }
      }
      return total
    }

    // KPIs du mois courant — basés sur date_evenement
    const commandesMois = (data ?? []).filter((c) => {
      if (!c.date_evenement) return false
      return c.date_evenement.startsWith(moisCourantKey)
    })

    const livreesMois = commandesMois.filter((c) => c.statut === 'livree')
    const ca = livreesMois.reduce((s, c) => s + Number(c.prix_total ?? 0), 0)
    const cout = livreesMois.reduce((s, c) => s + coutCommande(c), 0)
    const margeBrute = ca - cout
    const margePct = ca > 0 ? (margeBrute / ca) * 100 : 0
    const panierMoyen = livreesMois.length > 0 ? ca / livreesMois.length : 0

    // CA encaissé (paye) — peut différer du CA livré
    const encaissees = commandesMois.filter((c) => c.statut_paiement === 'paye')
    const caEncaisse = encaissees.reduce(
      (s, c) => s + Number(c.prix_total ?? 0),
      0
    )

    // Chart 6 mois (CA livré par mois)
    const moisLabels: { date: Date; key: string; label: string }[] = []
    for (let i = -5; i <= 0; i++) {
      const d = addMonths(startOfMonth(now), i)
      moisLabels.push({ date: d, key: monthKey(d), label: moisShort(d) })
    }
    const caParMois: Record<string, number> = {}
    for (const m of moisLabels) caParMois[m.key] = 0
    for (const c of data ?? []) {
      if (c.statut !== 'livree' || !c.date_evenement) continue
      const k = c.date_evenement.slice(0, 7)
      if (k in caParMois) caParMois[k] += Number(c.prix_total ?? 0)
    }
    const caMaxMois = Math.max(...Object.values(caParMois), 1)
    const chartData = moisLabels.map((m) => ({
      ...m,
      ca: caParMois[m.key],
      pctH: (caParMois[m.key] / caMaxMois) * 100,
      isCurrent: m.key === moisCourantKey,
    }))

    // Top recettes — 30 derniers jours, sur toutes commandes (pas juste livrées)
    const il_y_a_30j = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const seuil = ymd(il_y_a_30j)
    const agg: Record<string, { nom: string; ca: number; qte: number }> = {}
    for (const c of data ?? []) {
      if (!c.date_evenement || c.date_evenement < seuil) continue
      if (c.statut === 'annulee') continue
      for (const it of c.items ?? []) {
        if (!it.recette_id || !it.recette) continue
        const k = it.recette_id
        if (!agg[k]) agg[k] = { nom: it.recette.nom, ca: 0, qte: 0 }
        agg[k].ca += Number(it.prix_unitaire ?? 0) * Number(it.quantite ?? 0)
        agg[k].qte += Number(it.quantite ?? 0)
      }
    }
    const topRecettes = Object.values(agg)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5)

    return {
      ca,
      caEncaisse,
      cout,
      margeBrute,
      margePct,
      panierMoyen,
      nbLivrees: livreesMois.length,
      nbMois: commandesMois.length,
      chartData,
      caMaxMois,
      topRecettes,
    }
  }, [data, now])

  const pipelineStats = useMemo(() => {
    const byStatut: Record<string, { count: number; ca: number }> = {}
    for (const s of STATUTS_PIPELINE) byStatut[s] = { count: 0, ca: 0 }
    for (const c of pipeline ?? []) {
      const s = c.statut
      if (!byStatut[s]) byStatut[s] = { count: 0, ca: 0 }
      byStatut[s].count += 1
      byStatut[s].ca += Number(c.prix_total ?? 0)
    }
    const totalCount = (pipeline ?? []).length
    const totalCa = (pipeline ?? []).reduce(
      (s, c) => s + Number(c.prix_total ?? 0),
      0
    )
    return { byStatut, totalCount, totalCa }
  }, [pipeline])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-warm-brown/60" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-alert-red/40 bg-alert-red/5 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-alert-red flex-shrink-0 mt-0.5" />
        <div className="text-sm text-alert-red">
          Erreur de chargement des données financières.
          <div className="text-xs text-alert-red/80 mt-1">
            {(error as Error).message}
          </div>
        </div>
      </div>
    )
  }

  const moisCourantLabel = moisShort(now)
  const margeColor =
    stats.margeBrute >= 0 ? 'text-emerald-700' : 'text-alert-red'

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Finances
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            Vue d'ensemble · {moisCourantLabel}
          </p>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="CA livré (mois)"
          value={chf(stats.ca)}
          hint={`${stats.nbLivrees} commande${stats.nbLivrees > 1 ? 's' : ''} livrée${stats.nbLivrees > 1 ? 's' : ''}`}
          accent="emerald"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Marge brute"
          value={chf(stats.margeBrute)}
          hint={
            stats.ca > 0
              ? `${stats.margePct.toFixed(1)} % du CA`
              : 'Pas de CA ce mois'
          }
          accent={stats.margeBrute >= 0 ? 'emerald' : 'red'}
        />
        <KpiCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="CA encaissé"
          value={chf(stats.caEncaisse)}
          hint="Commandes payées"
          accent="caramel"
        />
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          label="Panier moyen"
          value={chf(stats.panierMoyen)}
          hint={`Sur ${stats.nbLivrees} livrée${stats.nbLivrees > 1 ? 's' : ''}`}
          accent="taupe"
        />
      </section>

      {/* Graphique CA 6 mois */}
      <section className="card">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-xl">CA livré · 6 mois</h2>
          <span className="text-xs text-warm-brown/60">
            Max : {chf(stats.caMaxMois)}
          </span>
        </div>
        {stats.caMaxMois <= 1 ? (
          <p className="text-sm text-warm-brown/60 py-8 text-center">
            Pas encore de commande livrée sur la période.
          </p>
        ) : (
          <div className="grid grid-cols-6 gap-3 items-end h-44">
            {stats.chartData.map((m) => (
              <div
                key={m.key}
                className="flex flex-col items-center justify-end h-full"
              >
                <div
                  className="text-xs text-warm-brown/70 mb-1 tabular-nums"
                  aria-hidden={m.ca === 0}
                >
                  {m.ca > 0 ? Math.round(m.ca) : ''}
                </div>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    m.isCurrent
                      ? 'bg-dusty-pink'
                      : 'bg-caramel/60'
                  }`}
                  style={{ height: `${Math.max(m.pctH, 2)}%` }}
                  role="img"
                  aria-label={`${m.label} : ${chf(m.ca)}`}
                />
                <div
                  className={`text-xs mt-2 ${
                    m.isCurrent
                      ? 'font-semibold text-warm-brown'
                      : 'text-warm-brown/60'
                  }`}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <section className="card">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-warm-brown/70" />
              Pipeline
            </h2>
            <span className="text-xs text-warm-brown/60">
              {pipelineStats.totalCount} en cours · {chf(pipelineStats.totalCa)}
            </span>
          </div>
          {pipelineStats.totalCount === 0 ? (
            <p className="text-sm text-warm-brown/60 py-6 text-center">
              Aucune commande en cours.
            </p>
          ) : (
            <ul className="space-y-2">
              {STATUTS_PIPELINE.map((s) => {
                const row = pipelineStats.byStatut[s] ?? { count: 0, ca: 0 }
                return (
                  <li
                    key={s}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-cream/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COULEURS[s]}`}
                      >
                        {STATUT_COMMANDE_LABELS[s]}
                      </span>
                      <span className="text-sm text-warm-brown/70 tabular-nums">
                        {row.count}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-warm-brown tabular-nums">
                      {chf(row.ca)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-4 text-right">
            <Link
              to="/commandes"
              className="text-sm text-caramel hover:underline"
            >
              Voir toutes les commandes →
            </Link>
          </div>
        </section>

        {/* Top recettes */}
        <section className="card">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-xl flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-warm-brown/70" />
              Top recettes · 30 j
            </h2>
          </div>
          {stats.topRecettes.length === 0 ? (
            <p className="text-sm text-warm-brown/60 py-6 text-center">
              Aucune recette vendue sur les 30 derniers jours.
              <br />
              <span className="text-xs">
                Lie tes articles à une recette pour suivre leur performance.
              </span>
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.topRecettes.map((r, idx) => {
                const max = stats.topRecettes[0].ca || 1
                const pct = (r.ca / max) * 100
                return (
                  <li key={r.nom + idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-warm-brown">
                        <span className="text-warm-brown/50 mr-2 tabular-nums">
                          {idx + 1}.
                        </span>
                        {r.nom}
                      </span>
                      <span className="font-medium text-warm-brown tabular-nums whitespace-nowrap">
                        {chf(r.ca)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-soft-taupe/40 overflow-hidden">
                      <div
                        className="h-full bg-dusty-pink rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-warm-brown/60">
                      {r.qte} unité{r.qte > 1 ? 's' : ''} vendue
                      {r.qte > 1 ? 's' : ''}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// ----------- Sous-composants -----------

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  accent: 'emerald' | 'caramel' | 'taupe' | 'red'
}

function KpiCard({ icon, label, value, hint, accent }: KpiCardProps) {
  const accentBg = {
    emerald: 'bg-emerald-100 text-emerald-700',
    caramel: 'bg-caramel/20 text-caramel',
    taupe: 'bg-soft-taupe text-warm-brown',
    red: 'bg-alert-red/15 text-alert-red',
  }[accent]
  const valueColor = accent === 'red' ? 'text-alert-red' : 'text-warm-brown'
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-warm-brown/60">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${accentBg}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
      <div className={`font-serif text-2xl ${valueColor} tabular-nums`}>
        {value}
      </div>
      <div className="text-xs text-warm-brown/60 mt-1">{hint}</div>
    </div>
  )
}
