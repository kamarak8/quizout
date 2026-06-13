import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quizout — Multiplayer Football Trivia',
  description: 'The penalty shootout football trivia game. Answer questions. Score goals. Win.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pitch-bg min-h-screen">{children}</body>
    </html>
  )
}
