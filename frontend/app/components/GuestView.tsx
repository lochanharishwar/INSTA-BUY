'use client'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Check, User, Utensils } from 'lucide-react'

export default function GuestView({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')

  const fetchSession = async () => {
    try {
      const data = await api.getSession(sessionId)
      if (data.status === 'success') {
        setSessionData(data)
      } else {
        setError('Session not found.')
      }
    } catch (err: any) {
      setError('Could not connect to session.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
    // Poll for updates in case the cart changes
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
      setError('Failed to approve.')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <span className="w-8 h-8 border-4 border-gray-200 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center mt-20 text-red-500 font-medium">{error}</div>
    )
  }

  if (!sessionData) return null

  // Calculate totals
  const buyableItems = sessionData.cart_items?.filter((i: any) => i.spin_id) || []
  const total = buyableItems.reduce((sum: number, i: any) => sum + (i.product_price * (i.quantity || 1)), 0)

  const me = sessionData.contributors?.find((c: any) => c.user_id === userId)
  
  if (!me) {
    return (
      <div className="text-center mt-20 text-[var(--text-secondary)] font-medium">
        You are not invited to this group session.
      </div>
    )
  }

  const myShare = Math.round(total * me.fraction_owed)

  return (
    <div className="max-w-md mx-auto mt-10 p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm animate-fade-in">
      <div className="flex items-center justify-center w-12 h-12 bg-orange-50 text-[var(--accent)] rounded-2xl mx-auto mb-4">
        <Utensils className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold text-center text-[var(--text-primary)] mb-1 tracking-tight">HostelSync</h2>
      <p className="text-center text-sm text-[var(--text-muted)] mb-6">Group grocery order requested</p>

      <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Total Cart Value</span>
          <span className="font-bold text-[var(--text-primary)]">₹{total}</span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
          <span className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <User className="w-4 h-4" /> Your Share
          </span>
          <span className="font-bold text-xl text-[var(--accent)]">₹{myShare}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Participants</h3>
        {sessionData.contributors?.map((c: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {c.user_id === 'primary' ? 'Host' : c.user_id} {c.user_id === userId && '(You)'}
            </span>
            {c.approval_status ? (
              <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md">
                <Check className="w-3 h-3" /> Paid
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Pending</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        {me.approval_status ? (
          <div className="bg-green-50 border border-green-200 text-green-800 font-semibold p-4 rounded-xl text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            You're all set! Wait for the host to place the order.
          </div>
        ) : (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full bg-[var(--accent)] hover:bg-[#ea580c] text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {approving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Approve & Pay ₹{myShare}</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
