import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Loader2,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Client } from '../lib/types'

export default function Clients() {
  const [recherche, setRecherche] = useState('')

  const { data, isLoading, error } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('nom', { ascending: true })
        .limit(500)
      if (error) throw error
      return (data ?? []) as Client[]
    },
  })

  const clientsFiltres = useMemo(() => {
    if (!data) return []
    const recLower = recherche.trim().toLowerCase()
    if (!recLower) return data
    return data.filter((c) => {
      const nom = (c.nom ?? '').toLowerCase()
      const tel = (c.telephone ?? '').toLowerCase()
      const email = (c.email ?? '').toLowerCase()
      const ville = (c.ville ?? '').toLowerCase()
      return (
        nom.includes(recLower) ||
        tel.includes(recLower) ||
        email.includes(recLower) ||
        ville.includes(recLower)
      )
    })
  }, [data, recherche])

  return (
    <div>
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
            Clients
          </h1>
          <p className="mt-1 text-warm-brown/70">
            {data ? `${data.length} client${data.length > 1 ? 's' : ''}` : '…'}
          </p>
        </div>
        <Link
          to="/clients/nouveau"
          className="btn-primary"
          aria-label="Nouveau client"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nouveau</span>
        </Link>
      </header>

      {/* Recherche */}
      <div className="relative mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-warm-brown/50"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher par nom, téléphone, email ou ville…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="input-field pl-10"
          aria-label="Rechercher un client"
        />
      </div>

      {/* Contenu */}
      {isLoading && (
        <div className="card flex items-center justify-center py-14 text-warm-brown/60">
          <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
          Chargement…
        </div>
      )}

      {error && (
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
              Impossible de charger les clients
            </p>
            <p className="text-sm text-warm-brown/70 mt-1">
              {(error as Error).message}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && clientsFiltres.length === 0 && (
        <EtatVide rechercheActive={recherche.length > 0} />
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {clientsFiltres.map((c) => (
          <li key={c.id}>
            <Link
              to={`/clients/${c.id}`}
              className="block card hover:shadow-md transition p-5 focus:outline-none focus:ring-2 focus:ring-dusty-pink/50"
            >
              <h2 className="font-serif text-lg sm:text-xl leading-tight truncate mb-2">
                {c.nom}
              </h2>
              <dl className="grid gap-1.5 text-sm text-warm-brown/80">
                {c.telephone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Téléphone</dt>
                    <dd className="truncate">{c.telephone}</dd>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">{c.email}</dd>
                  </div>
                )}
                {(c.ville || c.code_postal) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin
                      className="h-4 w-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <dt className="sr-only">Ville</dt>
                    <dd className="truncate">
                      {[c.code_postal, c.ville].filter(Boolean).join(' ')}
                    </dd>
                  </div>
                )}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EtatVide({ rechercheActive }: { rechercheActive: boolean }) {
  if (rechercheActive) {
    return (
      <div className="card text-center py-14">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-soft-taupe/30 text-3xl mb-4 mx-auto"
        >
          🔍
        </div>
        <p className="text-warm-brown/70">
          Aucun client ne correspond à ta recherche.
        </p>
      </div>
    )
  }
  return (
    <div className="card flex flex-col items-center text-center py-14">
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-dusty-pink/15 text-5xl mb-6"
      >
        💌
      </div>
      <h2 className="font-serif text-2xl mb-2">Aucun client pour l'instant</h2>
      <p className="text-warm-brown/60 max-w-sm mb-6">
        Ajoute ton premier client pour pouvoir lui associer des commandes.
      </p>
      <Link to="/clients/nouveau" className="btn-primary">
        <Plus className="h-5 w-5" aria-hidden="true" />
        Nouveau client
      </Link>
    </div>
  )
}
