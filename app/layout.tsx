import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EquityMap | Mapping equity audit',
  description:
    'Investigate mapping coverage with tract-level evidence, reproducible calculations, and transparent audit tools.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
