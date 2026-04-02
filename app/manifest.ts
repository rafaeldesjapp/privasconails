import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Priscila Vasconcellos Admin',
    short_name: 'Priscila',
    description: 'Sistema de Gestão Priscila Vasconcellos',
    start_url: '/conta',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: 'apple-touch-icon',
        type: 'image/svg+xml',
      },
    ],
  }
}
