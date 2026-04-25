import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Trash2,
  Save,
  Phone,
  Mail,
  CalendarDays,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Client,
  Commande,
  StatutCommande,
  StatutPaiement,
  STATUT_COMMANDE_LABELS,
  STATUT_PAIEMENT_LABELS,
} from '../lib/types'

interface ClientAvecCommandes extends Client {
  commandes: Commande[]
}

const STATUT_BADGE: Record<StatutCommande, string> = {
  brouillon: 'bg-soft-taupe/40 text-warm-brown',
  confirmee: 'bg-dusty-pink/20 text-warm-brown',
  en_preparation: 'bg-caramel/25 text-warm-brown',
  prete: 'bg-emerald-100 text-emerald-900',
  livree: 'bg-warm-brown/15 text-warm-brown',
  annulee: 'bg-alert-red/10 text-alert-red',
}

const PAIEMENT_BADGE: Record<StatutPaiement, string> = {
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

function formatCHF(n: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(n)
}

function lireErreur(err: unknown): string {
  const e = err as {
    message?: string
    details?: string
    hint?: string
    code?: string
  }
  const msg =
    e?.message || (typeof err === 'string' ? err : '') || 'Erreur inconnue'
  const detail = e?.details || e?.hint || ''
  const code = e?.code ? ` (code ${e.code})` : ''
  return `${msg}${detail ? ' — ' + detail : ''}${code}`
}

export default function FicheClient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  // Champs édités
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [note, setNote] = useState('')

  const { data, isLoading, error } = useQuery<ClientAvecCommandes>({
    queryKey: ['client', id],
    enabled: !!id,
    queryFn: async () => {
      const [clientRes, commandesRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id!).single(),
        supabase
          .from('commandes')
          .select('*')
          .eq('client_id', id!)
          .order('date_evenement', { ascending: false }),
      ])
      if (clientRes.error) throw clientRes.error
      if (commandesRes.error) throw commandesRes.error
      return {
        ...(clientRes.data as Client),
        commandes: (commandesRes.data ?? []) as Commande[],
      }
    },
  })

  // Pré-remplissage du formulaire quand la donnée arrive
  useEffect(() => {
    if (!data) return
    setNom(data.nom ?? '')
    setTelephone(data.telephone ?? '')
    setEmail(data.email ?? '')
    setAdresse(data.adresse ?? '')
    setCodePostal(data.code_postal ?? '')
    setVille(data.ville ?? '')
    setNote(data.note ?? '')
  }, [data])

  const sauver = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      if (!nom.trim()) throw new Error('Le nom est obligatoire')
      const { error } = await supabase
        .from('clients')
        .update({
          nom: nom.trim(),
          telephone: telephone.trim() || null,
          email: email.trim() || null,
          adresse: adresse.trim() || null,
          code_postal: codePostal.trim() || null,
          ville: ville.trim() || null,
          note: note.trim() || null,
          modifie_le: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['commandes'] })
      navigate('/clients')
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
    },
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['commandes'] })
      navigate('/clients')
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
      setConfirmerSuppression(false)
    },
  })

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center py-14 text-warm-brown/60">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
        Chargement…
      </div>
    )
  }

  if (error || !data) {
    return (
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
            Impossible de charger ce client
          </p>
          <p className="text-sm text-warm-brown/70 mt-1">
            {error
              ? (error as Error).message
              : 'Client introuvable. Il a peut-être été supprimé.'}
          </p>
          <Link
            to="/clients"
            className="text-sm underline text-warm-brown mt-2 inline-block"
          >
            Retour aux clients
          </Link>
        </div>
      </div>
    )
  }

  const nbCommandes = data.commandes.length

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux clients
      </Link>

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          {data.nom}
        </h1>
        <p className="text-sm text-warm-brown/60 mt-1">
          {nbCommandes === 0
            ? 'Aucune commande'
            : `${nbCommandes} commande${nbCommandes > 1 ? 's' : ''}`}
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setErreur(null)
          sauver.mutate()
        }}
        className="grid gap-6"
      >
        {/* Identité */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Identité</h2>
          <label className="block">
            <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
              Nom complet *
            </span>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="input-field"
            />
          </label>
        </section>

        {/* Contact */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Téléphone
              </span>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </label>
          </div>
          {(telephone || email) && (
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              {telephone && (
                <a
                  href={`tel:${telephone}`}
                  className="inline-flex items-center gap-1.5 text-warm-brown/80 hover:text-warm-brown underline"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Appeler
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 text-warm-brown/80 hover:text-warm-brown underline"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Écrire
                </a>
              )}
            </div>
          )}
        </section>

        {/* Adresse */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Adresse</h2>
          <div className="grid gap-3 sm:grid-cols-6">
            <label className="block sm:col-span-6">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Rue
              </span>
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                NPA
              </span>
              <input
                type="text"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block sm:col-span-4">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Ville
              </span>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="input-field"
              />
            </label>
          </div>
        </section>

        {/* Note */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Note</h2>
          <label className="block">
            <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
              Préférences, allergies, infos utiles…
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field min-h-[6rem]"
              rows={3}
            />
          </label>
        </section>

        {/* Historique commandes */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">
            Commandes du client
            {nbCommandes > 0 && (
              <span className="text-sm text-warm-brown/60 ml-2">
                ({nbCommandes})
              </span>
            )}
          </h2>
          {nbCommandes === 0 ? (
            <p className="text-sm text-warm-brown/60">
              Aucune commande pour ce client.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.commandes.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/commandes/${c.id}`}
                    className="block rounded-xl border border-soft-taupe/40 p-3 hover:bg-soft-taupe/15 transition focus:outline-none focus:ring-2 focus:ring-dusty-pink/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-warm-brown truncate">
                          {c.numero_commande ?? 'Sans numéro'}
                        </p>
                        <p className="text-xs text-warm-brown/60 mt-0.5 flex items-center gap-1.5">
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {formatDate(c.date_evenement)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ' +
                            STATUT_BADGE[c.statut]
                          }
                        >
                          {STATUT_COMMANDE_LABELS[c.statut]}
                        </span>
                        <span
                          className={
                            'inline-flex rounded-full px-2 py-0.5 text-xs ' +
                            (PAIEMENT_BADGE[c.statut_paiement] ??
                              'bg-soft-taupe/40')
                          }
                        >
                          {STATUT_PAIEMENT_LABELS[c.statut_paiement]}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-warm-brown/80 mt-2">
                      {formatCHF(Number(c.prix_total))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {erreur && (
          <div
            role="alert"
            className="rounded-2xl bg-alert-red/10 border border-alert-red/30 px-4 py-3 text-sm text-alert-red flex items-start gap-2"
          >
            <AlertCircle
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>{erreur}</div>
          </div>
        )}

        {/* Suppression */}
        <section className="card border-alert-red/30 bg-alert-red/5">
          <h2 className="font-serif text-xl mb-2 text-alert-red">
            Zone dangereuse
          </h2>
          <p className="text-sm text-warm-brown/70 mb-4">
            La suppression est définitive.{' '}
            {nbCommandes > 0 && (
              <>
                Les {nbCommandes} commande{nbCommandes > 1 ? 's' : ''} liée
                {nbCommandes > 1 ? 's' : ''} resteront mais sans client associé.
              </>
            )}
          </p>
          {!confirmerSuppression ? (
            <button
              type="button"
              onClick={() => {
                setErreur(null)
                setConfirmerSuppression(true)
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-alert-red/40 px-4 py-2 text-sm text-alert-red hover:bg-alert-red/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer le client
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => supprimer.mutate()}
                disabled={supprimer.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-alert-red text-cream px-4 py-2 text-sm font-medium hover:bg-alert-red/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {supprimer.isPending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Suppression…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Oui, supprimer
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmerSuppression(false)}
                disabled={supprimer.isPending}
                className="btn-secondary"
              >
                Annuler
              </button>
            </div>
          )}
        </section>

        <div className="flex gap-3 justify-end sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <Link to="/clients" className="btn-secondary">
            Retour
          </Link>
          <button
            type="submit"
            disabled={sauver.isPending}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sauver.isPending ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
