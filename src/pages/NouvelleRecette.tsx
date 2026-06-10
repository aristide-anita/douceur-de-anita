import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, AlertCircle, Save, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CategorieRecette } from '../lib/types'
import PhotoUpload from '../components/PhotoUpload'
import CompositionRecette, {
  type LigneCompo,
} from '../components/CompositionRecette'
import TextareaIngredients from '../components/TextareaIngredients'
import { useQuery } from '@tanstack/react-query'
import type { Ingredient } from '../lib/types'

const CATEGORIE_LABELS: Record<CategorieRecette, string> = {
  patisserie: 'Pâtisserie',
  traiteur_salee: 'Traiteur salé',
  traiteur_sucree: 'Traiteur sucré',
  boisson: 'Boisson',
  autre: 'Autre',
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

export default function NouvelleRecette() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState<CategorieRecette>('patisserie')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [portions, setPortions] = useState<string>('1')
  const [tempsPrepa, setTempsPrepa] = useState<string>('0')
  const [coutMatieres, setCoutMatieres] = useState<string>('0')
  const [coutEmballage, setCoutEmballage] = useState<string>('0')
  const [prixVente, setPrixVente] = useState<string>('0')
  const [actif, setActif] = useState(true)
  const [favori, setFavori] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Composition (ingrédients)
  const [composition, setComposition] = useState<LigneCompo[]>([])
  const [coutAuto, setCoutAuto] = useState(true)

  const onCoutTotalChange = (cout: number) => {
    if (coutAuto) setCoutMatieres(cout.toFixed(2))
  }

  // Charge les ingrédients pour le @-picker
  const { data: ingredientsList = [] } = useQuery<Ingredient[]>({
    queryKey: ['ingredients-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('actif', true)
        .order('nom', { ascending: true })
      if (error) throw error
      return (data ?? []) as Ingredient[]
    },
    staleTime: 60_000,
  })

  const calcul = useMemo(() => {
    const cm = Number(coutMatieres) || 0
    const ce = Number(coutEmballage) || 0
    const pv = Number(prixVente) || 0
    const cout = cm + ce
    const margeBrute = pv - cout
    const margePct = pv > 0 ? (margeBrute / pv) * 100 : 0
    return { cout, margeBrute, margePct }
  }, [coutMatieres, coutEmballage, prixVente])

  const margePositive = calcul.margeBrute >= 0

  const enregistrer = useMutation({
    mutationFn: async () => {
      setErreur(null)
      if (!nom.trim()) {
        throw new Error('Le nom de la recette est obligatoire.')
      }
      const { data, error } = await supabase
        .from('recettes')
        .insert({
          nom: nom.trim(),
          categorie,
          description: description.trim() || null,
          photo_url: photos[0] ?? null,
          photos,
          portions: Number(portions) || 1,
          temps_prepa_min: Number(tempsPrepa) || 0,
          cout_matieres_forfait: Number(coutMatieres) || 0,
          cout_emballage: Number(coutEmballage) || 0,
          prix_vente: Number(prixVente) || 0,
          actif,
          favori,
          cree_par: user?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      const recetteId = data.id as string

      // Insère les lignes de composition (si présentes)
      const lignesValides = composition.filter(
        (l) => l.ingredient_id && l.quantite > 0
      )
      if (lignesValides.length > 0) {
        const payload = lignesValides.map((l, i) => ({
          recette_id: recetteId,
          ingredient_id: l.ingredient_id,
          quantite: l.quantite,
          unite: l.unite,
          note: l.note?.trim() || null,
          ordre: i,
        }))
        const { error: errIng } = await supabase
          .from('recette_ingredients')
          .insert(payload)
        if (errIng) throw errIng
      }
      return recetteId
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['recettes'] })
      navigate(`/recettes/${id}`)
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
    },
  })

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/recettes"
        className="inline-flex items-center gap-1.5 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux recettes
      </Link>

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Nouvelle recette
        </h1>
        <p className="text-sm text-warm-brown/60 mt-1">
          Renseigne les coûts et le prix de vente pour voir la marge en direct.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enregistrer.mutate()
        }}
        className="grid gap-6"
      >
        {/* Identité */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Identité</h2>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
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
                placeholder="Ex. Tarte au citron meringuée"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Catégorie
              </span>
              <select
                value={categorie}
                onChange={(e) =>
                  setCategorie(e.target.value as CategorieRecette)
                }
                className="input-field"
              >
                {(Object.keys(CATEGORIE_LABELS) as CategorieRecette[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CATEGORIE_LABELS[c]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block sm:col-span-3">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Description
              </span>
              <TextareaIngredients
                value={description}
                onChange={setDescription}
                ingredients={ingredientsList}
                composition={composition}
                rows={6}
                placeholder="Étapes, technique, particularités… Tape @ pour insérer un ingrédient."
              />
            </label>
          </div>
        </section>

        {/* Photos */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Photos</h2>
          <PhotoUpload
            value={photos}
            onChange={setPhotos}
            disabled={enregistrer.isPending}
          />
        </section>

        {/* Composition (ingrédients) */}
        <section className="card">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
            <h2 className="font-serif text-xl">Composition</h2>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-warm-brown/80">
              <input
                type="checkbox"
                checked={coutAuto}
                onChange={(e) => setCoutAuto(e.target.checked)}
                className="h-4 w-4 rounded border-soft-taupe text-warm-brown focus:ring-dusty-pink/50"
              />
              Calculer le coût matières automatiquement
            </label>
          </div>
          <CompositionRecette
            lignes={composition}
            onChange={setComposition}
            onCoutTotalChange={onCoutTotalChange}
            disabled={enregistrer.isPending}
          />
        </section>

        {/* Production */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Production</h2>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Portions
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={portions}
                onChange={(e) => setPortions(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Temps de préparation (min)
              </span>
              <input
                type="number"
                min={0}
                step={5}
                value={tempsPrepa}
                onChange={(e) => setTempsPrepa(e.target.value)}
                className="input-field"
              />
            </label>
          </div>
        </section>

        {/* Coûts & prix */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">Coûts & prix</h2>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Matières (CHF){' '}
                {coutAuto && (
                  <span className="text-xs text-warm-brown/50">(auto)</span>
                )}
              </span>
              <input
                type="number"
                min={0}
                step={0.05}
                value={coutMatieres}
                onChange={(e) => setCoutMatieres(e.target.value)}
                disabled={coutAuto}
                className="input-field disabled:bg-soft-taupe/20 disabled:cursor-not-allowed"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Emballage (CHF)
              </span>
              <input
                type="number"
                min={0}
                step={0.05}
                value={coutEmballage}
                onChange={(e) => setCoutEmballage(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="text-sm text-warm-brown/80 mb-2 block">
                Prix de vente (CHF)
              </span>
              <input
                type="number"
                min={0}
                step={0.05}
                value={prixVente}
                onChange={(e) => setPrixVente(e.target.value)}
                className="input-field"
              />
            </label>
          </div>

          {/* Récap marge */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3 rounded-2xl bg-soft-taupe/20 p-4">
            <div>
              <p className="text-xs text-warm-brown/60">Coût total</p>
              <p className="font-serif text-lg text-warm-brown mt-0.5">
                {formatCHF(calcul.cout)}
              </p>
            </div>
            <div>
              <p className="text-xs text-warm-brown/60">Marge brute</p>
              <p
                className={
                  'font-serif text-lg mt-0.5 ' +
                  (margePositive ? 'text-emerald-700' : 'text-alert-red')
                }
              >
                {formatCHF(calcul.margeBrute)}
              </p>
            </div>
            <div>
              <p className="text-xs text-warm-brown/60">Marge %</p>
              <p
                className={
                  'font-serif text-lg mt-0.5 ' +
                  (margePositive ? 'text-emerald-700' : 'text-alert-red')
                }
              >
                {calcul.margePct.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        {/* État */}
        <section className="card">
          <h2 className="font-serif text-xl mb-4">État</h2>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={actif}
                onChange={(e) => setActif(e.target.checked)}
                className="h-4 w-4 rounded border-soft-taupe text-warm-brown focus:ring-dusty-pink/50"
              />
              <span className="text-sm text-warm-brown">
                Recette active (proposable au catalogue)
              </span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={favori}
                onChange={(e) => setFavori(e.target.checked)}
                className="h-4 w-4 rounded border-soft-taupe text-warm-brown focus:ring-dusty-pink/50"
              />
              <span className="text-sm text-warm-brown inline-flex items-center gap-1.5">
                <Star
                  className={
                    'h-4 w-4 ' +
                    (favori
                      ? 'fill-caramel text-caramel'
                      : 'text-warm-brown/40')
                  }
                  aria-hidden="true"
                />
                Marquer comme favori
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

        <div className="flex gap-3 justify-end sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <Link to="/recettes" className="btn-secondary">
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
                Créer la recette
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
