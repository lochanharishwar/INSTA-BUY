'use client'
import { useState, useEffect } from 'react'
import { useStore, CartItem, CartCategory } from '../lib/store'
import { api } from '../../lib/api'
import { 
  ChevronDown, 
  ChevronUp, 
  Leaf, 
  AlertTriangle, 
  ShoppingCart, 
  ArrowRight, 
  Info, 
  Trash2, 
  Copy, 
  Check, 
  PackageCheck, 
  Link2, 
  Minus, 
  Plus, 
  HelpCircle,
  Clock,
  Sparkles,
  RefreshCw,
  PlusCircle
} from 'lucide-react'
import { getDialogue } from '../lib/hindi-dialogues'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high:        { label: 'Great pick',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100' },
  medium:      { label: 'Good match',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  low:         { label: 'Okay match',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-100' },
  substitute:  { label: 'Substitute',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  unavailable: { label: 'Unavailable', color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-100' },
  pantry:      { label: 'In pantry',   color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
}

export default function CartReview() {
  const { 
    session_id, 
    cart_proposal, 
    setScreen, 
    session_type, 
    contributors, 
    setContributors,
    cart_items,
    setCartItems,
    moveItemCategory
  } = useStore()
  
  const [loading, setLoading] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedLinkFor, setCopiedLinkFor] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState<{ text: string; movie: string; emoji: string } | null>(null)

  useEffect(() => {
    // Set dialogue according to cart conditions
    const hasHighWaste = cart_items.some(i => i.user_category === 'more_wanted' && (i.waste_pct || 0) > 50)
    if (hasHighWaste) {
      setDialogue(getDialogue('high_waste'))
    } else {
      setDialogue(getDialogue('loading'))
    }
  }, [cart_items])

  if (!cart_proposal) return null;

  const handleCopyList = async () => {
    const text = cart_items
      .filter((i: CartItem) => i.spin_id && i.user_category === 'more_wanted')
      .map((i: CartItem) => `${i.ingredient_name} — ${i.product_name} (${i.product_quantity_display}) ₹${i.product_price}`)
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
    moveItemCategory(index, 'skipped')
  }

  const handleRestore = (index: number) => {
    const item = cart_items[index]
    if (item.pantry_likely) {
      moveItemCategory(index, 'pantry')
    } else if ((item.waste_pct || 0) > 50 || item.product_price < 20) {
      moveItemCategory(index, 'less_wanted')
    } else {
      moveItemCategory(index, 'more_wanted')
    }
  }

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return
    const updated = [...cart_items]
    updated[index] = { ...updated[index], quantity: newQty }
    setCartItems(updated)
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Swiggy MCP compliance: Only buy items in 'more_wanted' or 'less_wanted' (Zaroori / Kam Zaroori)
      const buyableItems = cart_items.filter((i: CartItem) => i.spin_id && (i.user_category === 'more_wanted' || i.user_category === 'less_wanted'));
      await api.confirmCart(session_id, buyableItems);
      setScreen('tracking');
    } catch (err: any) {
      alert(err.message || 'Error placing order');
    } finally {
      setLoading(false);
    }
  }

  // Filter items into columns/sections
  const zarooriItems = cart_items.map((item, idx) => ({ item, idx })).filter(x => x.item.user_category === 'more_wanted' && x.item.spin_id)
  const kamZarooriItems = cart_items.map((item, idx) => ({ item, idx })).filter(x => x.item.user_category === 'less_wanted' && x.item.spin_id)
  const pantryItems = cart_items.map((item, idx) => ({ item, idx })).filter(x => x.item.user_category === 'pantry')
  const skippedItems = cart_items.map((item, idx) => ({ item, idx })).filter(x => x.item.user_category === 'skipped')
  const unavailableItems = cart_items.map((item, idx) => ({ item, idx })).filter(x => !x.item.spin_id && x.item.user_category !== 'skipped')

  const buyableItems = cart_items.filter((i: CartItem) => i.spin_id && (i.user_category === 'more_wanted' || i.user_category === 'less_wanted'));
  const total = buyableItems.reduce((sum: number, i: CartItem) => sum + (i.product_price * (i.quantity || 1)), 0);
  const avgWaste = buyableItems.length > 0
    ? buyableItems.reduce((sum: number, i: CartItem) => sum + (i.waste_pct || 0), 0) / buyableItems.length
    : 0;

  const totalGramsSaved = buyableItems.reduce((sum: number, i: CartItem) => {
    // Estimate packaging saving vs buying larger bulk packs
    return sum + (i.waste_grams || 0)
  }, 0)

  return (
    <div className="pb-12 px-4 max-w-6xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-6 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Swiggy Builders Club</span>
            <span className="text-xs text-[var(--text-muted)]">•</span>
            <span className="text-xs font-semibold text-orange-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> HostelSync Enabled
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 tracking-tight">Review Ingredients</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Review and adjust items based on what you actually need.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyList}
            className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white px-4 py-3 rounded-xl border border-[var(--border-color)] transition-all shadow-sm active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'List Copied' : 'Copy Shopping List'}
          </button>
        </div>
      </div>

      {/* Hindi Movie Dialogue */}
      {dialogue && (
        <motion.div 
          key={dialogue.text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hindi-banner mb-6 flex items-center justify-between text-left gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{dialogue.emoji}</span>
            <div>
              <p className="font-semibold text-orange-950">"{dialogue.text}"</p>
              <p className="text-[10px] text-orange-800/60 mt-0.5">— {dialogue.movie}</p>
            </div>
          </div>
          <button 
            onClick={() => setDialogue(getDialogue())} 
            className="text-[10px] bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Dialogue Badal
          </button>
        </motion.div>
      )}

      {/* Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: List Categories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Zaroori Section (More Wanted) */}
          <div className="bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] bg-green-50/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Zaroori Items (Must Have)</h3>
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{zarooriItems.length}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Buying from Instamart</p>
            </div>
            
            {zarooriItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                Bhai, koi zaroori item nahi hai kya? Add something below!
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {zarooriItems.map(({ item, idx }) => (
                  <CartItemRow 
                    key={item.spin_id || idx}
                    item={item}
                    idx={idx}
                    isExpanded={expandedIdx === idx}
                    onToggleExpand={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    onUpdateQty={(q) => updateQuantity(idx, q)}
                    onMove={(cat) => moveItemCategory(idx, cat)}
                    onRemove={() => handleRemove(idx)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Kam Zaroori Section (Less Wanted) */}
          <div className="bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] bg-amber-50/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Kam Zaroori Items (Optional / Extra)</h3>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{kamZarooriItems.length}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Baches to add manually</p>
            </div>
            
            {kamZarooriItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                No high-waste or minor garnish items mapped here. Good job!
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)]">
                {kamZarooriItems.map(({ item, idx }) => (
                  <CartItemRow 
                    key={item.spin_id || idx}
                    item={item}
                    idx={idx}
                    isExpanded={expandedIdx === idx}
                    onToggleExpand={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    onUpdateQty={(q) => updateQuantity(idx, q)}
                    onMove={(cat) => moveItemCategory(idx, cat)}
                    onRemove={() => handleRemove(idx)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pantry Kitchen Stock (Skipped Automatically) */}
          {pantryItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-indigo-50/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <h3 className="font-bold text-[var(--text-primary)] text-sm">Kitchen Pantry Stock (Skipped)</h3>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{pantryItems.length}</span>
                </div>
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded">Ghar Pe Hai</span>
              </div>
              
              <div className="divide-y divide-[var(--border-color)]">
                {pantryItems.map(({ item, idx }) => (
                  <div key={idx} className="p-4 flex items-center justify-between bg-indigo-50/10">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{item.ingredient_name}</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Matched with pantry stock ({item.pantry_info?.matched_item || 'Kitchen Stock'})
                        {item.pantry_info?.days_ago && ` ordered ${item.pantry_info.days_ago} days ago`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => moveItemCategory(idx, 'more_wanted')}
                        className="text-xs font-bold text-[var(--accent)] hover:bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl transition"
                      >
                        Force Buy
                      </button>
                      <button
                        onClick={() => handleRemove(idx)}
                        className="p-2 text-stone-400 hover:text-red-500 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Items (Custom Ignored) */}
          {skippedItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden opacity-75">
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                  <h3 className="font-bold text-[var(--text-primary)] text-sm">Skipped Items</h3>
                  <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{skippedItems.length}</span>
                </div>
              </div>
              
              <div className="divide-y divide-[var(--border-color)] bg-stone-50/30">
                {skippedItems.map(({ item, idx }) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text-muted)] line-through">{item.ingredient_name || item.product_name}</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Removed from checkout</p>
                    </div>
                    <button
                      onClick={() => handleRestore(idx)}
                      className="text-xs font-bold text-green-600 hover:bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl transition"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable on Instamart */}
          {unavailableItems.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">Not Available on Instamart (Buy offline)</h3>
              </div>
              <p className="text-xs text-amber-800/80 mb-3">
                These items couldn't be matched with any variant in local store inventory. You might need to buy them locally.
              </p>
              <div className="flex flex-wrap gap-2">
                {unavailableItems.map(({ item, idx }) => (
                  <span key={idx} className="text-xs bg-white px-3 py-1.5 rounded-xl text-amber-800 border border-amber-200/80 font-semibold shadow-sm flex items-center gap-1.5">
                    {item.ingredient_name} ({item.ingredient_quantity_display})
                    <button onClick={() => handleRemove(idx)} className="text-amber-400 hover:text-red-500 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Split & Checkout Summary */}
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-3xl p-6 shadow-md shadow-orange-500/10">
            <h3 className="font-extrabold text-lg tracking-tight mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Instamart Cart
            </h3>
            
            <div className="space-y-3.5 border-b border-white/20 pb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/80 font-medium">Zaroori Items</span>
                <span className="font-bold">{zarooriItems.length} items</span>
              </div>
              {kamZarooriItems.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/80 font-medium">Extra Items</span>
                  <span className="font-bold">+{kamZarooriItems.length} items</span>
                </div>
              )}
              {totalGramsSaved > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/80 font-medium flex items-center gap-1"><Leaf className="w-3.5 h-3.5" /> Est. Waste Saved</span>
                  <span className="font-bold text-green-100">{totalGramsSaved}g saved</span>
                </div>
              )}
              {avgWaste > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/80 font-medium">Average Leftover</span>
                  <span className={`font-bold ${avgWaste > 35 ? 'text-amber-200' : 'text-green-100'}`}>{avgWaste.toFixed(0)}%</span>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-white/70 uppercase tracking-widest font-extrabold">Grand Total</p>
                <p className="text-3xl font-black mt-0.5 tracking-tight">₹{total}</p>
              </div>
              <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10">COD Enabled</span>
            </div>
          </div>

          {/* HostelSync Group Split Details */}
          {session_type === 'group' && contributors.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--border-color)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-[var(--text-primary)] text-sm">HostelSync Split</h4>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Share links with roommates to approve</p>
                </div>
                <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-orange-100">Live split</span>
              </div>

              <div className="space-y-3">
                {contributors.map((c, idx) => {
                  const share = Math.round(total * c.fraction_owed)
                  const isCopied = copiedLinkFor === c.user_id

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={async () => {
                            try {
                              const newStatus = !c.approval_status
                              await api.approveContributor(session_id, c.user_id, newStatus)
                              const newC = [...contributors]
                              newC[idx].approval_status = newStatus
                              setContributors(newC)
                            } catch (e) { console.error(e) }
                          }}
                          className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-colors ${
                            c.approval_status 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-[var(--text-muted)] hover:border-[var(--accent)] bg-white'
                          }`}
                        >
                          {c.approval_status && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                        <div>
                          <span className="text-sm font-semibold text-[var(--text-secondary)]">
                            {c.user_id === 'primary' ? 'You (Host)' : c.user_id}
                          </span>
                          <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">
                            {c.approval_status ? 'Approved' : 'Awaiting approval'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--text-primary)]">₹{share}</span>
                        {c.user_id !== 'primary' && (
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}?join=${session_id}&user=${encodeURIComponent(c.user_id)}`;
                              navigator.clipboard.writeText(url);
                              setCopiedLinkFor(c.user_id);
                              setTimeout(() => setCopiedLinkFor(null), 2000);
                            }}
                            className="p-1.5 bg-white border border-[var(--border-color)] hover:border-[var(--accent)] text-stone-500 hover:text-[var(--accent)] rounded-lg transition shadow-sm"
                            title="Copy personal invite link"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Checkout Action Button */}
          <div className="bg-white rounded-2xl border border-[var(--border-color)] p-5 shadow-sm space-y-3">
            {session_type === 'group' && contributors.some(c => !c.approval_status) && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                ⚠️ <span className="font-semibold">Bhai, sabki haami zaroori hai!</span> Some roommates haven't approved their share yet. Share their invite links above to get approvals.
              </div>
            )}
            
            <button
              onClick={handleConfirm}
              disabled={
                loading || 
                buyableItems.length === 0 || 
                (session_type === 'group' && contributors.some(c => !c.approval_status))
              }
              className="w-full btn-primary py-4 text-base rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  Building Instamart Cart...
                </>
              ) : (
                <>
                  Place Instamart Order
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={() => setScreen('input')}
              className="w-full text-center text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] py-2 transition"
            >
              ← Back and cook something else
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Helper Row Component for Cart Items */
interface CartItemRowProps {
  item: CartItem
  idx: number
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateQty: (qty: number) => void
  onMove: (cat: CartCategory) => void
  onRemove: () => void
}

function CartItemRow({
  item,
  idx,
  isExpanded,
  onToggleExpand,
  onUpdateQty,
  onMove,
  onRemove
}: CartItemRowProps) {
  const badge = STATUS[item.confidence] || STATUS.medium
  const dot = DOT[item.confidence] || 'bg-gray-400'

  return (
    <div className="p-4 flex flex-col hover:bg-stone-50/50 transition">
      <div className="flex items-start gap-4">
        {/* Product image */}
        <div className="w-14 h-14 bg-stone-100 rounded-xl overflow-hidden shrink-0 border border-[var(--border-color)] flex items-center justify-center">
          {item.image_url ? (
            <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
          ) : (
            <ShoppingCart className="w-5 h-5 text-[var(--text-muted)]" />
          )}
        </div>

        {/* Product details */}
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] font-medium truncate uppercase tracking-wider">
                {item.ingredient_name} ({item.ingredient_quantity_display})
              </p>
              <h4 className="font-bold text-[var(--text-primary)] text-sm mt-0.5 leading-snug truncate">
                {item.product_name}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                <span>{item.product_brand} • {item.product_quantity_display}</span>
                {item.pantry_info && (
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-indigo-100">
                    History matched
                  </span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-extrabold text-[var(--text-primary)] text-sm">₹{item.product_price * (item.quantity || 1)}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">₹{item.product_price}/unit</p>
            </div>
          </div>

          {/* Quality metrics / History alert */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`badge ${badge.bg} ${badge.color} ${badge.border} text-[10px]`}>
              <span className={`w-1 h-1 rounded-full ${dot}`}></span>
              {badge.label}
            </span>
            {item.waste_pct > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                item.waste_pct > 50 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-stone-100 text-stone-700'
              }`}>
                {item.waste_pct}% leftover
              </span>
            )}
            
            {/* History decay / skip prompt */}
            {item.pantry_info?.days_ago !== undefined && item.pantry_info.days_ago < 7 && (
              <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ordered {item.pantry_info.days_ago} days ago. Skip?
              </span>
            )}
          </div>

          {/* Item Interaction Control Bar */}
          <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-stone-100">
            {/* Quantity adjustment */}
            <div className="flex items-center bg-stone-100/80 rounded-lg p-0.5 border border-stone-200">
              <button 
                onClick={() => onUpdateQty((item.quantity || 1) - 1)}
                className="p-1 hover:bg-white rounded-md text-stone-500 hover:text-[var(--text-primary)] transition"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3.5 text-xs font-bold text-[var(--text-primary)] tabular-nums">{item.quantity || 1}</span>
              <button 
                onClick={() => onUpdateQty((item.quantity || 1) + 1)}
                className="p-1 hover:bg-white rounded-md text-stone-500 hover:text-[var(--text-primary)] transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category / Move switch */}
            <div className="flex items-center gap-1">
              <select
                value={item.user_category}
                onChange={(e) => onMove(e.target.value as CartCategory)}
                className="bg-white border border-stone-200 hover:border-orange-300 text-[11px] font-bold text-[var(--text-secondary)] px-2.5 py-1.5 rounded-xl focus:outline-none transition cursor-pointer"
              >
                <option value="more_wanted">Zaroori (Must Buy)</option>
                <option value="less_wanted">Kam Zaroori (Optional)</option>
                <option value="pantry">Kitchen Pantry (Skip)</option>
                <option value="skipped">Removed</option>
              </select>

              <button
                onClick={onToggleExpand}
                className="p-1.5 text-stone-400 hover:text-[var(--text-primary)] transition"
                title="View match information"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={onRemove}
                className="p-1.5 text-stone-400 hover:text-red-500 transition"
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Match Reasons */}
      {isExpanded && (
        <div className="mt-3 bg-stone-50 rounded-xl p-4 border border-stone-200/50 space-y-3 animate-fade-in">
          {item.selection_reasons && item.selection_reasons.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Why we picked this variant</h5>
              <ul className="space-y-1">
                {item.selection_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.alternatives && item.alternatives.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Other available matches</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {item.alternatives.slice(0, 2).map((alt, i) => (
                  <div key={i} className="bg-white border border-stone-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold block truncate text-[var(--text-primary)]">{alt.product_name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{alt.product_quantity_display} • {alt.brand}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-[var(--text-primary)]">₹{alt.product_price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const DOT: Record<string, string> = {
  high: 'bg-green-500', 
  medium: 'bg-amber-500', 
  low: 'bg-red-500',
  substitute: 'bg-blue-500', 
  pantry: 'bg-indigo-500'
}
