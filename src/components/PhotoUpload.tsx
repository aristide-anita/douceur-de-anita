import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const BUCKET = 'recettes-photos'
const MAX_DIM = 1200
const JPEG_QUALITY = 0.8

interface PhotoUploadProps {
  /** URL publique actuelle de la photo (null = pas de photo) */
  value: string | null
  /** Callback quand une photo est uploadee ou supprimee */
  onChange: (url: string | null) => void
  /** Desactive les interactions (pendant un autre submit, par ex.) */
  disabled?: boolean
  /** Label affiche au-dessus (defaut: "Photo") */
  label?: string
}

/**
 * Composant d'upload photo.
 * - Sur mobile : ouvre caméra OU galerie via le picker natif
 * - Compresse l'image côté client (max 1200px, JPEG 80%)
 * - Upload vers Supabase Storage bucket "recettes-photos"
 * - Quand on remplace : supprime l'ancienne photo du Storage
 */
export default function PhotoUpload({
  value,
  onChange,
  disabled = false,
  label = 'Photo',
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const declenchePicker = () => {
    if (disabled || uploading) return
    setErreur(null)
    fileInputRef.current?.click()
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset l'input pour permettre de re-uploader le meme fichier
    event.target.value = ''
    if (!file) return

    setErreur(null)
    setUploading(true)

    try {
      // 1. Compression cote client
      const compressed = await compresseImage(file)

      // 2. Genere un nom de fichier unique
      const ext = 'jpg'
      const nom = `${cryptoRandomId()}.${ext}`

      // 3. Upload
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(nom, compressed, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })
      if (upErr) throw upErr

      // 4. Recupere l'URL publique
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nom)
      const newUrl = data.publicUrl

      // 5. Si on remplace, supprime l'ancienne
      if (value) {
        const oldPath = extractPath(value)
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath])
        }
      }

      onChange(newUrl)
    } catch (e) {
      const msg = (e as Error)?.message ?? 'Erreur inconnue'
      setErreur(`Upload impossible : ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!value || disabled || uploading) return
    setErreur(null)
    setUploading(true)
    try {
      const path = extractPath(value)
      if (path) {
        await supabase.storage.from(BUCKET).remove([path])
      }
      onChange(null)
    } catch (e) {
      const msg = (e as Error)?.message ?? 'Erreur inconnue'
      setErreur(`Suppression impossible : ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <span className="text-sm text-warm-brown/80 mb-1.5 inline-block">
        {label}
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="sr-only"
        disabled={disabled || uploading}
      />

      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Photo de la recette"
            className="w-full max-h-72 object-cover rounded-2xl bg-soft-taupe/30"
            loading="lazy"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={declenchePicker}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-cream/80 hover:bg-soft-taupe/40 px-3 py-2 text-sm font-medium text-warm-brown border border-soft-taupe/60 disabled:opacity-60 disabled:cursor-not-allowed min-h-[40px]"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-4 w-4" aria-hidden="true" />
              )}
              Remplacer
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-alert-red/10 hover:bg-alert-red/20 px-3 py-2 text-sm font-medium text-alert-red disabled:opacity-60 disabled:cursor-not-allowed min-h-[40px]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </button>
          </div>
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
              <ImagePlus className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm">Ajouter une photo</span>
              <span className="text-xs text-warm-brown/50">
                Camera ou galerie · max 1200 px
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

/**
 * Charge un File image, le redimensionne en max MAX_DIM à cote long,
 * et le ressort en JPEG à JPEG_QUALITY de qualite.
 */
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
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  }
}

/**
 * Extrait le chemin (ex: "abc-123.jpg") d'une URL publique Supabase Storage.
 * Format: https://<projet>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
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
  // Fallback : timestamp + random
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
