import { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { Package, Truck, CheckCheck, Clock, ArrowLeft } from 'lucide-react'

export default function TrackingView() {
  const { session_id, setScreen } = useStore()
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await api.trackOrder(session_id)
        setStatus(data)
      } catch (e) {
        console.error(e)
      }
    }
    poll()
    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
  }, [session_id])

  if (!status) {
    return (
      <div className="flex items-center justify-center mt-20">
        <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    )
  }

  const steps = [
    { id: 'placed',    label: 'Ordered',          done: true },
    { id: 'packed',    label: 'Packed',           done: ['Being Packed', 'Out for Delivery', 'Delivered'].includes(status.status) },
    { id: 'delivery',  label: 'On the way',       done: ['Out for Delivery', 'Delivered'].includes(status.status) },
    { id: 'delivered', label: 'Delivered',        done: status.status === 'Delivered' },
  ]

  return (
    <div className="max-w-md mx-auto mt-10 animate-fade-in">
      {/* Confirmation */}
      <div className="swiggy-card p-8 text-center mb-4">
        <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCheck className="w-8 h-8 text-green-600" />
        </div>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Order Placed</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Order ID: <span className="font-mono font-medium text-[var(--text-primary)]">{status.orderId || 'mock_order_123'}</span>
        </p>

        {/* Timeline */}
        <div className="flex items-center justify-between px-2 mb-6">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${
                  step.done ? 'bg-[var(--accent)]' : 'bg-sand-200'
                }`} />
                <p className={`text-[10px] mt-1.5 w-16 text-center leading-tight ${
                  step.done ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'
                }`}>
                  {step.label}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-0.5 w-8 -mt-4 mx-1 transition-all duration-500 ${
                  step.done ? 'bg-[var(--accent)]' : 'bg-sand-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* ETA */}
        {status.eta_minutes && (
          <div className="bg-sand-50 border border-sand-100 rounded-xl p-4 flex items-center justify-center gap-3">
            <Clock className="w-5 h-5 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Arriving in ~{status.eta_minutes} minutes
              </p>
              <p className="text-xs text-[var(--text-muted)]">Delivery on the way</p>
            </div>
          </div>
        )}
      </div>

      {/* Prep CTA */}
      <div className="swiggy-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-sand-100 rounded-xl flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div className="flex-grow">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Prep while you wait</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Get your cutting board ready.</p>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => useStore.getState().reset()}
        className="w-full mt-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-2 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Cook another recipe
      </button>
    </div>
  )
}
