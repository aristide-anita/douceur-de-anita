import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NouvelleCommande() {
  return (
    <div>
      <header className="mb-8">
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 text-sm text-warm-brown/70 hover:text-warm-brown mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux commandes
        </Link>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Nouvelle commande
        </h1>
        <p className="mt-1 text-warm-brown/70">
          Formulaire de création de commande à venir.
        </p>
      </header>

      <div className="card text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-dusty-pink/15 text-5xl mb-6 mx-auto"
        >
          🧁
        </div>
        <p className="text-warm-brown/60">Bientôt disponible.</p>
      </div>
    </div>
  )
}
