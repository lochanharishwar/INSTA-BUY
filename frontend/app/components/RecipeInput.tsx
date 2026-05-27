import { useState, useRef } from 'react'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { Youtube, Globe, Type, ArrowRight, Instagram, ChefHat } from 'lucide-react'

export default function RecipeInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { session_id, setScreen, reset } = useStore()
  const [auth, setAuth] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const res = await api.getLoginUrl(session_id)
      if (res.url.includes('mock_auth=success')) {
        setIsConnecting(false)
        setIsConnected(true)
        setTimeout(() => { setAuth(true) }, 1200)
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
    reset()
    try {
      await api.processRecipe(session_id, url)
      setScreen('progress')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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
      <div className="flex flex-col items-center justify-center mt-24 animate-fade-in">
        <div className="swiggy-card p-10 text-center max-w-sm">
          <div className="w-12 h-12 bg-sand-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ChefHat className="w-6 h-6 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Connect Instamart</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">
            Link your account so we can add items to your Swiggy cart and track delivery.
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting || isConnected}
            className={`w-full py-3.5 text-base rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
              isConnected
                ? 'bg-green-500 text-white'
                : 'swiggy-btn-primary'
            }`}
          >
            {isConnecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Connected
              </>
            ) : (
              <>
                Connect Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-12">
        <h2 className="font-outfit text-5xl md:text-6xl font-bold text-[var(--text-primary)] mb-5 tracking-tight leading-tight">
          Turn Inspiration<br />
          <span className="text-[var(--accent)] drop-shadow-sm">Into Ingredients.</span>
        </h2>
        <p className="text-[var(--text-muted)] text-base md:text-lg max-w-md mx-auto leading-relaxed font-medium">
          Paste a recipe video, reel, or blog. We'll find every item on Instamart in seconds.
        </p>
      </div>

      {/* Input */}
      <div className="swiggy-card p-2 shadow-float hover:shadow-glow-swiggy transition-shadow duration-500 rounded-2xl relative bg-white/60 backdrop-blur-xl border border-[var(--border-color)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-subtle)] to-transparent rounded-2xl pointer-events-none opacity-50" />
        <form onSubmit={handleSubmit} className="relative z-10">
          <div className="relative flex items-center gap-2 bg-[var(--bg-card)] rounded-xl px-2 py-1 shadow-inner">
            <input
              ref={inputRef}
              type="text"
              id="recipe-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube, Instagram, or blog link..."
              className="flex-1 py-4 px-4 bg-transparent text-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
            />
            {inputType && (
              <div className="pr-2 flex items-center animate-scale-in">
                {inputType === 'youtube' && <Youtube className="w-6 h-6 text-red-500 drop-shadow-sm" />}
                {inputType === 'instagram' && <Instagram className="w-6 h-6 text-pink-500 drop-shadow-sm" />}
                {inputType === 'blog' && <Globe className="w-6 h-6 text-blue-500 drop-shadow-sm" />}
                {inputType === 'text' && <Type className="w-6 h-6 text-[var(--text-muted)] drop-shadow-sm" />}
              </div>
            )}
            <button
              type="submit"
              id="cook-this-btn"
              disabled={loading || !url.trim()}
              className="swiggy-btn-primary px-8 py-4 text-base flex items-center gap-2 shrink-0 shadow-glow-swiggy group"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="font-bold tracking-wide">Gather</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick links */}
        <div className="flex flex-wrap items-center gap-2 mt-3 px-4 pb-3">
          <span className="text-xs text-[var(--text-muted)]">Try:</span>
          <button
            type="button"
            onClick={() => setUrl('https://www.youtube.com/watch?v=9WXinXCkJoI')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Butter Chicken
          </button>
          <span className="text-xs text-[var(--text-muted)]">•</span>
          <button
            type="button"
            onClick={() => setUrl('https://www.instagram.com/reel/DOvzTywjPGN/')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Paneer Tikka
          </button>
          <span className="text-xs text-[var(--text-muted)]">•</span>
          <button
            type="button"
            onClick={() => setUrl('Make dal tadka for 4 people. Need 200g toor dal, 2 tomatoes, 1 onion, 1 tsp cumin, 1 tsp turmeric, 1 tbsp ghee, salt to taste.')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Dal Tadka
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-16">
        <p className="text-center text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium mb-6">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: 'Read', desc: 'Recipe from any source' },
            { label: 'Find', desc: 'Ingredients on Instamart' },
            { label: 'Pick', desc: 'Best sizes for less waste' },
            { label: 'Order', desc: 'Delivered to your door' },
          ].map((step, i) => (
            <div
              key={step.label}
              className="text-center p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:shadow-card-hover transition-shadow duration-300"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sand-100 text-[var(--text-secondary)] text-sm font-semibold mb-3">
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{step.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
