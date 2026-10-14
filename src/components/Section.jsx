'use client';

import { useEffect } from 'react';

// Renders no DOM: this site's body text is painted onto the WebGL canvas that
// the root layout keeps mounted across navigations. A route's page component
// renders this to hand its content to that canvas.
export default function Section({ section }) {
  useEffect(() => {
    let cancelled = false;

    import('@/lib/renderer.js').then(renderer => {
      if (!cancelled) renderer.setSection(section);
    });

    return () => {
      cancelled = true;
    };
  }, [section]);

  return null;
}
