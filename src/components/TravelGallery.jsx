'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const GAP = 420;
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pad = number => String(number).padStart(2, '0');

function makeJourney(groups) {
  let cursor = 0;
  return groups.filter(group => group.photos.length).map(group => {
    const start = cursor;
    const length = Math.max(1, group.photos.length - 1) * GAP + 1060;
    cursor += length;
    return { ...group, start, end: cursor, length };
  });
}

export default function TravelGallery({ groups }) {
  const journey = useMemo(() => makeJourney(groups), [groups]);
  const total = journey.at(-1)?.end || 1;
  const rootRef = useRef(null);
  const countryRefs = useRef([]);
  const frameRefs = useRef([]);
  const progressRef = useRef(null);
  const triggerRef = useRef(null);
  const lightboxRef = useRef(null);
  const selectedTrigger = useRef(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selected, setSelected] = useState(null);
  const [atEnd, setAtEnd] = useState(false);
  const photoCount = journey.reduce((sum, group) => sum + group.photos.length, 0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!journey.length) return;
    gsap.registerPlugin(ScrollTrigger);
    const position = { value: 0 };
    const placements = [];
    let lastEnd = false;

    function measure() {
      const stage = rootRef.current.querySelector('.travel-stage');
      const width = stage.clientWidth, height = stage.clientHeight;
      const lanes = width < 600
        ? [[-.31, -.23], [.30, .18], [.28, -.26], [-.29, .27]]
        : [[-.29, -.19], [.29, .15], [.15, -.29], [-.13, .29]];
      placements.length = 0;
      let index = 0;
      journey.forEach((group, groupIndex) => group.photos.forEach((photo, photoIndex) => {
        const lane = lanes[photoIndex % lanes.length];
        const aspect = photo.width / photo.height;
        const maxWidth = Math.min(width * (width < 600 ? .40 : .24), 350);
        const maxHeight = Math.min(height * (width < 600 ? .30 : .39), 350);
        const photoWidth = Math.min(maxWidth, maxHeight * aspect);
        const element = frameRefs.current[index++];
        if (!element) return;
        element.style.width = `${photoWidth}px`;
        element.style.height = `${photoWidth / aspect}px`;
        placements.push({ element, groupIndex, depth: group.start + photoIndex * GAP,
          x: lane[0] * width, y: lane[1] * height });
      }));
      paint();
    }

    function paint() {
      const travel = position.value;
      let current = journey.findIndex(group => travel < group.end);
      if (current < 0) current = journey.length - 1;
      if (activeRef.current !== current) {
        activeRef.current = current;
        setActive(current);
      }
      const end = travel >= total - 35;
      if (end !== lastEnd) { lastEnd = end; setAtEnd(end); }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${travel / total})`;
      journey.forEach((group, index) => {
        const intro = index === 0 ? 1 : smooth((travel - group.start + 200) / 320);
        const outro = index === journey.length - 1 ? 1 : 1 - smooth((travel - group.end + 200) / 320);
        const label = countryRefs.current[index];
        if (label) {
          label.style.opacity = String(intro * outro);
          label.style.transform = reducedMotion ? 'translate(-50%, -50%)'
            : `translate(-50%, -50%) translateY(${(1 - intro) * 16 - (1 - outro) * 16}px)`;
        }
      });
      placements.forEach(({ element, groupIndex, depth, x, y }) => {
        const group = journey[groupIndex];
        const z = travel - depth - 250;
        const intro = groupIndex === 0 ? 1 : smooth((travel - group.start + 420) / 500);
        const outro = groupIndex === journey.length - 1 ? 1 : 1 - smooth((travel - group.end + 180) / 380);
        // Keep the same scene for reduced motion, with stationary photos
        // fading through four slots instead of zooming toward the viewer.
        const fade = reducedMotion
          ? smooth((z + 1000) / 300) * (1 - smooth((z - 300) / 300))
          : smooth((z + 3000) / 1000) * (1 - smooth((z - 600) / 300));
        const opacity = fade * intro * outro;
        const visible = opacity > .005 && z < 910 && z > -3000;
        element.style.visibility = visible ? 'visible' : 'hidden';
        element.style.opacity = String(opacity);
        element.style.pointerEvents = visible && opacity > .55 ? 'auto' : 'none';
        element.tabIndex = visible && opacity > .55 ? 0 : -1;
        if (visible) element.style.transform = `translate3d(${x}px, ${y}px, ${reducedMotion ? -250 : z}px) translate(-50%, -50%)`;
      });
    }

    measure();
    const animation = gsap.fromTo(position, { value: 0 }, { value: total, ease: 'none', onUpdate: paint,
      scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom bottom',
        scrub: reducedMotion ? true : .18, invalidateOnRefresh: true, onRefresh: measure } });
    triggerRef.current = animation.scrollTrigger;
    const observer = new ResizeObserver(() => { measure(); ScrollTrigger.refresh(); });
    observer.observe(rootRef.current.querySelector('.travel-stage'));
    return () => {
      observer.disconnect();
      animation.scrollTrigger?.kill();
      animation.kill();
      triggerRef.current = null;
    };
  }, [journey, total, reducedMotion]);

  useEffect(() => {
    if (!selected) return;
    const dialog = lightboxRef.current;
    dialog.showModal();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      selectedTrigger.current?.focus({ preventScroll: true });
    };
  }, [selected]);

  function openPhoto(photo, event) {
    selectedTrigger.current = event.currentTarget;
    setSelected(photo);
  }

  function goToCountry(index) {
    if (triggerRef.current) {
      const trigger = triggerRef.current;
      const destination = journey[index].start + (index === 0 ? 0 : 140);
      window.scrollTo({ top: trigger.start + destination / total * (trigger.end - trigger.start), behavior: 'instant' });
    }
  }

  if (!journey.length) return <main className="travel-empty"><h1>Travel</h1><p>Photographs from the road, coming soon.</p></main>;

  let photoIndex = 0;
  return (
    <main ref={rootRef} className="travel-gallery"
      style={{ '--journey-height': `${Math.round(total * .85)}px` }} aria-label="Travel photographs">
      <h1 className="travel-sr-only">Travel photographs</h1>
        <div className="travel-stage">
          <div className="travel-country-titles" aria-hidden="true">
            {journey.map((group, index) => <div key={group.code} ref={element => { countryRefs.current[index] = element; }}
              className="travel-country-title" style={{ '--country-size': `${Math.min(20, 140 / group.country.length)}vw`, opacity: index === 0 ? 1 : 0 }}>{group.country}</div>)}
          </div>
          <div className="travel-camera">
            {journey.flatMap((group, groupIndex) => group.photos.map(photo => {
              const index = photoIndex++;
              const load = Math.abs(groupIndex - active) <= 1;
              return <button key={photo.id} ref={element => { frameRefs.current[index] = element; }}
                className="travel-photo" tabIndex={-1} onClick={event => openPhoto(photo, event)} aria-label={`Open ${photo.alt}`}>
                {load && <img src={photo.src} srcSet={`${photo.thumbnail} ${Math.round(photo.width / 2)}w, ${photo.src} ${photo.width}w`}
                  sizes="(max-width: 600px) 65vw, 600px" width={photo.width} height={photo.height} alt={photo.alt}
                  loading="eager" decoding="async" onError={event => { event.currentTarget.style.opacity = '0'; }} />}
              </button>;
            }))}
          </div>
          <div className={`travel-ending${atEnd ? ' travel-ending--visible' : ''}`} hidden={!atEnd}>
            <button onClick={() => goToCountry(0)}>Wander again <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      <footer className="travel-controls">
        <div className="travel-position"><span>{pad(active + 1)}</span><span className="travel-divider">/</span>{pad(journey.length)}</div>
        <nav className="travel-country-nav" aria-label="Jump to country">
          {journey.map((group, index) => <button key={group.code} aria-current={active === index ? 'location' : undefined}
            onClick={() => goToCountry(index)}>{group.country}</button>)}
        </nav>
      </footer>
      <p className="travel-scroll-hint">{atEnd ? `${photoCount} photographs, and counting` : 'Scroll to wander'}<span aria-hidden="true">{atEnd ? '·' : '↓'}</span></p>
      <div className="travel-progress" aria-hidden="true"><div ref={progressRef} /></div>
      <span className="travel-sr-only" aria-live="polite">{journey[active]?.country}</span>
      {selected && <dialog ref={lightboxRef} className="travel-lightbox" aria-label={`Photograph from ${selected.country}`}
        onCancel={event => { event.preventDefault(); setSelected(null); }}
        onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
        <button className="travel-lightbox-close" onClick={() => setSelected(null)} aria-label="Close photograph">Close <span aria-hidden="true">×</span></button>
        <img src={selected.src} width={selected.width} height={selected.height} alt={selected.alt} />
        <p>{selected.country}</p>
      </dialog>}
    </main>
  );
}
