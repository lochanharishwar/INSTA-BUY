import "./globals.css"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'InstaChef AI — Cooking Commerce Agent',
  description: 'Turn any recipe video, blog, or text into a Swiggy Instamart grocery order in seconds. Powered by a 10-node AI pipeline with semantic matching, pantry intelligence, and real-time order tracking.',
  keywords: ['recipe', 'grocery', 'AI', 'Swiggy', 'Instamart', 'cooking', 'commerce', 'agent'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} font-sans`}>
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
          {/* Animated Background Pattern */}
          <div className="fixed inset-0 pattern-dots opacity-50 pointer-events-none" />
          <div className="fixed inset-0 pattern-grid opacity-30 pointer-events-none" />
          
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-xl shadow-sm">
            <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 bg-gradient-to-br from-swiggy-500 via-orange-500 to-swiggy-600 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-200">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-dark-card animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-brand-dark dark:text-white leading-none tracking-tight">
                    InstaChef AI
                  </h1>
                  <p className="text-[10px] text-brand-muted dark:text-dark-muted font-medium tracking-widest uppercase mt-0.5">
                    Cooking Commerce Agent
                  </p>
                </div>
              </div>

              {/* Right side — Status + pipeline badge */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-brand-subtle dark:text-dark-subtle bg-[var(--bg-glass)] px-4 py-2 rounded-full border border-[var(--border-color)] backdrop-blur-sm">
                  <span className="font-mono font-bold text-swiggy-500">10</span>
                  <span>nodes</span>
                  <span className="text-brand-muted dark:text-dark-muted">·</span>
                  <span className="font-mono font-bold text-swiggy-500">2</span>
                  <span>gates</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-xs font-semibold border border-green-100 dark:border-green-500/20">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-8 relative">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-sm py-5">
            <div className="max-w-5xl mx-auto px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-brand-muted dark:text-dark-muted">Powered by</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-brand-subtle dark:text-dark-subtle bg-[var(--bg-card)] dark:bg-dark-card px-3 py-1.5 rounded-lg border border-[var(--border-color)]">LangGraph</span>
                  <span className="text-[10px] font-bold text-brand-subtle dark:text-dark-subtle bg-[var(--bg-card)] dark:bg-dark-card px-3 py-1.5 rounded-lg border border-[var(--border-color)]">NVIDIA NIM</span>
                  <span className="text-[10px] font-bold text-brand-subtle dark:text-dark-subtle bg-[var(--bg-card)] dark:bg-dark-card px-3 py-1.5 rounded-lg border border-[var(--border-color)]">Swiggy MCP</span>
                </div>
              </div>
              <p className="text-xs text-brand-muted dark:text-dark-muted">
                Swiggy Builders Club 2026
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}