import './globals.css'
import { Providers } from './providers'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { SITE_URL } from '@/lib/seo'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300','400','500','600','700'],
  variable: '--font-serif',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['300','400','500','600'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'YASH | Bespoke and Luxury Tailoring',
    template: '%s | YASH',
  },
  description: 'Discover YASH, a fashion house for bespoke tailoring, made-to-measure clothing, and considered menswear, womenswear, and accessories.',
  applicationName: 'YASH',
  keywords: ['bespoke tailoring', 'made-to-measure clothing', 'luxury menswear', 'luxury womenswear', 'YASH'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'YASH',
    title: 'YASH | Bespoke and Luxury Tailoring',
    description: 'Discover YASH, a fashion house for bespoke tailoring, made-to-measure clothing, and considered menswear, womenswear, and accessories.',
  },
  twitter: {
    card: 'summary',
    title: 'YASH | Bespoke and Luxury Tailoring',
    description: 'Discover bespoke tailoring, made-to-measure clothing, and considered styles from YASH.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="128x128" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ClothingStore',
              name: 'YASH',
              url: SITE_URL,
              logo: `${SITE_URL}/icon.png`,
              description: 'A fashion house for bespoke tailoring and made-to-measure clothing.',
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
