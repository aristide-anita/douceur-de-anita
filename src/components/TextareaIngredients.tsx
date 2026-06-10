import { useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Sprout } from 'lucide-react'
import type { Ingredient, UniteIngredient } from '../lib/types'
import { UNITE_LABELS } from '../lib/types'

interface LigneCompoMin {
  ingredient_id: string
  quantite: number
  unite: UniteIngredient
}

interface Props {
  value: string
  onChange: (v: string) => void
  ingredients: Ingredient[]
  composition?: LigneCompoMin[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
  /** id pour assoc avec un <label> externe */
  id?: string
}

function formaterQuantite(n: number, unite: UniteIngredient): string {
  const arr =
    n >= 100
      ? n.toLocaleString('fr-CH', { maximumFractionDigits: 0 })
      : n.toLocaleString('fr-CH', { maximumFractionDigits: 3 })
  return `${arr} ${UNITE_LABELS[unite]}`
}

/**
 * Textarea enrichie : tape "@" pour ouvrir une liste filtrée d'ingrédients.
 * Sélection → insère le nom (ou la quantité issue de la composition).
 *
 * Stockage : texte brut. Aucun marquage spécial.
 */
export default function TextareaIngredients({
  value,
  onChange,
  ingredients,
  composition = [],
  placeholder,
  rows = 6,
  className,
  disabled,
  id,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pickerOuvert, setPickerOuvert] = useState(false)
  /** Position du @ dans la valeur (index dans value). */
  const [debutMention, setDebutMention] = useState<number | null>(null)
  const [filtre, setFiltre] = useState('')
  const [indexSelectionne, setIndexSelectionne] = useState(0)

  const compoMap = useMemo(() => {
    const m = new Map<string, LigneCompoMin>()
    for (const l of composition) m.set(l.ingredient_id, l)
    return m
  }, [composition])

  const liste = useMemo(() => {
    const f = filtre.toLowerCase().trim()
    const triés = [...ingredients].sort((a, b) => {
      const aCompo = compoMap.has(a.id)
      const bCompo = compoMap.has(b.id)
      if (aCompo !== bCompo) return aCompo ? -1 : 1
      return a.nom.localeCompare(b.nom)
    })
    if (!f) return triés.slice(0, 8)
    return triés.filter((i) => i.nom.toLowerCase().includes(f)).slice(0, 8)
  }, [ingredients, filtre, compoMap])

  const fermerPicker = () => {
    setPickerOuvert(false)
    setDebutMention(null)
    setFiltre('')
    setIndexSelectionne(0)
  }

  const inserer = (ing: Ingredient, avecQuantite: boolean) => {
    const ta = textareaRef.current
    if (!ta) return

    const ligneCompo = compoMap.get(ing.id)
    let texteInsert: string
    if (avecQuantite && ligneCompo) {
      texteInsert = `${formaterQuantite(ligneCompo.quantite, ligneCompo.unite)} de ${ing.nom}`
    } else {
      texteInsert = ing.nom
    }

    const debut = debutMention ?? ta.selectionStart
    const fin = ta.selectionStart
    const avant = value.slice(0, debut)
    const apres = value.slice(fin)
    const next = `${avant}${texteInsert}${apres}`
    onChange(next)

    // Replace le curseur après le texte inséré
    requestAnimationFrame(() => {
      const newPos = debut + texteInsert.length
      ta.focus()
      ta.setSelectionRange(newPos, newPos)
    })
    fermerPicker()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return

    if (pickerOuvert) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndexSelectionne((i) => Math.min(i + 1, liste.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndexSelectionne((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        const choix = liste[indexSelectionne]
        if (choix) {
          e.preventDefault()
          const ligneCompo = compoMap.get(choix.id)
          inserer(choix, !!ligneCompo)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        fermerPicker()
        return
      }
    } else if (e.key === '@') {
      // On capture la position avant le caractère @ pour pouvoir le retirer ensuite
      const ta = textareaRef.current
      if (ta) {
        setDebutMention(ta.selectionStart)
        setFiltre('')
        setIndexSelectionne(0)
        // On laisse @ s'insérer, puis on ouvre le picker
        setTimeout(() => setPickerOuvert(true), 0)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    onChange(v)

    if (pickerOuvert && debutMention !== null) {
      const ta = e.target
      const cursorPos = ta.selectionStart
      // Récupère le texte entre @ et le curseur
      if (cursorPos > debutMention) {
        const portion = v.slice(debutMention + 1, cursorPos)
        // Si on a tapé un espace ou un retour ligne, on ferme
        if (/[\s\n]/.test(portion)) {
          fermerPicker()
          return
        }
        setFiltre(portion)
        setIndexSelectionne(0)
      } else {
        // On est revenu avant le @
        fermerPicker()
      }
    }
  }

  // Ferme le picker au click extérieur
  const conteneurRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pickerOuvert) return
    const handler = (e: MouseEvent) => {
      if (
        conteneurRef.current &&
        !conteneurRef.current.contains(e.target as Node)
      ) {
        fermerPicker()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOuvert])

  return (
    <div ref={conteneurRef} className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={
          className ?? 'input-field min-h-[10rem] resize-y w-full'
        }
        disabled={disabled}
      />

      <div className="mt-1 flex items-center gap-2 text-xs text-warm-brown/50">
        <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Tape <kbd className="px-1 py-0.5 rounded bg-soft-taupe/40 text-warm-brown text-[10px]">@</kbd>{' '}
          pour insérer un ingrédient depuis ta base
        </span>
      </div>

      {pickerOuvert && liste.length > 0 && (
        <div
          role="listbox"
          aria-label="Ingrédients suggérés"
          className="absolute z-30 mt-1 w-full max-w-md rounded-2xl border border-soft-taupe/70 bg-cream shadow-soft overflow-hidden"
        >
          {filtre && (
            <div className="px-3 py-2 text-xs text-warm-brown/50 border-b border-soft-taupe/40">
              Filtre :{' '}
              <span className="text-warm-brown font-medium">{filtre}</span>
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto">
            {liste.map((ing, i) => {
              const ligneCompo = compoMap.get(ing.id)
              const actif = i === indexSelectionne
              return (
                <li key={ing.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={actif}
                    onClick={() => inserer(ing, false)}
                    onMouseEnter={() => setIndexSelectionne(i)}
                    className={
                      'w-full text-left px-3 py-2 flex items-center justify-between gap-3 ' +
                      (actif
                        ? 'bg-dusty-pink/15 text-warm-brown'
                        : 'text-warm-brown hover:bg-soft-taupe/30')
                    }
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {ligneCompo && (
                        <Sprout
                          className="h-3.5 w-3.5 text-emerald-700 flex-shrink-0"
                          aria-label="Dans la composition"
                        />
                      )}
                      <span className="truncate">{ing.nom}</span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {ligneCompo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            inserer(ing, true)
                          }}
                          className="text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 hover:bg-emerald-200"
                        >
                          + {formaterQuantite(ligneCompo.quantite, ligneCompo.unite)}
                        </button>
                      )}
                      <span className="text-xs text-warm-brown/50 whitespace-nowrap">
                        {UNITE_LABELS[ing.unite_achat]}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="px-3 py-1.5 text-[10px] text-warm-brown/50 border-t border-soft-taupe/40 bg-cream/60">
            ↑↓ pour naviguer · Entrée pour valider · Échap pour fermer
          </div>
        </div>
      )}

      {pickerOuvert && liste.length === 0 && (
        <div className="absolute z-30 mt-1 w-full max-w-md rounded-2xl border border-soft-taupe/70 bg-cream shadow-soft px-4 py-3 text-sm text-warm-brown/70">
          Aucun ingrédient ne correspond à « {filtre} ».
        </div>
      )}
    </div>
  )
}
