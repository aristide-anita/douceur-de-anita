import { Plus } from 'lucide-react'

export default function Clients() {
  return (
    <div>
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Clients
        </h1>
        <button
          type="button"
          className="btn-primary"
          aria-label="Nouveau client"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouveau client</span>
        </button>
      </header>

      <div className="card flex flex-col items-center text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-soft-taupe text-5xl mb-6"
        >
          👥
        </div>
        <h2 className="font-serif text-2xl mb-2">
          Aucun client pour l'instant
        </h2>
        <p className="text-warm-brown/60 max-w-sm">
          Ajoute tes clients pour retrouver leurs coordonnées et historique.
        </p>
      </div>
    </div>
  )
}
