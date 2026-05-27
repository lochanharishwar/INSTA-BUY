'use client'
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { ChevronDown, ChevronUp, Leaf, AlertTriangle, ShoppingCart, ArrowRight, Info, Trash2, Copy, Check, PackageCheck, Link2 } from 'lucide-react'

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high:        { label: 'Great pick',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100' },
  medium:      { label: 'Good match',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  low:         { label: 'Okay match',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-100' },
  substitute:  { label: 'Substitute',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  unavailable: { label: 'Unavailable', color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-100' },
  pantry:      { label: 'In pantry',   color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
}

const DOT: Record<string, string> = {
  high: 'bg-green-500', medium: 'bg-amber-500', low: 'bg-red-500',
  substitute: 'bg-blue-500', unavailable: 'bg-gray-400', pantry: 'bg-indigo-500',
}

export default function CartReview() {
  const { session_id, cart_proposal, setScreen, session_type, contributors, setContributors } = useStore()
  const [items, setItems] = useState(cart_proposal?.cart_items || [])
  const [loading, setLoading] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedLinkFor, setCopiedLinkFor] = useState<string | null>(null)

  if (!cart_proposal) return null;

  const handleCopyList = async () => {
    const text = items
      .filter((i: any) => i.spin_id)
      .map((i: any) => `${i.ingredient_name} — ${i.product_name} (${i.product_quantity_display}) ₹${i.product_price}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const buyableItems = items.filter((i: any) => i.spin_id);
      await api.confirmCart(session_id, buyableItems);
      setScreen('tracking');
    } catch (err: any) {
      alert(err.message || 'Error placing order');
    } finally {
      setLoading(false);
    }
  }

  const buyableItems = items.filter((i: any) => i.spin_id);
  const pantryItems = items.filter((i: any) => i.confidence === 'pantry');
  const unavailableItems = items.filter((i: any) => i.confidence === 'unavailable');

  const total = buyableItems.reduce((sum: number, i: any) => sum + (i.product_price * (i.quantity || 1)), 0);
  const avgWaste = buyableItems.length > 0
    ? buyableItems.reduce((sum: number, i: any) => sum + (i.waste_pct || 0), 0) / buyableItems.length
    : 0;

  const wasteOptimized = buyableItems.filter((i: any) => i.waste_pct !== undefined && (i.waste_pct < 30)).length;
  const highWasteItems = buyableItems.filter((i: any) => (i.waste_pct || 0) > 50);
  return (
    <div className="pb-10 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 mt-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Your Cart</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {buyableItems.length} items ready from your recipe
          </p>
        </div>
        <button
          onClick={handleCopyList}
          className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] px-4 py-2.5 rounded-xl border border-[var(--border-color)] transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy list'}
        </button>
      </div>

      <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
        {/* Left Column */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            {[
              { label: 'Items', value: String(buyableItems.length) },
              { label: 'Total', value: `₹${total}` },
              { label: 'Waste', value: `${avgWaste.toFixed(0)}%`, color: avgWaste > 30 ? 'text-amber-500' : 'text-green-500' },
              { label: 'In Pantry', value: String(pantryItems.length), color: 'text-indigo-500' },
            ].map(m => (
              <div key={m.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">{m.label}</p>
                <p className={`text-lg font-extrabold mt-1 ${m.color || 'text-[var(--text-primary)]'}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Waste note */}
          {buyableItems.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Leaf className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-medium text-green-800">Smart Portions</h3>
              </div>
              <p className="text-xs text-green-700 leading-relaxed">
                We picked the smallest pack that covers your recipe to reduce waste.
                {wasteOptimized > 0 && <span className="font-medium ml-1"><span className="font-bold text-green-900">{wasteOptimized} of {buyableItems.length}</span> items sized for single use.</span>}
              </p>
            </div>
          )}

          {/* Pantry skipper */}
          {pantryItems.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-medium text-indigo-800">Already in your kitchen</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {pantryItems.map((item: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2.5 py-1 rounded-full text-indigo-700 border border-indigo-100 font-medium">
                    {item.ingredient_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable */}
          {unavailableItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-medium text-amber-800">Not on Instamart</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {unavailableItems.map((item: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2.5 py-1 rounded-full text-amber-700 border border-amber-200 font-medium">
                    {item.ingredient_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cart items - Scrollable Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-10">
            {buyableItems.map((item: any, i: number) => {
              const badge = STATUS[item.confidence] || STATUS.medium;
              const dot = DOT[item.confidence] || 'bg-gray-400';
              const isExpanded = expandedIdx === i;

              return (
                <div key={i} className="swiggy-card overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="p-4 flex items-start gap-3">
                    <div className="w-14 h-14 bg-sand-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingCart className="w-5 h-5 text-[var(--text-muted)]" />
                      )}
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {item.ingredient_name} • {item.ingredient_quantity_display}
                          </p>
                          <h3 className="font-semibold text-[var(--text-primary)] text-sm mt-0.5 leading-snug">{item.product_name}</h3>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {item.product_quantity_display}
                            {item.quantity > 1 && <span className="text-[var(--text-primary)] font-medium"> × {item.quantity}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[var(--text-primary)] text-base">₹{item.product_price * (item.quantity || 1)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`swiggy-badge ${badge.bg} ${badge.color} ${badge.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
                          {badge.label}
                        </span>
                        {item.waste_pct > 0 && (
                          <span className="text-[11px] text-[var(--text-muted)] bg-sand-50 px-2 py-0.5 rounded-full">
                            {item.waste_pct}% leftover
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2.5">
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                          className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition"
                        >
                          <Info className="w-3.5 h-3.5" />
                          Why this pick?
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => handleRemove(items.indexOf(item))}
                          className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[var(--border-color)] bg-sand-50 px-5 py-4 space-y-4">
                      {item.selection_reasons?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            Why we chose this
                          </p>
                          <ul className="space-y-1.5">
                            {item.selection_reasons.map((reason: string, ri: number) => (
                              <li key={ri} className="text-xs text-[var(--text-secondary)] flex items-start gap-2 leading-relaxed">
                                <PackageCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {item.alternatives?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Also available</p>
                          <div className="bg-white rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                            {item.alternatives.slice(0, 2).map((alt: any, ai: number) => (
                              <div key={ai} className="text-xs text-[var(--text-secondary)] flex items-center justify-between p-2.5">
                                <div className="truncate pr-2">
                                  <span className="font-medium block truncate">{alt.product_name}</span>
                                  <span className="text-[var(--text-muted)] text-[10px]">{alt.product_quantity_display}</span>
                                </div>
                                <span className="font-semibold text-[var(--text-primary)] shrink-0">₹{alt.product_price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Checkout */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-0 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Items</span>
                  <span>₹{total}</span>
                </div>
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Delivery</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="pt-2 border-t border-[var(--border-color)] flex justify-between font-semibold text-[var(--text-primary)] text-base mt-2">
                  <span>To Pay</span>
                  <span>₹{total}</span>
                </div>
              </div>

              {session_type === 'group' && contributors.length > 0 && (
                <div className="mb-4 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] text-sm">
                  <h4 className="font-medium text-[var(--text-primary)] mb-2 text-xs uppercase tracking-wide">Split & Approve</h4>
                  <div className="space-y-2">
                    {contributors.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await api.approveContributor(session_id, c.user_id, !c.approval_status)
                                const newC = [...contributors]
                                newC[idx].approval_status = !newC[idx].approval_status
                                setContributors(newC)
                              } catch (e) { console.error(e) }
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${c.approval_status ? 'bg-green-500 border-green-500' : 'border-[var(--text-muted)]'}`}
                          >
                            {c.approval_status && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <span className="text-[var(--text-secondary)]">{c.user_id === 'primary' ? 'You' : c.user_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-primary)] font-medium">₹{Math.round(total * c.fraction_owed)}</span>
                          {c.user_id !== 'primary' && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}?join=${session_id}&user=${encodeURIComponent(c.user_id)}`;
                                navigator.clipboard.writeText(url);
                                setCopiedLinkFor(c.user_id);
                                setTimeout(() => setCopiedLinkFor(null), 2000);
                              }}
                              className="text-[var(--accent)] hover:bg-orange-50 p-1 rounded transition-colors"
                              title="Copy invite link"
                            >
                              {copiedLinkFor === c.user_id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={loading || buyableItems.length === 0 || (session_type === 'group' && contributors.some(c => !c.approval_status))}
                className="bg-[var(--accent)] hover:bg-[#ea580c] disabled:opacity-50 text-white font-bold w-full py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Proceed to Pay
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
  )
}
