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
            <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[var(--accent)] rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 3C7.5 3 3.5 6 3 10c-.5 4 2 7.5 9 10.7C19 17.5 21.5 14 21 10c-.5-4-4.5-7-9-7z" />
                    <path d="M12 7v6M8 12l4-4 4 4" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
                  InstaChef
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
