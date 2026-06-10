import { createContext, useCallback, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: string
  text: string
  type: ToastType
}

interface ToastContextValue {
  pousser: (text: string, type?: ToastType) => void
  succes: (text: string) => void
  erreur: (text: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast doit être utilisé dans un ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([])

  const pousser = useCallback((text: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    setItems((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const succes = useCallback((t: string) => pousser(t, 'success'), [pousser])
  const erreur = useCallback((t: string) => pousser(t, 'error'), [pousser])

  return (
    <ToastContext.Provider value={{ pousser, succes, erreur }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none print:hidden"
      >
        {items.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onClose={() =>
              setItems((prev) => prev.filter((x) => x.id !== t.id))
            }
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastMessage
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const styles =
    toast.type === 'success'
      ? 'bg-emerald-100 border-emerald-200 text-emerald-900'
      : toast.type === 'error'
        ? 'bg-alert-red/10 border-alert-red/30 text-alert-red'
        : 'bg-cream border-soft-taupe text-warm-brown'

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={[
        'pointer-events-auto rounded-2xl border px-4 py-3 shadow-soft flex items-start gap-2 text-sm font-medium transition-all',
        styles,
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4',
      ].join(' ')}
    >
      {toast.type === 'success' && (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {toast.type === 'error' && (
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <span className="flex-1">{toast.text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="text-current opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
