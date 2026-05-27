'use client'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Check, User, UtensilsCrossed, AlertCircle, RefreshCw } from 'lucide-react'
import { getDialogue } from '../lib/hindi-dialogues'

export default function GuestView({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [dialogue, setDialogue] = useState<{ text: string; movie: string; emoji: string } | null>(null)

  const fetchSession = async () => {
    try {
      const data = await api.getSession(sessionId)
      if (data.status === 'success') {
        setSessionData(data)
      } else {
        setError('Session not found or expired.')
      }
    } catch (err: any) {
      setError('Could not connect to the Host room session.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setDialogue(getDialogue('group'))
    fetchSession()
    const interval = setInterval(fetchSession, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  const handleApprove = async () => {
    setApproving(true)
    try {
      await api.approveContributor(sessionId, userId, true)
      await fetchSession()
    } catch (err) {
      console.error(err)
      setError('Failed to submit roommate approval.')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-9 h-9 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-xs text-[var(--text-muted)] font-semibold">Joining HostelSync session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="bg-red-50 border border-red-100 text-red-800 p-5 rounded-3xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-extrabold text-sm">Connection Failed</h3>
            <p className="text-xs text-red-700/90 mt-1 leading-relaxed">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95">
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionData) return null

  // Calculate totals
  const buyableItems = sessionData.cart_items?.filter((i: any) => i.spin_id && (i.user_category === 'more_wanted' || i.user_category === 'less_wanted')) || []
  const total = buyableItems.reduce((sum: number, i: any) => sum + (i.product_price * (i.quantity || 1)), 0)

  const me = sessionData.contributors?.find((c: any) => c.user_id === userId)
  
  if (!me) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4 text-center">
        <div className="bg-stone-50 border border-stone-200 p-8 rounded-3xl">
          <p className="text-sm font-bold text-[var(--text-secondary)]">Invite Expired or Invalid</p>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
            You are not listed in this HostelSync order room. Ask the host room owner to add you as "{userId}".
          </p>
        </div>
      </div>
    )
  }

  const myShare = Math.round(total * me.fraction_owed)

  return (
    <div className="max-w-md mx-auto px-4 mt-8 animate-fade-up">
      {/* Header dialogue */}
      {dialogue && (
        <div className="hindi-banner mb-6 text-left flex items-center gap-3">
          <span className="text-2xl">{dialogue.emoji}</span>
          <div>
            <p className="font-semibold text-orange-950">"{dialogue.text}"</p>
            <p className="text-[10px] text-orange-800/60 mt-0.5">— {dialogue.movie}</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-6 shadow-sm mb-6">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-50 text-[var(--accent)] rounded-2xl mb-4 border border-orange-100">
          <UtensilsCrossed className="w-5.5 h-5.5" />
        </div>
        <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">HostelSync Order Split</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Approve your share of the roommate grocery order</p>

        {/* Bill Info */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-4 mt-6">
          <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            <span>Total Cart Value</span>
            <span>₹{total}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
            <span className="text-sm font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <User className="w-4 h-4 text-orange-500" /> Your Share (Equal Split)
            </span>
            <span className="font-black text-2xl text-[var(--accent)]">₹{myShare}</span>
          </div>
        </div>

        {/* Approval CTA */}
        <div className="mt-6">
          {me.approval_status ? (
            <div className="bg-green-50/50 border border-green-200 text-green-900 font-bold p-5 rounded-2xl text-center flex flex-col items-center gap-3">
              <div className="w-9 h-9 bg-green-500 text-white rounded-full flex items-center justify-center shadow-md shadow-green-500/10">
                <Check className="w-5.5 h-5.5 stroke-[3]" />
              </div>
              <div>
                <p className="text-sm">You approved this order!</p>
                <p className="text-[10px] text-green-800/80 font-normal mt-0.5">Wait for host roommate to place the checkout order.</p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving || buyableItems.length === 0}
              className="w-full btn-primary py-4 rounded-2xl font-extrabold shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              {approving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Approve Share & Order (₹{myShare})</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Participants status list */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-5 shadow-sm">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3.5 px-1">Roommates Approvals</h3>
        <div className="space-y-2">
          {sessionData.contributors?.map((c: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                {c.user_id === 'primary' ? 'Host Roommate' : c.user_id} {c.user_id === userId && '(You)'}
              </span>
              {c.approval_status ? (
                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Approved
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                  Awaiting
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
