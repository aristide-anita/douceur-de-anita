import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarDays, CreditCard, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  const prenom =
    (user?.user_metadata?.prenom as string | undefined) ??
    (user?.user_metadata?.first_name as string | undefined) ??
    (user?.email ? user.email.split('@')[0] : 'Anita')

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          Bonjour, {capitalize(prenom)}
        </h1>
        <p className="mt-1 text-warm-brown/70 capitalize">{today}</p>
      </header>

      <section
        aria-label="Aperçu"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <DashboardCard
          title="À préparer cette semaine"
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          tone="pink"
        />
        <DashboardCard
          title="Impayés"
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
          tone="taupe"
        />
        <DashboardCard
          title="Ce mois-ci"
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          tone="caramel"
        />
      </section>
    </div>
  )
}

interface DashboardCardProps {
  title: string
  icon: React.ReactNode
  tone: 'pink' | 'taupe' | 'caramel'
}

function DashboardCard({ title, icon, tone }: DashboardCardProps) {
  const toneClasses: Record<DashboardCardProps['tone'], string> = {
    pink: 'bg-dusty-pink/15',
    taupe: 'bg-soft-taupe/70',
    caramel: 'bg-caramel/20',
  }

  return (
    <article className="card">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-2xl text-warm-brown ${toneClasses[tone]}`}
        >
          {icon}
        </div>
        <h2 className="font-serif text-lg">{title}</h2>
      </div>
      <p className="mt-4 text-sm text-warm-brown/60">
        Aucune donnée pour l'instant.
      </p>
    </article>
  )
}

function capitalize(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
