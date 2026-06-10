import { useRef, useState } from 'react'
import {
  Camera,
  ImagePlus,
  Loader2,
  Trash2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Star,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const BUCKET = 'recettes-photos'
const MAX_DIM = 1200
const JPEG_QUALITY = 0.8
const MAX_PHOTOS = 10

interface PhotoUploadProps {
  /** Liste des URL publiques actuelles (1ère = vignette / photo principale) */
  value: string[]
  /** Callback à chaque ajout / suppression / réordonnancement */
  onChange: (urls: string[]) => void
  /** Désactive les interactions */
  disabled?: boolean
  /** Label affiché au-dessus */
  label?: string
}

/**
 * Upload multi-photos (jusqu'à MAX_PHOTOS).
 * - Compression côté client (max 1200 px, JPEG 80 %).
 * - Sélection multiple ou caméra (mobile : choix natif).
 * - 1ère photo = vignette ; bouton pour la promouvoir.
 * - Suppression individuelle (nettoie aussi le bucket Supabase Storage).
 */
export default function PhotoUpload({
  value,
  onChange,
  disabled = false,
  label = 'Photos',
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const photos = value ?? []
  const atteintMax = photos.length >= MAX_PHOTOS

  const declenchePicker = () => {
    if (disabled || uploading || atteintMax) return
    setErreur(null)
    fileInputRef.current?.click()
  }

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const placeRestante = MAX_PHOTOS - photos.length
    const aTraiter = files.slice(0, placeRestante)
    if (aTraiter.length < files.length) {
      setErreur(`Limite : ${MAX_PHOTOS} photos max. Les autres ont été ignorées.`)
    } else {
      setErreur(null)
    }

    setUploading(true)
    const ajoutees: string[] = []
    try {
      for (const file of aTraiter) {
        try {
          const compressed = await compresseImage(file)
          const nom = `${cryptoRandomId()}.jpg`
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(nom, compressed, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false,
            })
          if (upErr) throw upErr
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(nom)
          ajoutees.push(data.publicUrl)
        } catch (e) {
          const msg = (e as Error)?.message ?? 'Erreur inconnue'
          setErreur(`Upload partiel : ${msg}`)
        }
      }
      if (ajoutees.length > 0) {
        onChange([...photos, ...ajoutees])
      }
    } finally {
      setUploading(false)
    }
  }

  const supprimerPhoto = async (index: number) => {
    if (disabled || uploading) return
    const url = photos[index]
    if (!url) return
    setErreur(null)
    setUploading(true)
    try {
      const path = extractPath(url)
      if (path) {
        await supabase.storage.from(BUCKET).remove([path])
      }
      const next = photos.filter((_, i) => i !== index)
      onChange(next)
    } catch (e) {
      const msg = (e as Error)?.message ?? 'Erreur inconnue'
      setErreur(`Suppression impossible : ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const deplacer = (from: number, to: number) => {
    if (disabled || uploading) return
    if (to < 0 || to >= photos.length) return
    const next = [...photos]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const promouvoir = (index: number) => deplacer(index, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-warm-brown/80">
          {label}
          {photos.length > 0 && (
            <span className="text-warm-brown/50 ml-2">
              {photos.length} / {MAX_PHOTOS}
            </span>
          )}
        </span>
        {photos.length > 0 && (
          <span className="text-xs text-warm-brown/50">
            La 1ʳᵉ sert de vignette
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="sr-only"
        disabled={disabled || uploading || atteintMax}
      />

      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <figure
                key={url}
                className="relative group rounded-2xl overflow-hidden bg-soft-taupe/30 border border-soft-taupe/40"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="block w-full aspect-square object-cover"
                  loading="lazy"
                />
                {i === 0 && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-warm-brown/85 text-cream text-[10px] px-2 py-0.5 font-medium">
                    <Star
                      className="h-3 w-3 fill-caramel text-caramel"
                      aria-hidden="true"
                    />
                    Principale
                  </span>
                )}
                <figcaption className="absolute inset-x-0 bottom-0 flex justify-between gap-1 p-1.5 bg-gradient-to-t from-black/55 via-black/25 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  <div className="flex gap-1">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => deplacer(i, i - 1)}
                        disabled={disabled || uploading}
                        title="Déplacer à gauche"
                        aria-label="Déplacer à gauche"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/85 hover:bg-white text-warm-brown disabled:opacity-50"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    {i < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => deplacer(i, i + 1)}
                        disabled={disabled || uploading}
                        title="Déplacer à droite"
                        aria-label="Déplacer à droite"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/85 hover:bg-white text-warm-brown disabled:opacity-50"
                      >
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => promouvoir(i)}
                        disabled={disabled || uploading}
                        title="Définir comme vignette"
                        aria-label="Définir comme vignette"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/85 hover:bg-white text-warm-brown disabled:opacity-50"
                      >
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => supprimerPhoto(i)}
                      disabled={disabled || uploading}
                      title="Supprimer"
                      aria-label="Supprimer la photo"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-alert-red/95 hover:bg-alert-red text-cream disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}

            {!atteintMax && (
              <button
                type="button"
                onClick={declenchePicker}
                disabled={disabled || uploading}
                className="aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-soft-taupe/70 bg-cream/40 hover:bg-soft-taupe/30 text-warm-brown/70 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                    <span className="text-xs px-2 text-center">
                      Ajouter
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {atteintMax && (
            <p className="text-xs text-warm-brown/60">
              Limite atteinte ({MAX_PHOTOS} photos).
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={declenchePicker}
          disabled={disabled || uploading}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-10 rounded-2xl border-2 border-dashed border-soft-taupe/70 bg-cream/40 hover:bg-soft-taupe/30 transition disabled:opacity-60 disabled:cursor-not-allowed text-warm-brown/70"
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              <span className="text-sm">Compression et upload…</span>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm">Ajouter une ou plusieurs photos</span>
              <span className="text-xs text-warm-brown/50">
                Caméra ou galerie · max 1200 px · jusqu'à {MAX_PHOTOS}
              </span>
            </>
          )}
        </button>
      )}

      {erreur && (
        <div
          role="alert"
          className="mt-3 rounded-2xl bg-alert-red/10 border border-alert-red/30 px-3 py-2 text-sm text-alert-red flex items-start gap-2"
        >
          <AlertCircle
            className="h-4 w-4 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>{erreur}</div>
        </div>
      )}
    </div>
  )
}

// ----------- Helpers -----------

async function compresseImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await chargeImage(url)
    const { width, height } = scaleDown(img.naturalWidth, img.naturalHeight, MAX_DIM)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D non disponible.')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) throw new Error('Compression échouée.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function chargeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible.'))
    img.src = src
  })
}

function scaleDown(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w >= h ? max / w : max / h
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

function extractPath(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
