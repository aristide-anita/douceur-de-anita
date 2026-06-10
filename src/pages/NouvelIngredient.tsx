import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, AlertCircle, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { UniteIngredient } from '../lib/types'
import { UNITE_LABELS } from '../lib/types'

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

export default function NouvelIngredient() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [nom, setNom] = useState('')
  const [unite, setUnite] = useState<UniteIngredient>('g')
  const [prix, setPrix] = useState<string>('0')
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const enregistrer = useMutation({
    mutationFn: async () => {
      setErreur(null)
      if (!nom.trim()) {
        throw new Error("Le nom de l'ingrédient est obligatoire.")
      }
      const { data, error } = await supabase
        .from('ingredients')
        .insert({
          nom: nom.trim(),
          unite_achat: unite,
          prix_unitaire_chf: Number(prix) || 0,
          note: note.trim() || null,
          actif: true,
          cree_par: user?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      navigate('/ingredients')
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
    },
  })

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/ingredients"
        className="inline-flex items-center gap-1.5 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux ingrédients
      </Link>

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Nouvel ingrédient
        </h1>
        <p className="text-sm text-warm-brown/60 mt-1">
          Indique le prix unitaire pour calculer automatiquement le coût des
          recettes qui l’utilisent.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enregistrer.mutate()
        }}
        className="grid gap-6"
      >
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Identité</h2>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <label className="block sm:col-span-2">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Nom *
              </span>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="input-field"
                placeholder="Ex. Farine, Sucre, Beurre…"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Unité d’achat
              </span>
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value as UniteIngredient)}
                className="input-field"
              >
                {(Object.keys(UNITE_LABELS) as UniteIngredient[]).map((u) => (
                  <option key={u} value={u}>
                    {UNITE_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Prix unitaire (CHF / {UNITE_LABELS[unite]})
              </span>
              <input
                type="number"
                min={0}
                step={0.0001}
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Note (optionnel)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field min-h-[5rem] resize-y"
                rows={3}
                placeholder="Marque préférée, lieu d'achat, particularité…"
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
          <Link to="/ingredients" className="btn-secondary">
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
                Création…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                Créer l’ingrédient
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
