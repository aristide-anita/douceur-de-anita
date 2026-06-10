import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Trash2,
  Save,
  Star,
  Printer,
  Mail,
  MessageCircle,
  Share2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Recette,
  CategorieRecette,
  RecetteIngredient,
} from '../lib/types'
import { UNITE_LABELS } from '../lib/types'
import type { Ingredient } from '../lib/types'
import PhotoUpload from '../components/PhotoUpload'
import CompositionRecette, {
  type LigneCompo,
} from '../components/CompositionRecette'
import TextareaIngredients from '../components/TextareaIngredients'
import { useToast } from '../components/Toast'

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

function texteRecette(r: Recette, photos: string[]): string {
  const lignes: string[] = []
  lignes.push(`${r.nom}`)
  lignes.push(`${CATEGORIE_LABELS[r.categorie]}`)
  if (r.portions) lignes.push(`Portions : ${r.portions}`)
  if (r.temps_prepa_min)
    lignes.push(`Préparation : ${r.temps_prepa_min} min`)
  if (r.description?.trim()) {
    lignes.push('')
    lignes.push(r.description.trim())
  }
  if (photos[0]) {
    lignes.push('')
    lignes.push(`Photo : ${photos[0]}`)
  }
  lignes.push('')
  lignes.push('— Partagé depuis DouceurDeANITA')
  return lignes.join('\n')
}

function mailtoRecette(r: Recette, photos: string[]): string {
  const sujet = encodeURIComponent(`Recette : ${r.nom}`)
  const corps = encodeURIComponent(texteRecette(r, photos))
  return `mailto:?subject=${sujet}&body=${corps}`
}

function whatsappRecette(r: Recette, photos: string[]): string {
  const txt = encodeURIComponent(texteRecette(r, photos))
  return `https://wa.me/?text=${txt}`
}

async function partagerNatif(r: Recette, photos: string[]) {
  try {
    await (navigator as Navigator & {
      share: (data: { title?: string; text?: string }) => Promise<void>
    }).share({
      title: r.nom,
      text: texteRecette(r, photos),
    })
  } catch {
    // L'utilisateur a annulé le partage, ignore.
  }
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

export default function FicheRecette() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  // Champs édités
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
  const [composition, setComposition] = useState<LigneCompo[]>([])
  const [coutAuto, setCoutAuto] = useState(false)
  const [portionsCible, setPortionsCible] = useState<string>('')

  const onCoutTotalChange = (cout: number) => {
    if (coutAuto) setCoutMatieres(cout.toFixed(2))
  }

  const { data, isLoading, error } = useQuery<Recette>({
    queryKey: ['recette', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recettes')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Recette
    },
  })

  // Charge la composition (recette_ingredients)
  const { data: compositionDb = [] } = useQuery<RecetteIngredient[]>({
    queryKey: ['recette-ingredients', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recette_ingredients')
        .select('*')
        .eq('recette_id', id!)
        .order('ordre', { ascending: true })
      if (error) throw error
      return (data ?? []) as RecetteIngredient[]
    },
  })

  useEffect(() => {
    if (!data) return
    setNom(data.nom ?? '')
    setCategorie(data.categorie)
    setDescription(data.description ?? '')
    setPhotos(
      data.photos && data.photos.length > 0
        ? data.photos
        : data.photo_url
          ? [data.photo_url]
          : []
    )
    setPortions(String(data.portions ?? 1))
    setTempsPrepa(String(data.temps_prepa_min ?? 0))
    setCoutMatieres(String(data.cout_matieres_forfait ?? 0))
    setCoutEmballage(String(data.cout_emballage ?? 0))
    setPrixVente(String(data.prix_vente ?? 0))
    setActif(!!data.actif)
    setFavori(!!data.favori)
  }, [data])

  // Hydrate la composition à partir de la DB
  useEffect(() => {
    setComposition(
      compositionDb.map((c) => ({
        uid: crypto.randomUUID(),
        dbId: c.id,
        ingredient_id: c.ingredient_id,
        quantite: Number(c.quantite),
        unite: c.unite,
        note: c.note ?? '',
      }))
    )
  }, [compositionDb])

  // Charge les ingrédients pour résoudre les noms dans la mise à l'échelle
  const { data: ingredientsListe = [] } = useQuery<Ingredient[]>({
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

  const indexIngredient = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredientsListe) m.set(i.id, i)
    return m
  }, [ingredientsListe])

  // Aperçu mise à l'échelle
  const facteurScale = useMemo(() => {
    const cible = Number(portionsCible)
    const base = Number(portions) || 1
    if (!cible || cible <= 0 || base <= 0) return 1
    return cible / base
  }, [portionsCible, portions])

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

  const sauver = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      if (!nom.trim()) throw new Error('Le nom est obligatoire')
      const { error } = await supabase
        .from('recettes')
        .update({
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
          modifie_le: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error

      // Sync composition: remplace toutes les lignes (simple et fiable pour V1).
      const lignesValides = composition.filter(
        (l) => l.ingredient_id && l.quantite > 0
      )
      const { error: errDel } = await supabase
        .from('recette_ingredients')
        .delete()
        .eq('recette_id', id)
      if (errDel) throw errDel
      if (lignesValides.length > 0) {
        const payload = lignesValides.map((l, i) => ({
          recette_id: id,
          ingredient_id: l.ingredient_id,
          quantite: l.quantite,
          unite: l.unite,
          note: l.note?.trim() || null,
          ordre: i,
        }))
        const { error: errIns } = await supabase
          .from('recette_ingredients')
          .insert(payload)
        if (errIns) throw errIns
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recettes'] })
      qc.invalidateQueries({ queryKey: ['recette', id] })
      qc.invalidateQueries({ queryKey: ['recette-ingredients', id] })
      toast.succes('Recette enregistrée')
      navigate('/recettes')
    },
    onError: (err: unknown) => {
      setErreur(lireErreur(err))
    },
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID manquant')
      const { error } = await supabase.from('recettes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recettes'] })
      toast.succes('Recette supprimée')
      navigate('/recettes')
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
            Impossible de charger cette recette
          </p>
          <p className="text-sm text-warm-brown/70 mt-1">
            {error
              ? (error as Error).message
              : 'Recette introuvable. Elle a peut-être été supprimée.'}
          </p>
          <Link
            to="/recettes"
            className="text-sm underline text-warm-brown mt-2 inline-block"
          >
            Retour aux recettes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/recettes"
        className="inline-flex items-center gap-1.5 text-sm text-warm-brown/70 hover:text-warm-brown mb-4 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux recettes
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight flex items-center gap-2">
            {favori && (
              <Star
                className="h-6 w-6 fill-caramel text-caramel"
                aria-label="Favori"
              />
            )}
            {data.nom}
          </h1>
          <p className="text-sm text-warm-brown/60 mt-1">
            {CATEGORIE_LABELS[data.categorie]}
            {!data.actif && ' · Inactif'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={mailtoRecette(data, photos)}
            className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 border border-soft-taupe/60 px-3 py-2 text-sm font-medium text-warm-brown min-h-[40px]"
            title="Envoyer par email"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Email</span>
          </a>
          <a
            href={whatsappRecette(data, photos)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 px-3 py-2 text-sm font-medium min-h-[40px]"
            title="Partager sur WhatsApp"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={() => partagerNatif(data, photos)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 border border-soft-taupe/60 px-3 py-2 text-sm font-medium text-warm-brown min-h-[40px]"
              title="Partager"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Partager</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 border border-soft-taupe/60 px-3 py-2 text-sm font-medium text-warm-brown min-h-[40px]"
            title="Imprimer"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </header>

      {/* Vue impression : titre + photo + description (le reste est caché par .no-print) */}
      <section className="hidden print:block mb-4">
        <h1 className="font-serif text-3xl text-warm-brown">{data.nom}</h1>
        <p className="text-sm text-warm-brown/70 mt-1">
          {CATEGORIE_LABELS[data.categorie]} · {data.portions} portion
          {data.portions > 1 ? 's' : ''} · {data.temps_prepa_min} min de préparation
        </p>
        {photos[0] && (
          <img
            src={photos[0]}
            alt={data.nom}
            className="mt-4 max-h-72 object-cover rounded"
          />
        )}
        {data.description && (
          <pre className="whitespace-pre-wrap font-sans text-sm text-warm-brown mt-4 leading-relaxed">
            {data.description}
          </pre>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setErreur(null)
          sauver.mutate()
        }}
        className="grid gap-6 print:hidden"
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
                ingredients={ingredientsListe}
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
            disabled={sauver.isPending || supprimer.isPending}
          />
        </section>

        {/* Composition */}
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
            disabled={sauver.isPending || supprimer.isPending}
          />

          {composition.length > 0 && (
            <div className="mt-5 pt-5 border-t border-soft-taupe/40">
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <label className="block">
                  <span className="text-sm text-warm-brown/80 mb-2 block">
                    Calculer les quantités pour
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={portionsCible}
                      onChange={(e) => setPortionsCible(e.target.value)}
                      placeholder={String(portions)}
                      className="input-field w-28"
                    />
                    <span className="text-sm text-warm-brown/70">
                      portions{' '}
                      <span className="text-warm-brown/50">
                        (base : {portions || 1})
                      </span>
                    </span>
                  </div>
                </label>
                {Number(portionsCible) > 0 && facteurScale !== 1 && (
                  <span className="text-sm text-warm-brown/80">
                    × {facteurScale.toFixed(2)}
                  </span>
                )}
              </div>

              {Number(portionsCible) > 0 && (
                <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                  {composition.map((l) => {
                    const ing = indexIngredient.get(l.ingredient_id)
                    if (!ing) return null
                    const qScale = l.quantite * facteurScale
                    return (
                      <li
                        key={l.uid}
                        className="flex items-baseline justify-between gap-3 rounded-xl bg-cream/60 px-3 py-2"
                      >
                        <span className="text-warm-brown truncate">
                          {ing.nom}
                        </span>
                        <span className="font-medium text-warm-brown tabular-nums whitespace-nowrap">
                          {qScale.toLocaleString('fr-CH', {
                            maximumFractionDigits: 3,
                          })}{' '}
                          {UNITE_LABELS[l.unite]}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-2 text-xs text-warm-brown/60">
                💡 Cet aperçu sert à préparer une commande de taille différente.
                Il ne modifie pas la recette de base.
              </p>
            </div>
          )}
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
                Recette active
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
                Favori
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

        {/* Suppression */}
        <section className="card border-alert-red/30 bg-alert-red/5">
          <h2 className="font-serif text-xl mb-2 text-alert-red">
            Zone dangereuse
          </h2>
          <p className="text-sm text-warm-brown/70 mb-4">
            La suppression est définitive.
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
              Supprimer la recette
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
          <Link to="/recettes" className="btn-secondary">
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
