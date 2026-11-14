import type { Metadata, Viewport } from 'next'
import { Cinzel, Inter } from 'next/font/google'
import './globals.css'

const display = Cinzel({ subsets: ['latin'], weight: ['500', '700'], variable: '--fuente-display' })
const sans = Inter({ subsets: ['latin'], variable: '--fuente-sans' })

export const metadata: Metadata = {
  title: 'Anubis · Gestión del local',
  description: 'Mesas, comandas, carta y gestión del local de shishas Anubis.',
  icons: { icon: '/logo-anubis.svg' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#16201b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      {/* suppressHydrationWarning: algunas extensiones del navegador añaden atributos al body */}
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  )
}
