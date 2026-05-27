import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { Youtube, Globe, Type, Sparkles, ArrowRight, Link2, Instagram, Brain, ShoppingCart, Search, Shield, Zap, Moon, Sun, ChefHat } from 'lucide-react'

export default function RecipeInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { session_id, setScreen, reset } = useStore()
  const [auth, setAuth] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const res = await api.getLoginUrl(session_id)
      if (res.url.includes('mock_auth=success')) {
        setIsConnecting(false)
        setIsConnected(true)
        setTimeout(() => {
          setAuth(true)
        }, 1500)
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
      <div className="flex flex-col items-center justify-center mt-16 animate-fade-in">
        <div className="swiggy-glass p-10 text-center max-w-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-swiggy-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-swiggy-500 via-orange-400 to-swiggy-600" />
          
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-swiggy-50 to-orange-100 dark:from-swiggy-500/20 dark:to-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Link2 className="w-8 h-8 text-swiggy-500" />
            </div>
            <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-2">Connect Instamart</h2>
            <p className="text-brand-subtle dark:text-dark-subtle text-sm mb-8 leading-relaxed">
              Link your Swiggy account so we can search products, build your cart, and place orders on Instamart.
            </p>
            <button
              onClick={handleConnect}
              disabled={isConnecting || isConnected}
              className={`w-full py-4 text-base rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                isConnected
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : 'swiggy-btn-primary'
              }`}
            >
              {isConnecting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Connected Successfully
                </>
              ) : (
                <>
                  Connect Swiggy Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-6 animate-fade-in">
      {/* Header Section */}
      <div className="text-center mb-8 relative">
        <button
          onClick={toggleDarkMode}
          className="absolute top-0 right-0 p-2 rounded-xl bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all hover:scale-105"
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}
        </button>
        
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-swiggy-50 to-orange-50 dark:from-swiggy-500/10 dark:to-orange-500/10 text-swiggy-700 px-4 py-2 rounded-full text-sm font-medium mb-5 border border-swiggy-100/60 dark:border-swiggy-500/20 shadow-sm animate-fade-in-up">
          <Sparkles className="w-4 h-4 animate-pulse" />
          10-Node Agentic Pipeline
        </div>
        
        <h2 className="text-5xl font-bold text-brand-dark dark:text-white mb-4 leading-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          What are we<br/>
          <span className="gradient-text">cooking today?</span>
        </h2>
        <p className="text-brand-subtle dark:text-dark-subtle text-lg animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          Paste any recipe source — our AI pipeline extracts, understands,<br className="hidden sm:block" />
          normalizes, and builds your Instamart cart automatically.
        </p>
      </div>

      {/* Input Card with Glassmorphism */}
      <div className="swiggy-glass p-6 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-swiggy/40 to-transparent" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-swiggy-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
        
        <form onSubmit={handleSubmit} className="relative space-y-5">
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              id="recipe-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube URL, Instagram Reel, blog link, or type a recipe..."
              className="swiggy-input text-lg"
            />
            {inputType && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-scale-in">
                {inputType === 'youtube' && <Youtube className="w-6 h-6 text-red-500" />}
                {inputType === 'instagram' && <Instagram className="w-6 h-6 text-pink-500" />}
                {inputType === 'blog' && <Globe className="w-6 h-6 text-blue-500" />}
                {inputType === 'text' && <Type className="w-6 h-6 text-brand-subtle" />}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-brand-muted dark:text-dark-muted">Try:</span>
            <button
              type="button"
              onClick={() => setUrl('https://www.youtube.com/watch?v=9WXinXCkJoI')}
              className="text-xs text-swiggy hover:text-swiggy-700 underline underline-offset-2 transition"
            >
              Butter Chicken (YouTube)
            </button>
            <span className="text-xs text-brand-muted dark:text-dark-muted">•</span>
            <button
              type="button"
              onClick={() => setUrl('https://www.instagram.com/reel/DOvzTywjPGN/')}
              className="text-xs text-swiggy hover:text-swiggy-700 underline underline-offset-2 transition"
            >
              Paneer Tikka (Reel)
            </button>
            <span className="text-xs text-brand-muted dark:text-dark-muted">•</span>
            <button
              type="button"
              onClick={() => setUrl('Make dal tadka for 4 people. Need 200g toor dal, 2 tomatoes, 1 onion, 1 tsp cumin, 1 tsp turmeric, 1 tbsp ghee, salt to taste.')}
              className="text-xs text-swiggy hover:text-swiggy-700 underline underline-offset-2 transition"
            >
              Dal Tadka (text)
            </button>
          </div>

          <button
            type="submit"
            id="cook-this-btn"
            disabled={loading || !url.trim()}
            className="swiggy-btn-primary w-full py-5 text-lg flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            {loading ? (
              <>
                <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin relative" />
                <span className="font-semibold">Processing...</span>
              </>
            ) : (
              <>
                <ChefHat className="w-6 h-6 group-hover:animate-bounce" />
                <span className="font-semibold">Cook This</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Pipeline Architecture Showcase */}
      <div className="mt-12 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <p className="text-center text-[11px] text-brand-muted dark:text-dark-muted uppercase tracking-widest font-medium mb-5">What happens when you press Cook This</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: <Brain className="w-5 h-5" />, label: 'Classify', desc: '4 input types', gradient: 'from-blue-500 to-blue-600' },
            { icon: <Zap className="w-5 h-5" />, label: 'Extract', desc: '4-tier fallback', gradient: 'from-amber-500 to-orange-500' },
            { icon: <Sparkles className="w-5 h-5" />, label: 'Understand', desc: 'LLM parsing', gradient: 'from-purple-500 to-pink-500' },
            { icon: <Search className="w-5 h-5" />, label: 'Search', desc: '8× parallel', gradient: 'from-emerald-500 to-teal-500' },
            { icon: <Shield className="w-5 h-5" />, label: 'Validate', desc: '2 gate checks', gradient: 'from-indigo-500 to-violet-500' },
          ].map((step, i) => (
            <div 
              key={step.label} 
              className="swiggy-glass p-4 text-center hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-default group"
              style={{ animationDelay: `${600 + i * 100}ms` }}
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {step.icon}
              </div>
              <p className="text-sm font-bold text-brand-dark dark:text-white">{step.label}</p>
              <p className="text-[10px] text-brand-muted dark:text-dark-muted mt-1">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-3 mt-10 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
        {[
          { icon: '🎥', label: 'YouTube' },
          { icon: '📸', label: 'Instagram' },
          { icon: '📝', label: 'Blogs' },
          { icon: '✍️', label: 'Text' },
          { icon: '🧠', label: 'Pantry AI' },
          { icon: '📊', label: 'Waste Opt.' },
          { icon: '⭐', label: 'Personalized' },
        ].map(f => (
          <div 
            key={f.label} 
            className="flex items-center gap-2 bg-white/60 dark:bg-dark-card/60 backdrop-blur-sm text-brand-subtle dark:text-dark-subtle text-xs px-4 py-2 rounded-full border border-brand-border/40 dark:border-dark-border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <span className="text-base">{f.icon}</span>
            <span className="font-medium">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}