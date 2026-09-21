'use client';

import { useEffect, useState } from 'react';
import LoadingState from './components/LoadingState';

const routes = [
  ['/', 'home', 'Home'],
  ['/travel', 'travel', 'Travel'],
  ['/whats-next', 'whats-next', "What's Next"],
  ['/blog', 'blog', 'Blog']
];

export default function Manuscript() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const onReady = () => {
      setIsReady(true);
    };

    window.addEventListener('manuscript-ready', onReady, { once: true });
    // The existing renderer stays browser-only because it owns a WebGL canvas.
    import('./main.js');

    return () => {
      window.removeEventListener('manuscript-ready', onReady);
    };
  }, []);

  return (
    <>
      <div className={`loading-overlay${isReady ? ' loading-overlay--complete' : ''}`} aria-hidden={isReady}>
        <LoadingState />
      </div>
      <canvas id="manuscript" />
      <button className="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="section-nav"><span /><span /><span /></button>
      <div className="nav-scrim" />
      <nav className="section-nav" id="section-nav"><div className="nav-links">
        {routes.map(([href, id, label]) => <a href={href} data-route={id} key={id}>{label}</a>)}
      </div></nav>
      <nav className="links">
        <a href="mailto:mihirxsharma15@gmail.com">mihirxsharma15 [at] gmail [dot] com</a>
        <a href="https://www.linkedin.com/in/MihirSharma15" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://x.com/mihirsharma2005" target="_blank" rel="noopener">X</a>
      </nav>
      <div className="scroll-spacer" aria-hidden="true" />
    </>
  );
}
