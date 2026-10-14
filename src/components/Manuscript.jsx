'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LoadingState from './LoadingState';

const routes = [
  ['/', 'home', 'Home'],
  ['/travel', 'travel', 'Travel'],
  ['/whats-next', 'whats-next', "What's Next"],
  ['/blog', 'blog', 'Blog']
];

export default function Manuscript({ children }) {
  const pathname = usePathname();
  const isTravel = pathname === '/travel';
  const [isReady, setIsReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const rendererRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('non-home', pathname !== '/');
    document.body.classList.toggle('travel-page', isTravel);
    setNavOpen(false);
  }, [pathname, isTravel]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen);
    const onKey = event => { if (event.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (isTravel) {
      rendererRef.current?.setRendererActive(false);
      return;
    }
    let cancelled = false;
    const onReady = () => {
      setIsReady(true);
    };

    window.addEventListener('manuscript-ready', onReady, { once: true });
    // Travel has its own DOM gallery and never boots the manuscript renderer.
    import('@/lib/renderer.js').then(renderer => {
      rendererRef.current = renderer;
      renderer.setRendererActive(!cancelled);
    });

    return () => {
      cancelled = true;
      rendererRef.current?.setRendererActive(false);
      window.removeEventListener('manuscript-ready', onReady);
    };
  }, [isTravel]);

  return (
    <>
      {children}
      <div className={`loading-overlay${isReady || isTravel ? ' loading-overlay--complete' : ''}`} aria-hidden={isReady || isTravel}>
        {!isReady && !isTravel && <LoadingState />}
      </div>
      <canvas id="manuscript" hidden={isTravel} />
      <button className="nav-toggle" aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} aria-controls="section-nav" onClick={() => setNavOpen(open => !open)}><span /><span /><span /></button>
      <div className="nav-scrim" onClick={() => setNavOpen(false)} />
      <nav className="section-nav" id="section-nav"><div className="nav-links">
        {routes.map(([href, id, label]) => <Link href={href} data-route={id} aria-current={pathname === href ? 'page' : undefined} onClick={() => setNavOpen(false)} key={id}>{label}</Link>)}
      </div></nav>
      <nav className="links">
        <a href="mailto:mihirxsharma15@gmail.com">mihirxsharma15 [at] gmail [dot] com</a>
        <a href="https://www.linkedin.com/in/MihirSharma15" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://x.com/mihirsharma2005" target="_blank" rel="noopener">X</a>
      </nav>
      <div className="scroll-spacer" aria-hidden="true" hidden={isTravel} />
    </>
  );
}
