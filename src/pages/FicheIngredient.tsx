import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, AlertCircle, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Ingredient, UniteIngredient } from '../lib/types'
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

export default function FicheIngredient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  const [nom, setNom] = useState('')
  const [unite, setUnite] = useState<UniteIngredient>('g')
  const [prix, setPrix] = useState<string>('0')
  const [note, setNote] = useState('')
  const [actif, setActif] = useState(true)

  const { data, isLoading, error } = useQuery<Ingredient>({
    queryKey: ['ingredient', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Ingredient
    },
  })

  useEffect(() => {
    if (!data) return
    setNom(data.nom ?? '')
    setUnite(data.unite_achat)
    setPrix(String(data.prix_unitaire_chf ?? 0))
    setNote(data.note ?? '')
    setActif(!!data.actif)
  }, [data])

  const sauver = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      if (!nom.trim()) throw new Error('Le nom est obligatoire')
      const { error } = await supabase
        .from('ingredients')
        .update({
          nom: nom.trim(),
          unite_achat: unite,
          prix_unitaire_chf: Number(prix) || 0,
          note: note.trim() || null,
          actif,
          modifie_le: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['ingredient', id] })
      navigate('/ingredients')
    },
    onError: (err: unknown) => setErreur(lireErreur(err)),
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      const { error } = await supabase.from('ingredients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      navigate('/ingredients')
    },
    onError: (err: unknown) => {
      setErreur(
        lireErreur(err) +
          ' — Cet ingrédient est peut-être utilisé dans une recette.'
      )
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
          <p className="font-medium text-alert-red">Ingrédient introuvable</p>
          <Link
            to="/ingredients"
            className="text-sm underline text-warm-brown mt-2 inline-block"
          >
            Retour aux ingrédients
          </Link>
        </div>
      </div>
    )
  }

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
          {data.nom}
        </h1>
        <p className="text-sm text-warm-brown/60 mt-1">
          {UNITE_LABELS[data.unite_achat]} · {data.prix_unitaire_chf.toFixed(2)} CHF
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
              <span className="text-sm text-warm-brown/80 mb-2 block">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field min-h-[5rem] resize-y"
                rows={3}
              />
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={actif}
                onChange={(e) => setActif(e.target.checked)}
                className="h-4 w-4 rounded border-soft-taupe text-warm-brown focus:ring-dusty-pink/50"
              />
              <span className="text-sm text-warm-brown">
                Ingrédient actif (proposable dans les recettes)
              </span>
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

        <section className="card border-alert-red/30 bg-alert-red/5">
          <h2 className="font-serif text-xl mb-2 text-alert-red">
            Zone dangereuse
          </h2>
          <p className="text-sm text-warm-brown/70 mb-4">
            La suppression échoue si l’ingrédient est utilisé dans au moins une
            recette.
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
              Supprimer l’ingrédient
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
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
          <Link to="/ingredients" className="btn-secondary">
            Retour
          </Link>
          <button
            type="submit"
            disabled={sauver.isPending}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sauver.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
