import "./globals.css"
import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: 'InstaChef — Groceries from any recipe',
  description: 'Paste a recipe video, blog link, or write it out. We find the ingredients on Swiggy Instamart so you can start cooking sooner.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} ${outfit.variable} font-sans`}>
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
          {/* Clean, minimal header */}
          <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-md">
            <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--accent)]" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                <span className="font-extrabold text-2xl tracking-tighter text-[var(--text-primary)] font-outfit">
                  Insta<span className="text-[var(--accent)]">Chef</span>
                </span>
              </div>

              {/* Live indicator */}
              <div className="flex items-center gap-2 text-xs font-medium text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-10 relative">
            {children}
          </main>

          {/* Minimal footer */}
          <footer className="border-t border-[var(--border-color)] py-4">
            <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Simple grocery ordering from recipes you love.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Swiggy Instamart
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
