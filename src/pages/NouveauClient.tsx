import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Client } from '../lib/types'

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

export default function NouveauClient() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) {
        throw new Error('Le nom est obligatoire')
      }
      const { data, error } = await supabase
        .from('clients')
        .insert({
          nom: nom.trim(),
          telephone: telephone.trim() || null,
          email: email.trim() || null,
          adresse: adresse.trim() || null,
          code_postal: codePostal.trim() || null,
          ville: ville.trim() || null,
          note: note.trim() || null,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Client
    },
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      navigate(`/clients/${client.id}`)
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
    },
  })

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux clients
      </Link>

      <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-8">
        Nouveau client
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setErreur(null)
          enregistrer.mutate()
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
              placeholder="Ex. Marie Dupont"
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
                placeholder="079 123 45 67"
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
                placeholder="marie@exemple.ch"
              />
            </label>
          </div>
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
                placeholder="Rue du Lac 12"
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
                placeholder="1003"
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
                placeholder="Lausanne"
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
          <Link to="/clients" className="btn-secondary">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={enregistrer.isPending}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enregistrer.isPending ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Enregistrement…
              </>
            ) : (
              'Créer le client'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
