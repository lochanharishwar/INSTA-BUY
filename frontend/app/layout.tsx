import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })

export const metadata: Metadata = {
  title: 'InstaChef AI — Recipe to Instamart in One Click',
  description: 'Paste any recipe link, video or text. We extract ingredients, optimize your cart, minimize waste, and order from Swiggy Instamart automatically.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} ${outfit.variable} font-sans`}>
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-card)]/90 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--accent)] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-xl leading-none tracking-tighter text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Insta<span className="text-[var(--accent)]">Chef</span>
                  </span>
                  <span className="text-[9px] font-bold text-[var(--text-muted)] tracking-widest uppercase">Swiggy Instamart</span>
                </div>
              </div>

              {/* Right badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
                </span>
                <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">MCP Builders Club</span>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 w-full mx-auto px-4 sm:px-6 py-8 relative">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-[var(--border-color)] py-6 mt-auto">
            <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                © {new Date().getFullYear()} InstaChef AI · Built for Swiggy Builders Club Hackathon 2026
              </p>
              <div className="flex items-center gap-4 text-xs font-medium text-[var(--text-muted)]">
                <a href="https://mcp.swiggy.com/builders/docs/" target="_blank" rel="noreferrer" className="hover:text-[var(--accent)] transition-colors">Swiggy MCP Docs</a>
                <a href="https://github.com/anomalyco/swiggy-build" target="_blank" rel="noreferrer" className="hover:text-[var(--accent)] transition-colors">GitHub</a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}