import { useState, useRef } from 'react'
import { useStore } from '../../lib/store'
import { api } from '../../lib/api'
import { Youtube, Globe, Type, ArrowRight, Instagram, ChefHat, Users, UserPlus } from 'lucide-react'

export default function RecipeInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionType, setSessionType] = useState<'solo' | 'group'>('solo')
  const [roommates, setRoommates] = useState<string[]>([])
  const [newRoommate, setNewRoommate] = useState('')
  const { session_id, setScreen, reset, setSessionType: setStoreSessionType, setContributors } = useStore()
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
    <div className="max-w-3xl mx-auto mt-4 animate-fade-in">
      {/* Hero */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">
          InstaChef <span className="text-[var(--accent)]">Order</span>
        </h2>
        <p className="text-[var(--text-secondary)] text-sm font-medium">
          Paste a recipe link or text. We'll add the exact ingredients to your Instamart cart.
        </p>
      </div>

      {/* Input */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 shadow-sm">
        <form onSubmit={handleSubmit}>
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-2 border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-xl px-2 py-1 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
              <input
                ref={inputRef}
                type="text"
                id="recipe-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube, Instagram, or blog link..."
                className="flex-1 py-3 px-3 bg-transparent text-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none font-medium"
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
                className="bg-[var(--accent)] hover:bg-[#ea580c] disabled:opacity-50 text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shrink-0 transition-colors"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Search Instamart</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* HostelSync Group Mode Toggle */}
            <div className="border-t border-[var(--border-color)] pt-3 px-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Who is cooking?</p>
                <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setSessionType('solo')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      sessionType === 'solo' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Just me
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('group')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                      sessionType === 'group' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Group
                  </button>
                </div>
              </div>

              {sessionType === 'group' && (
                <div className="animate-fade-in bg-sand-50 dark:bg-[#34302c] rounded-xl p-3 border border-[var(--border-color)]">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Add roommates to split the bill evenly. They will approve their share.</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="bg-[var(--bg-card)] px-3 py-1 rounded-full text-xs font-medium border border-[var(--border-color)] text-[var(--text-primary)]">You (1/{roommates.length + 1})</span>
                    {roommates.map((r, i) => (
                      <span key={i} className="bg-[var(--bg-card)] px-3 py-1 rounded-full text-xs font-medium border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-1">
                        {r} (1/{roommates.length + 1})
                        <button type="button" onClick={() => setRoommates(roommates.filter(x => x !== r))} className="text-red-400 hover:text-red-600 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRoommate}
                      onChange={(e) => setNewRoommate(e.target.value)}
                      placeholder="Roommate name..."
                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddRoommate(); }}}
                      className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    />
                    <button type="button" onClick={handleAddRoommate} className="swiggy-btn-ghost px-3 py-1.5 text-sm flex items-center gap-1">
                      <UserPlus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
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
    </div>
  )
}
