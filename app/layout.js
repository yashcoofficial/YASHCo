import './globals.css'
import { Providers } from './providers'
import { Cormorant_Garamond, Inter } from 'next/font/google'

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
  title: 'YASH — Own Every Moment',
  description: 'YASH Maison — A curated house of quiet luxury. Own Every Moment.',
  icons: {
    icon: [{ url: '/YASH.png', type: 'image/png', sizes: '512x512' }],
    shortcut: '/YASH.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
