import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Client,
  StatutCommande,
  StatutPaiement,
  STATUT_COMMANDE_LABELS,
  STATUT_PAIEMENT_LABELS,
} from '../lib/types'

interface LigneArticle {
  id: string
  designation: string
  quantite: number
  prix_unitaire: number
  note: string
}

function nouvelleLigne(): LigneArticle {
  return {
    id: crypto.randomUUID(),
    designation: '',
    quantite: 1,
    prix_unitaire: 0,
    note: '',
  }
}

function genererNumeroCommande(): string {
  const rand = Date.now().toString(36).toUpperCase().slice(-6)
  return `C-${rand}`
}

function formatCHF(n: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(n)
}

export default function NouvelleCommande() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  // Données du formulaire
  const [clientId, setClientId] = useState<string>('')
  const [nouveauClient, setNouveauClient] = useState({
    nom: '',
    telephone: '',
    email: '',
  })
  const [creerNouveauClient, setCreerNouveauClient] = useState(false)
  const [dateEvenement, setDateEvenement] = useState('')
  const [heureEvenement, setHeureEvenement] = useState('')
  const [lieuLivraison, setLieuLivraison] = useState('')
  const [statut, setStatut] = useState<StatutCommande>('brouillon')
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiement>('impaye')
  const [acompteRecu, setAcompteRecu] = useState<number>(0)
  const [noteInterne, setNoteInterne] = useState('')
  const [noteClient, setNoteClient] = useState('')
  const [lignes, setLignes] = useState<LigneArticle[]>([nouvelleLigne()])
  const [erreur, setErreur] = useState<string | null>(null)

  // Clients existants
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('nom', { ascending: true })
      if (error) throw error
      return (data ?? []) as Client[]
    },
  })

  const total = useMemo(
    () =>
      lignes.reduce(
        (s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
        0
      ),
    [lignes]
  )

  const majLigne = (id: string, champ: keyof LigneArticle, valeur: unknown) => {
    setLignes((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l))
    )
  }

  const supprimerLigne = (id: string) => {
    setLignes((prev) =>
      prev.length === 1 ? [nouvelleLigne()] : prev.filter((l) => l.id !== id)
    )
  }

  const ajouterLigne = () => setLignes((prev) => [...prev, nouvelleLigne()])

  const enregistrer = useMutation({
    mutationFn: async () => {
      setErreur(null)

      // 1. Validation
      if (!dateEvenement) {
        throw new Error('La date de l\'événement est obligatoire.')
      }
      if (creerNouveauClient) {
        if (!nouveauClient.nom.trim()) {
          throw new Error('Le nom du client est obligatoire.')
        }
      } else if (!clientId) {
        throw new Error('Choisis un client existant ou crée-en un.')
      }
      const lignesValides = lignes.filter(
        (l) => l.designation.trim().length > 0
      )
      if (lignesValides.length === 0) {
        throw new Error('Ajoute au moins un article à la commande.')
      }

      // 2. Créer le client si besoin
      let clientFinalId = clientId
      if (creerNouveauClient) {
        const { data: nv, error: eC } = await supabase
          .from('clients')
          .insert({
            nom: nouveauClient.nom.trim(),
            telephone: nouveauClient.telephone.trim() || null,
            email: nouveauClient.email.trim() || null,
            cree_par: user?.id ?? null,
          })
          .select('id')
          .single()
        if (eC) throw eC
        clientFinalId = nv.id
      }

      // 3. Créer la commande
      const { data: cmd, error: eCmd } = await supabase
        .from('commandes')
        .insert({
          numero_commande: genererNumeroCommande(),
          client_id: clientFinalId,
          date_evenement: dateEvenement,
          heure_evenement: heureEvenement || null,
          lieu_livraison: lieuLivraison.trim() || null,
          statut,
          statut_paiement: statutPaiement,
          prix_total: total,
          acompte_recu: Number(acompteRecu) || 0,
          note_interne: noteInterne.trim() || null,
          note_client: noteClient.trim() || null,
          cree_par: user?.id ?? null,
        })
        .select('id')
        .single()
      if (eCmd) throw eCmd

      // 4. Créer les items
      const itemsPayload = lignesValides.map((l, i) => ({
        commande_id: cmd.id,
        nom_libre: l.designation.trim(),
        quantite: Number(l.quantite) || 1,
        prix_unitaire: Number(l.prix_unitaire) || 0,
        note: l.note.trim() || null,
        ordre: i,
      }))
      const { error: eItems } = await supabase
        .from('commande_items')
        .insert(itemsPayload)
      if (eItems) throw eItems

      return cmd.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      navigate('/commandes')
    },
    onError: (err: unknown) => {
      // Les erreurs Supabase sont des objets {code, message, details, hint}
      // et NE SONT PAS des instances d'Error.
      const e = err as { message?: string; details?: string; hint?: string; code?: string }
      const msg =
        e?.message ||
        (typeof err === 'string' ? err : '') ||
        'Erreur inconnue'
      const detail = e?.details || e?.hint || ''
      const code = e?.code ? ` (code ${e.code})` : ''
      setErreur(`${msg}${detail ? ' — ' + detail : ''}${code}`)
    },
  })

  return (
    <div>
      <header className="mb-8">
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux commandes
        </Link>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Nouvelle commande
        </h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enregistrer.mutate()
        }}
        className="grid gap-6"
      >
        {/* Client */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Client</h2>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setCreerNouveauClient(false)}
              className={
                'flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ' +
                (!creerNouveauClient
                  ? 'bg-warm-brown text-cream'
                  : 'bg-soft-taupe/30 text-warm-brown/80 hover:bg-soft-taupe/50')
              }
            >
              Client existant
            </button>
            <button
              type="button"
              onClick={() => setCreerNouveauClient(true)}
              className={
                'flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ' +
                (creerNouveauClient
                  ? 'bg-warm-brown text-cream'
                  : 'bg-soft-taupe/30 text-warm-brown/80 hover:bg-soft-taupe/50')
              }
            >
              Nouveau client
            </button>
          </div>

          {!creerNouveauClient ? (
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Choisir un client
              </span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input-field"
                required={!creerNouveauClient}
              >
                <option value="">— Sélectionner —</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                    {c.telephone ? ` · ${c.telephone}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                  Nom *
                </span>
                <input
                  type="text"
                  required
                  value={nouveauClient.nom}
                  onChange={(e) =>
                    setNouveauClient({ ...nouveauClient, nom: e.target.value })
                  }
                  className="input-field"
                  placeholder="Prénom Nom"
                />
              </label>
              <label className="block">
                <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                  Téléphone
                </span>
                <input
                  type="tel"
                  value={nouveauClient.telephone}
                  onChange={(e) =>
                    setNouveauClient({
                      ...nouveauClient,
                      telephone: e.target.value,
                    })
                  }
                  className="input-field"
                  placeholder="+41 …"
                />
              </label>
              <label className="block">
                <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                  Email
                </span>
                <input
                  type="email"
                  value={nouveauClient.email}
                  onChange={(e) =>
                    setNouveauClient({
                      ...nouveauClient,
                      email: e.target.value,
                    })
                  }
                  className="input-field"
                />
              </label>
            </div>
          )}
        </section>

        {/* Événement */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Événement</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Date *
              </span>
              <input
                type="date"
                required
                value={dateEvenement}
                onChange={(e) => setDateEvenement(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Heure
              </span>
              <input
                type="time"
                value={heureEvenement}
                onChange={(e) => setHeureEvenement(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Lieu de livraison
              </span>
              <input
                type="text"
                value={lieuLivraison}
                onChange={(e) => setLieuLivraison(e.target.value)}
                className="input-field"
                placeholder="Adresse ou lieu"
              />
            </label>
          </div>
        </section>

        {/* Articles */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Articles</h2>
            <button
              type="button"
              onClick={ajouterLigne}
              className="inline-flex items-center gap-1.5 text-sm text-warm-brown hover:text-warm-brown/70"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajouter
            </button>
          </div>

          <ul className="grid gap-4">
            {lignes.map((l, idx) => (
              <li
                key={l.id}
                className="rounded-2xl border border-soft-taupe/50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-warm-brown/60">
                    Article {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => supprimerLigne(l.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-warm-brown/60 hover:bg-alert-red/10 hover:text-alert-red transition"
                    aria-label={`Supprimer l'article ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <label className="block sm:col-span-4">
                    <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                      Désignation
                    </span>
                    <input
                      type="text"
                      value={l.designation}
                      onChange={(e) =>
                        majLigne(l.id, 'designation', e.target.value)
                      }
                      className="input-field"
                      placeholder="Ex. Tarte au citron (6 pers)"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                      Quantité
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={l.quantite}
                      onChange={(e) =>
                        majLigne(l.id, 'quantite', Number(e.target.value))
                      }
                      className="input-field"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                      Prix unit. (CHF)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.05}
                      value={l.prix_unitaire}
                      onChange={(e) =>
                        majLigne(
                          l.id,
                          'prix_unitaire',
                          Number(e.target.value)
                        )
                      }
                      className="input-field"
                    />
                  </label>
                  <label className="block sm:col-span-6">
                    <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                      Note (optionnel)
                    </span>
                    <input
                      type="text"
                      value={l.note}
                      onChange={(e) => majLigne(l.id, 'note', e.target.value)}
                      className="input-field"
                      placeholder="Allergies, instructions…"
                    />
                  </label>
                </div>
                <div className="flex justify-end mt-3 text-sm text-warm-brown/70">
                  Sous-total : {formatCHF(l.quantite * l.prix_unitaire)}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end items-baseline gap-3 mt-6 pt-4 border-t border-soft-taupe/40">
            <span className="text-sm text-warm-brown/70">Total</span>
            <span className="font-serif text-2xl text-warm-brown">
              {formatCHF(total)}
            </span>
          </div>
        </section>

        {/* Statuts & paiement */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Statut & paiement</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Statut
              </span>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutCommande)}
                className="input-field"
              >
                {(Object.keys(STATUT_COMMANDE_LABELS) as StatutCommande[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {STATUT_COMMANDE_LABELS[s]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Paiement
              </span>
              <select
                value={statutPaiement}
                onChange={(e) =>
                  setStatutPaiement(e.target.value as StatutPaiement)
                }
                className="input-field"
              >
                {(Object.keys(STATUT_PAIEMENT_LABELS) as StatutPaiement[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {STATUT_PAIEMENT_LABELS[s]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Acompte reçu (CHF)
              </span>
              <input
                type="number"
                min={0}
                step={0.05}
                value={acompteRecu}
                onChange={(e) => setAcompteRecu(Number(e.target.value))}
                className="input-field"
              />
            </label>
          </div>
        </section>

        {/* Notes */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Notes</h2>
          <div className="grid gap-3">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Note interne (visible uniquement par Anita)
              </span>
              <textarea
                value={noteInterne}
                onChange={(e) => setNoteInterne(e.target.value)}
                className="input-field min-h-[6rem]"
                rows={3}
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
                Note visible au client (sur devis / facture)
              </span>
              <textarea
                value={noteClient}
                onChange={(e) => setNoteClient(e.target.value)}
                className="input-field min-h-[5rem]"
                rows={2}
              />
            </label>
          </div>
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

        <div className="flex gap-3 justify-end sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <Link
            to="/commandes"
            className="btn-secondary"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={enregistrer.isPending}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enregistrer.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              'Créer la commande'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
