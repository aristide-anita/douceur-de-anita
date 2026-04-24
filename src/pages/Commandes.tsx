import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function Commandes() {
  return (
    <div>
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Commandes
        </h1>
        <Link to="/commandes/nouvelle" className="btn-primary">
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouvelle commande</span>
          <span className="sm:hidden sr-only">Nouvelle commande</span>
        </Link>
      </header>

      <EmptyState
        emoji="🍰"
        title="Aucune commande pour l'instant"
        subtitle="Commence par ajouter ta première commande."
        cta={
          <Link to="/commandes/nouvelle" className="btn-primary">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Nouvelle commande
          </Link>
        }
      />
    </div>
  )
}

interface EmptyStateProps {
  emoji: string
  title: string
  subtitle: string
  cta?: React.ReactNode
}

function EmptyState({ emoji, title, subtitle, cta }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center text-center py-14">
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-dusty-pink/15 text-5xl mb-6"
      >
        {emoji}
      </div>
      <h2 className="font-serif text-2xl mb-2">{title}</h2>
      <p className="text-warm-brown/60 max-w-sm">{subtitle}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  )
}
