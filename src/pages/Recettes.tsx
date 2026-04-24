import { Plus } from 'lucide-react'

export default function Recettes() {
  return (
    <div>
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Recettes
        </h1>
        <button
          type="button"
          className="btn-primary"
          aria-label="Nouvelle recette"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouvelle recette</span>
        </button>
      </header>

      <div className="card flex flex-col items-center text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-caramel/20 text-5xl mb-6"
        >
          📖
        </div>
        <h2 className="font-serif text-2xl mb-2">
          Aucune recette pour l'instant
        </h2>
        <p className="text-warm-brown/60 max-w-sm">
          Ajoute tes recettes pour calculer tes coûts de revient.
        </p>
      </div>
    </div>
  )
}
