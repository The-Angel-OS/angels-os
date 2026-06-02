import { Orbitron, Rajdhani } from 'next/font/google'

// Answer53 LCARS typography — scoped to the Soul Viewer route subtree only.
const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-orbitron',
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
})

export default function SoulViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${orbitron.variable} ${rajdhani.variable}`}>{children}</div>
  )
}
