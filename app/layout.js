import './globals.css';
import { Inter, JetBrains_Mono, Fraunces } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['opsz', 'SOFT', 'WONK'],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: {
    default: 'Salt World — Wellness sanctuary in Bengaluru',
    template: '%s · Salt World',
  },
  description:
    "Bengaluru's premium wellness destination. Float therapy, salt therapy, infrared sauna, cold plunge and red-light therapy — designed around outcomes, not menus.",
  openGraph: {
    title: 'Salt World — Wellness sanctuary in Bengaluru',
    description: "A place engineered to feel like nothing. Book your first quiet 45 minutes.",
    type: 'website',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
