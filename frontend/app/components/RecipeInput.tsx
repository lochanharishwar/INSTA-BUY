'use client'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../lib/store'
import { api } from '../../lib/api'
import { HINDI_DIALOGUES, getDialogue } from '../lib/hindi-dialogues'
import { motion, AnimatePresence } from 'framer-motion'
import { Youtube, Globe, Type, ArrowRight, Instagram, ChefHat, Users, UserPlus, Sparkles, Zap, Shield } from 'lucide-react'

const QUICK_RECIPES = [
  { label: 'Butter Chicken', url: 'https://www.youtube.com/watch?v=9WXinXCkJoI', type: 'youtube' },
  { label: 'Paneer Tikka', url: 'https://www.instagram.com/reel/DOvzTywjPGN/', type: 'instagram' },
  { label: 'Dal Makhani', url: 'https://www.youtube.com/watch?v=VhAnYvjQ7Jk', type: 'youtube' },
]

function getContextualDialogue(inputType: string | null) {
  if (inputType === 'youtube') return getDialogue('input')
  if (inputType === 'instagram') return getDialogue('input')
  if (inputType === 'blog') return getDialogue('input')
  if (inputType === 'text') return getDialogue('input')
  return getDialogue('loading')
}

export default function RecipeInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionType, setSessionType] = useState<'solo' | 'group'>('solo')
  const [roommates, setRoommates] = useState<string[]>([])
  const [newRoommate, setNewRoommate] = useState('')
  const [dialogue, setDialogue] = useState<{ text: string; movie: string; emoji: string } | null>(null)
  const { session_id, setScreen, reset, setSessionType: setStoreSessionType, setContributors } = useStore()
  const [auth, setAuth] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDialogue(getDialogue('input'))
  }, [])

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const res = await api.getLoginUrl(session_id)
      if (res.url.includes('mock_auth=success')) {
        setIsConnecting(false)
        setIsConnected(true)
        setTimeout(() => { setAuth(true); setDialogue(getDialogue('success')) }, 1200)
      } else {
        window.location.href = res.url
      }
    } catch (e) {
      console.error(e)
      setIsConnecting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setDialogue(getDialogue('loading'))
    reset()
    try {
      const contributors = sessionType === 'group'
        ? [...roommates, 'You'].map((name) => ({
            user_id: name === 'You' ? 'primary' : name,
            fraction_owed: 1 / (roommates.length + 1),
            approval_status: name === 'You' ? true : false,
          }))
        : []
      setStoreSessionType(sessionType)
      setContributors(contributors)
      await api.processRecipe(session_id, url, sessionType, contributors)
      setScreen('progress')
    } catch (err) {
      console.error(err)
      setDialogue(getDialogue('error'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddRoommate = () => {
    if (newRoommate.trim() && !roommates.includes(newRoommate.trim())) {
      setRoommates([...roommates, newRoommate.trim()])
      setNewRoommate('')
    }
  }

  const detectInputType = (input: string) => {
    const lower = input.toLowerCase()
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube'
    if (lower.includes('instagram.com')) return 'instagram'
    if (lower.startsWith('http')) return 'blog'
    if (input.length > 10) return 'text'
    return null
  }

  const inputType = detectInputType(url)

  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center mt-16 animate-fade-up">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="swiggy-card p-10 text-center max-w-sm w-full"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-500/10">
            <ChefHat className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">Connect Instamart</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">
            Link your Swiggy account to add items to cart and track delivery.
          </p>
          
          <AnimatePresence mode="wait">
            {dialogue && (
              <motion.div 
                key={dialogue.text}
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="hindi-banner mb-6 text-left"
              >
                <span className="mr-2">{dialogue.emoji}</span>
                <span>"{dialogue.text}"</span>
                <div className="text-[10px] text-amber-700/60 mt-1 ml-6">— {dialogue.movie}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleConnect}
            disabled={isConnecting || isConnected}
            className={`w-full py-4 text-base rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
              isConnected
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                : 'swiggy-btn'
            }`}
          >
            {isConnecting ? (
              <>
                <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <Shield className="w-5 h-5" />
                Connected! Swiggy se jud gaya bhai!
              </>
            ) : (
              <>
                Connect Account
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      {/* Hero */}
      <div className="mb-8 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-[var(--accent)]/10 rounded-full mb-4"
        >
          <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">AI-Powered</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] mb-3 tracking-tight">
          InstaChef <span className="text-[var(--accent)]">AI</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          Paste a recipe link or text. We'll extract ingredients, find them on Swiggy Instamart, 
          and optimize your cart — <span className="font-semibold text-[var(--text-primary)]">minimizing waste and splitting bills automatically.</span>
        </p>
      </div>

      {/* Hindi Dialogue Banner */}
      <AnimatePresence mode="wait">
        {dialogue && (
          <motion.div 
            key={dialogue.text}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="hindi-banner mb-6 text-left"
          >
            <span className="mr-2">{dialogue.emoji}</span>
            <span>"{dialogue.text}"</span>
            <div className="text-[10px] text-amber-700/60 mt-1 ml-6">— {dialogue.movie}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-[2rem] border border-[var(--border-color)] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            {/* Main Input */}
            <div className="flex items-center gap-3 bg-[var(--bg-warm)] rounded-[1.5rem] px-4 py-2 border-2 border-transparent focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent)]/10 transition-all">
              <AnimatePresence mode="wait">
                {inputType ? (
                  <motion.div key={inputType} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="shrink-0">
                    {inputType === 'youtube' && <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Youtube className="w-4 h-4 text-red-500" /></div>}
                    {inputType === 'instagram' && <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center"><Instagram className="w-4 h-4 text-pink-500" /></div>}
                    {inputType === 'blog' && <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Globe className="w-4 h-4 text-blue-500" /></div>}
                    {inputType === 'text' && <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Type className="w-4 h-4 text-amber-600" /></div>}
                  </motion.div>
                ) : (
                  <motion.div key="chef" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="shrink-0 w-8 h-8 flex items-center justify-center text-[var(--text-muted)]">
                    <ChefHat className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <input
                ref={inputRef}
                type="text"
                id="recipe-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube, Instagram, blog link or recipe text..."
                className="flex-1 py-4 bg-transparent text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
                autoFocus
              />

              <button
                type="submit"
                id="cook-this-btn"
                disabled={loading || !url.trim()}
                className="bg-[var(--accent)] hover:bg-[var(--accent-dark)] disabled:opacity-50 text-white px-6 py-3.5 rounded-[1.25rem] text-sm font-bold flex items-center gap-2 shrink-0 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden sm:inline">Chalo banate hain...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Map to Instamart</span>
                    <span className="sm:hidden">Go!</span>
                  </>
                )}
              </button>
            </div>

            {/* Session Type Toggle */}
            <div className="mt-1 px-4 pb-2 flex flex-col gap-3">
              <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Order Mode</p>
                  <p className="text-xs text-[var(--text-muted)]">Solo ya group, aapki marzi!</p>
                </div>
                <div className="flex bg-[var(--bg-warm)] p-1.5 rounded-[1rem] border border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setSessionType('solo')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      sessionType === 'solo' 
                        ? 'bg-white shadow-[0_2px_8px_rgb(0,0,0,0.08)] text-[var(--text-primary)]' 
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('group')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                      sessionType === 'group' 
                        ? 'bg-white shadow-[0_2px_8px_rgb(0,0,0,0.08)] text-[var(--text-primary)]' 
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Group
                  </button>
                </div>
              </div>

              {/* Group Roommates */}
              {sessionType === 'group' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-2xl p-4 border border-amber-100/50"
                >
                  <p className="text-xs font-medium text-amber-800 mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Add roommates — bill split evenly, sabko approve karna padega!
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-white px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 text-amber-900 shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> You
                    </span>
                    {roommates.map((r, i) => (
                      <motion.span 
                        key={i} 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="bg-white px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 text-amber-900 shadow-sm flex items-center gap-1.5"
                      >
                        {r}
                        <button type="button" onClick={() => setRoommates(roommates.filter(x => x !== r))} className="text-amber-400 hover:text-red-500 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </motion.span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRoommate}
                      onChange={(e) => setNewRoommate(e.target.value)}
                      placeholder=" roommate ka naam..."
                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddRoommate(); }}}
                      className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    />
                    <button type="button" onClick={handleAddRoommate} className="bg-white border border-amber-200 hover:border-[var(--accent)] text-amber-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </form>

        {/* Quick Links */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4">
          <span className="text-xs font-medium text-[var(--text-muted)]">Try:</span>
          {QUICK_RECIPES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setUrl(r.url)}
              className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              {r.type === 'youtube' && <Youtube className="w-3 h-3 text-red-500" />}
              {r.type === 'instagram' && <Instagram className="w-3 h-3 text-pink-500" />}
              {r.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Feature Pills */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { icon: '🍳', label: 'YouTube, Instagram, Blog' },
          { icon: '🛒', label: 'Auto Cart Build' },
          { icon: '📉', label: 'Min Waste, Max Value' },
          { icon: '👥', label: 'Group Split (HostelSync)' },
        ].map((f, i) => (
          <div key={i} className="bg-[var(--bg-warm)] rounded-xl p-3 text-center border border-[var(--border-color)]">
            <span className="text-xl">{f.icon}</span>
            <p className="text-xs font-medium text-[var(--text-secondary)] mt-1">{f.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  )
}