import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Priscila Nails Designer',
    short_name: 'Priscila Nails',
    description: 'Sistema de Gestão Priscila Vasconcellos',
    start_url: '/conta',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#db2777',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

