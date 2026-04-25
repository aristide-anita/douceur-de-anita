import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Save,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Commande,
  CommandeItem,
  Client,
  StatutCommande,
  StatutPaiement,
  STATUT_COMMANDE_LABELS,
  STATUT_PAIEMENT_LABELS,
} from '../lib/types'

interface LigneArticle {
  id: string // local uuid (UI key)
  dbId: string | null // id en base si existant
  designation: string
  quantite: number
  prix_unitaire: number
  note: string
}

interface CommandeComplete extends Commande {
  client: Pick<Client, 'id' | 'nom' | 'telephone' | 'email'> | null
  items: CommandeItem[]
}

function ligneVide(): LigneArticle {
  return {
    id: crypto.randomUUID(),
    dbId: null,
    designation: '',
    quantite: 1,
    prix_unitaire: 0,
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

export default function FicheCommande() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  // Champs édités
  const [dateEvenement, setDateEvenement] = useState('')
  const [heureEvenement, setHeureEvenement] = useState('')
  const [lieuLivraison, setLieuLivraison] = useState('')
  const [statut, setStatut] = useState<StatutCommande>('brouillon')
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiement>('impaye')
  const [acompteRecu, setAcompteRecu] = useState<string>('0')
  const [noteInterne, setNoteInterne] = useState('')
  const [noteClient, setNoteClient] = useState('')
  const [lignes, setLignes] = useState<LigneArticle[]>([])

  // Chargement
  const { data, isLoading, error } = useQuery<CommandeComplete>({
    queryKey: ['commande', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select(
          '*, client:clients(id, nom, telephone, email), items:commande_items(*)'
        )
        .eq('id', id)
        .single()
      if (error) throw error
      return data as CommandeComplete
    },
  })

  // Pré-remplir le formulaire au chargement
  useEffect(() => {
    if (!data) return
    setDateEvenement(data.date_evenement || '')
    setHeureEvenement(data.heure_evenement?.slice(0, 5) || '')
    setLieuLivraison(data.lieu_livraison || '')
    setStatut(data.statut)
    setStatutPaiement(data.statut_paiement)
    setAcompteRecu(String(data.acompte_recu ?? 0))
    setNoteInterne(data.note_interne || '')
    setNoteClient(data.note_client || '')
    const items = (data.items || []).slice().sort((a, b) => a.ordre - b.ordre)
    setLignes(
      items.length > 0
        ? items.map((it) => ({
            id: it.id,
            dbId: it.id,
            designation: it.nom_libre || '',
            quantite: Number(it.quantite) || 1,
            prix_unitaire: Number(it.prix_unitaire) || 0,
            note: it.note || '',
          }))
        : [ligneVide()]
    )
  }, [data])

  const total = useMemo(
    () =>
      lignes.reduce(
        (s, l) =>
          s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
        0
      ),
    [lignes]
  )

  const setLigne = (lid: string, patch: Partial<LigneArticle>) => {
    setLignes((prev) =>
      prev.map((l) => (l.id === lid ? { ...l, ...patch } : l))
    )
  }
  const supprimerLigne = (lid: string) => {
    setLignes((prev) =>
      prev.length === 1 ? [ligneVide()] : prev.filter((l) => l.id !== lid)
    )
  }
  const ajouterLigne = () =>
    setLignes((prev) => [...prev, ligneVide()])

  // Sauvegarde
  const sauver = useMutation({
    mutationFn: async () => {
      setErreur(null)
      if (!id) throw new Error('Identifiant manquant')
      if (!dateEvenement) {
        throw new Error("La date de l'événement est obligatoire.")
      }
      const lignesValides = lignes.filter(
        (l) => l.designation.trim().length > 0
      )
      if (lignesValides.length === 0) {
        throw new Error('Ajoute au moins un article à la commande.')
      }

      // 1. Mettre à jour la commande
      const { error: eCmd } = await supabase
        .from('commandes')
        .update({
          date_evenement: dateEvenement,
          heure_evenement: heureEvenement || null,
          lieu_livraison: lieuLivraison.trim() || null,
          statut,
          statut_paiement: statutPaiement,
          prix_total: total,
          acompte_recu: Number(acompteRecu) || 0,
          note_interne: noteInterne.trim() || null,
          note_client: noteClient.trim() || null,
        })
        .eq('id', id)
      if (eCmd) throw eCmd

      // 2. Remplacer les items : on supprime puis on réinsère
      const { error: eDel } = await supabase
        .from('commande_items')
        .delete()
        .eq('commande_id', id)
      if (eDel) throw eDel

      const itemsPayload = lignesValides.map((l, i) => ({
        commande_id: id,
        nom_libre: l.designation.trim(),
        quantite: Number(l.quantite) || 1,
        prix_unitaire: Number(l.prix_unitaire) || 0,
        note: l.note.trim() || null,
        ordre: i,
      }))
      const { error: eIns } = await supabase
        .from('commande_items')
        .insert(itemsPayload)
      if (eIns) throw eIns
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commande', id] })
      qc.invalidateQueries({ queryKey: ['commandes'] })
      navigate('/commandes')
    },
    onError: (err) => setErreur(lireErreur(err)),
  })

  // Suppression
  const supprimer = useMutation({
    mutationFn: async () => {
      setErreur(null)
      if (!id) throw new Error('Identifiant manquant')
      // Supprimer les items d'abord (au cas où le FK n'a pas ON DELETE CASCADE)
      const { error: eDel } = await supabase
        .from('commande_items')
        .delete()
        .eq('commande_id', id)
      if (eDel) throw eDel
      const { error: eCmd } = await supabase
        .from('commandes')
        .delete()
        .eq('id', id)
      if (eCmd) throw eCmd
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes'] })
      navigate('/commandes')
    },
    onError: (err) => setErreur(lireErreur(err)),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-warm-brown/60">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="card border border-alert-red/40 bg-alert-red/5 p-6">
        <p className="text-alert-red flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>
            {error ? lireErreur(error) : 'Commande introuvable.'}
          </span>
        </p>
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 mt-4 text-sm text-warm-brown hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux commandes
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux commandes
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl">
              {data.client?.nom ?? 'Client supprimé'}
            </h1>
            {data.numero_commande && (
              <p className="text-sm text-warm-brown/60 mt-1">
                {data.numero_commande}
              </p>
            )}
          </div>
          {data.client && (
            <div className="flex flex-col items-end gap-1 text-sm text-warm-brown/70">
              {data.client.telephone && (
                <a
                  href={`tel:${data.client.telephone}`}
                  className="inline-flex items-center gap-1.5 hover:text-warm-brown"
                >
                  <Phone className="h-4 w-4" />
                  {data.client.telephone}
                </a>
              )}
              {data.client.email && (
                <a
                  href={`mailto:${data.client.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-warm-brown"
                >
                  <Mail className="h-4 w-4" />
                  {data.client.email}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6">
        {/* Événement */}
        <section className="card p-5">
          <h2 className="font-serif text-lg mb-4">Événement</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Date *
              </span>
              <input
                type="date"
                value={dateEvenement}
                onChange={(e) => setDateEvenement(e.target.value)}
                className="input w-full"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Heure
              </span>
              <input
                type="time"
                value={heureEvenement}
                onChange={(e) => setHeureEvenement(e.target.value)}
                className="input w-full"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Lieu de livraison
              </span>
              <input
                type="text"
                placeholder="Adresse ou lieu"
                value={lieuLivraison}
                onChange={(e) => setLieuLivraison(e.target.value)}
                className="input w-full"
              />
            </label>
          </div>
        </section>

        {/* Articles */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg">Articles</h2>
            <button
              type="button"
              onClick={ajouterLigne}
              className="btn-secondary text-sm"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
          <ul className="grid gap-3">
            {lignes.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-12 gap-2 items-end border border-soft-taupe/40 rounded-2xl p-3"
              >
                <label className="col-span-12 sm:col-span-5 block">
                  <span className="block text-xs text-warm-brown/60 mb-1">
                    Désignation
                  </span>
                  <input
                    type="text"
                    placeholder="Ex. Tarte au citron (6 pers)"
                    value={l.designation}
                    onChange={(e) =>
                      setLigne(l.id, { designation: e.target.value })
                    }
                    className="input w-full"
                  />
                </label>
                <label className="col-span-4 sm:col-span-2 block">
                  <span className="block text-xs text-warm-brown/60 mb-1">
                    Quantité
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantite}
                    onChange={(e) =>
                      setLigne(l.id, { quantite: Number(e.target.value) })
                    }
                    className="input w-full"
                  />
                </label>
                <label className="col-span-5 sm:col-span-2 block">
                  <span className="block text-xs text-warm-brown/60 mb-1">
                    Prix unit. (CHF)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.05"
                    value={l.prix_unitaire}
                    onChange={(e) =>
                      setLigne(l.id, {
                        prix_unitaire: Number(e.target.value),
                      })
                    }
                    className="input w-full"
                  />
                </label>
                <label className="col-span-12 sm:col-span-2 block">
                  <span className="block text-xs text-warm-brown/60 mb-1">
                    Note (optionnel)
                  </span>
                  <input
                    type="text"
                    placeholder="Allergies, instructions…"
                    value={l.note}
                    onChange={(e) =>
                      setLigne(l.id, { note: e.target.value })
                    }
                    className="input w-full"
                  />
                </label>
                <div className="col-span-3 sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => supprimerLigne(l.id)}
                    className="rounded-xl border border-alert-red/30 text-alert-red hover:bg-alert-red/10 p-2"
                    aria-label="Supprimer cette ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-warm-brown font-medium">
            Total : {formatCHF(total)}
          </p>
        </section>

        {/* Statut & paiement */}
        <section className="card p-5">
          <h2 className="font-serif text-lg mb-4">Statut & paiement</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Statut
              </span>
              <select
                value={statut}
                onChange={(e) =>
                  setStatut(e.target.value as StatutCommande)
                }
                className="input w-full"
              >
                {(
                  Object.keys(
                    STATUT_COMMANDE_LABELS
                  ) as StatutCommande[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {STATUT_COMMANDE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Paiement
              </span>
              <select
                value={statutPaiement}
                onChange={(e) =>
                  setStatutPaiement(e.target.value as StatutPaiement)
                }
                className="input w-full"
              >
                {(
                  Object.keys(
                    STATUT_PAIEMENT_LABELS
                  ) as StatutPaiement[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {STATUT_PAIEMENT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-warm-brown/70 mb-1">
                Acompte reçu (CHF)
              </span>
              <input
                type="number"
                min={0}
                step="0.05"
                value={acompteRecu}
                onChange={(e) => setAcompteRecu(e.target.value)}
                className="input w-full"
              />
            </label>
          </div>
        </section>

        {/* Notes */}
        <section className="card p-5">
          <h2 className="font-serif text-lg mb-4">Notes</h2>
          <label className="block mb-3">
            <span className="block text-sm text-warm-brown/70 mb-1">
              Note interne (visible uniquement par Anita)
            </span>
            <textarea
              rows={3}
              value={noteInterne}
              onChange={(e) => setNoteInterne(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="block text-sm text-warm-brown/70 mb-1">
              Note visible au client (sur devis / facture)
            </span>
            <textarea
              rows={2}
              value={noteClient}
              onChange={(e) => setNoteClient(e.target.value)}
              className="input w-full"
            />
          </label>
        </section>

        {erreur && (
          <div className="card border border-alert-red/40 bg-alert-red/5 p-4">
            <p className="text-alert-red flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{erreur}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {!confirmerSuppression ? (
            <button
              type="button"
              onClick={() => setConfirmerSuppression(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-alert-red/40 text-alert-red hover:bg-alert-red/10 px-4 py-2 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la commande
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-alert-red">
                Confirmer la suppression ?
              </span>
              <button
                type="button"
                onClick={() => supprimer.mutate()}
                disabled={supprimer.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-alert-red text-white px-4 py-2 text-sm hover:bg-alert-red/90 disabled:opacity-60"
              >
                {supprimer.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Oui, supprimer
              </button>
              <button
                type="button"
                onClick={() => setConfirmerSuppression(false)}
                className="text-sm text-warm-brown/70 hover:text-warm-brown px-2 py-2"
              >
                Annuler
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Link
              to="/commandes"
              className="text-warm-brown/70 hover:text-warm-brown text-sm"
            >
              Retour
            </Link>
            <button
              type="button"
              onClick={() => sauver.mutate()}
              disabled={sauver.isPending}
              className="btn-primary"
            >
              {sauver.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
