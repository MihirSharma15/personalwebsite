import './globals.css';
import Manuscript from '@/components/Manuscript';

export const metadata = {
  title: {
    default: 'Mihir Sharma',
    template: '%s · Mihir Sharma'
  },
  description: 'Personal website of Mihir Sharma'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* The canvas lives here rather than in a page: the renderer binds to it
            once, so it has to survive navigation between routes. */}
        <Manuscript>{children}</Manuscript>
      </body>
    </html>
  );
}
