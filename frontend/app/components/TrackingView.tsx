'use client'
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { api } from '../../lib/api'
import { 
  Package, 
  Truck, 
  CheckCheck, 
  Clock, 
  ArrowLeft, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  UtensilsCrossed, 
  Smile 
} from 'lucide-react'
import { getDialogue } from '../lib/hindi-dialogues'
import { motion } from 'framer-motion'

export default function TrackingView() {
  const { session_id, setScreen, reset } = useStore()
  const [status, setStatus] = useState<any>(null)
  const [dialogue, setDialogue] = useState<{ text: string; movie: string; emoji: string } | null>(null)

  useEffect(() => {
    setDialogue(getDialogue('tracking'))
  }, [])

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
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [session_id])

  if (!status) {
    return (
      <div className="flex items-center justify-center mt-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-muted)] font-semibold">Locating delivery partner...</p>
        </div>
      </div>
    )
  }

  const steps = [
    { id: 'placed',    label: 'Ordered',          done: true },
    { id: 'packed',    label: 'Packed',           done: ['Being Packed', 'Out for Delivery', 'Delivered'].includes(status.status) },
    { id: 'delivery',  label: 'Out for Delivery', done: ['Out for Delivery', 'Delivered'].includes(status.status) },
    { id: 'delivered', label: 'Delivered',        done: status.status === 'Delivered' },
  ]

  // Mock driver details
  const driver = {
    name: "Ramesh Kumar",
    phone: "+91 98765 43210",
    rating: "4.9",
    vehicle: "Splendor (KA-01-EF-4567)"
  }

  return (
    <div className="max-w-xl mx-auto px-4 mt-6 animate-fade-up">
      {/* Dialogue Banner */}
      {dialogue && (
        <div className="hindi-banner mb-6 text-left flex items-center gap-3">
          <span className="text-2xl">{dialogue.emoji}</span>
          <div>
            <p className="font-semibold text-orange-950">"{dialogue.text}"</p>
            <p className="text-[10px] text-orange-800/60 mt-0.5">— {dialogue.movie}</p>
          </div>
        </div>
      )}

      {/* Confirmation Card */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center border border-green-100 shrink-0">
            <CheckCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Order Confirmed!</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Order ID: <span className="font-mono font-bold text-[var(--text-primary)]">{status.orderId || 'mock_order_123'}</span>
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative flex justify-between mb-8 px-2">
          {/* Progress bar background line */}
          <div className="absolute top-2.5 left-6 right-6 h-0.5 bg-stone-100 -z-10" />
          
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                step.done 
                  ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20' 
                  : 'bg-white border-stone-200 text-stone-300'
              }`}>
                {step.done && <CheckCheck className="w-3 h-3 stroke-[2.5]" />}
              </div>
              <p className={`text-[10px] mt-2 font-bold max-w-[70px] text-center leading-tight ${
                step.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>

        {/* ETA */}
        {status.eta_minutes && (
          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-[var(--text-primary)]">
                Arriving in ~{status.eta_minutes} mins
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Rider is picking up your items</p>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Map Mockup */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-5 shadow-sm mb-6 overflow-hidden">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-orange-500" /> Live Tracking
        </h3>
        
        {/* Animated Map Box */}
        <div className="relative h-44 bg-amber-50/40 rounded-2xl border border-stone-100 overflow-hidden flex items-center justify-center">
          {/* Simulated Map Background Grid Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          {/* Route path */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M 50,120 Q 150,130 200,60 T 350,70" 
              fill="none" 
              stroke="#cbd5e1" 
              strokeWidth="4" 
              strokeLinecap="round" 
            />
            <path 
              d="M 50,120 Q 150,130 200,60 T 350,70" 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeDasharray="8 6"
              className="animate-[dash_2s_linear_infinite]"
            />
          </svg>

          {/* Store Pin */}
          <div className="absolute left-[50px] top-[120px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="bg-white px-2 py-1 rounded-md border border-stone-200 shadow-sm text-[9px] font-bold text-[var(--text-secondary)] mb-1">
              Instamart
            </div>
            <div className="w-5 h-5 bg-orange-600 rounded-full border-4 border-white shadow flex items-center justify-center" />
          </div>

          {/* Delivery Boy Icon moving */}
          <div className="absolute left-[200px] top-[60px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="bg-orange-500 text-white p-1 rounded-full shadow-md animate-bounce">
              <Truck className="w-3.5 h-3.5" />
            </div>
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping absolute top-4" />
          </div>

          {/* Home Pin */}
          <div className="absolute left-[350px] top-[70px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="bg-white px-2 py-1 rounded-md border border-stone-200 shadow-sm text-[9px] font-bold text-[var(--text-secondary)] mb-1">
              Home
            </div>
            <div className="w-5 h-5 bg-green-600 rounded-full border-4 border-white shadow flex items-center justify-center" />
          </div>
        </div>

        {/* Rider profile */}
        <div className="flex items-center justify-between border-t border-stone-100 pt-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 font-bold border border-stone-200">
              RK
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{driver.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{driver.vehicle} • ★ {driver.rating}</p>
            </div>
          </div>
          <a 
            href={`tel:${driver.phone}`} 
            className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3.5 py-2.5 rounded-xl border border-orange-100 transition active:scale-95 shadow-sm"
          >
            <Phone className="w-3.5 h-3.5" /> Call Rider
          </a>
        </div>
      </div>

      {/* Chef Tips Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border border-amber-100/50 p-5 shadow-sm flex items-start gap-4">
        <div className="w-11 h-11 bg-white text-orange-500 rounded-2xl flex items-center justify-center border border-amber-100 shrink-0 shadow-sm">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-orange-950">Prep while you wait!</h3>
          <p className="text-xs text-orange-900/80 leading-relaxed mt-0.5">
            Clean your cooking counter, grab your favorite pan, and keep cooking oil and salt ready. Your fresh ingredients are arriving shortly!
          </p>
        </div>
      </div>

      {/* Finish/Back button */}
      <div className="mt-8 text-center">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Cook another recipe
        </button>
      </div>
    </div>
  )
}
