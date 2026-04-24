import { Plus } from 'lucide-react'

export default function Finances() {
  return (
    <div>
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Finances
        </h1>
        <button
          type="button"
          className="btn-primary"
          aria-label="Nouvelle dépense"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouvelle dépense</span>
        </button>
      </header>

      <div className="card flex flex-col items-center text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-success-green/20 text-5xl mb-6"
        >
          💰
        </div>
        <h2 className="font-serif text-2xl mb-2">
          Aucune dépense enregistrée
        </h2>
        <p className="text-warm-brown/60 max-w-sm">
          Enregistre tes dépenses pour suivre ta rentabilité.
        </p>
      </div>
    </div>
  )
}
