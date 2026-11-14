import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anubis · Gestión del local',
    short_name: 'Anubis',
    description: 'Mesas, comandas, carta y gestión del local de shishas Anubis.',
    lang: 'es-ES',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#16201b',
    theme_color: '#16201b',
    icons: [{ src: '/logo-anubis.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
