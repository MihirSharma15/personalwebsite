import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext';
import { SECTIONS } from './sections.js';
import { initRouter, navigate } from './router.js';
import {
  TEXT_COLOR, BG_COLOR, FONT_STACK,
  getResponsiveLayout, getPageOffset, getPageScale
} from './config.js';
import {
  loadDragonSprites, createDragon, updateDragonScale, updateDragon,
  getDragonExclusions, getFireExclusions, getFireInfluence,
  spawnFire, hasActiveFire, updateFire,
  drawDragon, drawFire,
  createFireHost, spawnRadialFire,
  getRestPoseBottomReach
} from './dragon.js';
import { loadFooterArt, dolomitesArt, gardenArt } from './footerArt.js';
import { pickQuote } from './quotes.js';

// ---- WebGL setup ----
let canvas = document.getElementById('manuscript');
// alpha:false would make the drawing buffer start as opaque black, which the
// fixed-position canvas shows over the page background until the first frame
// lands — and the first frame waits on sprites and fonts below.
let gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
let offscreen = document.createElement('canvas');
let ctx = offscreen.getContext('2d');

const vertSrc = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = (a_pos + 1.0) * 0.5;
  v_uv.y = 1.0 - v_uv.y;
}
`;
const fragSrc = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}
`;

function createShader(type, src) {
  let s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

let program = gl.createProgram();
gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(program);
gl.useProgram(program);

let buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
let posLoc = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

let tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// ---- Canvas resize ----
function resize() {
  let dpr = Math.ceil(window.devicePixelRatio || 1);
  let w = window.innerWidth * dpr;
  let h = window.innerHeight * dpr;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  gl.viewport(0, 0, w, h);
  offscreen.width = w;
  offscreen.height = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();

// ---- State ----
let layout = getResponsiveLayout();
let mouse = { x: 0, y: 0 };
let mouseDown = false;
let ready = false;

// ---- Input ----
canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  canvas.style.cursor = hitTestLink(e.clientX, e.clientY) ? 'pointer' : '';
  if (ready) scheduleFrame();
});
canvas.addEventListener('click', e => {
  let hit = hitTestLink(e.clientX, e.clientY);
  if (hit) window.open(hit.url, '_blank', 'noopener');
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  scrollY = Math.min(Math.max(0, scrollY + e.deltaY), maxScrollFor(contentHeight));
  textDirty = true;
  if (ready) scheduleFrame();
}, { passive: false });
canvas.addEventListener('mousedown', () => { mouseDown = true; if (ready) scheduleFrame(); });
canvas.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mouseleave', () => { mouseDown = false; });
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  let t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
  mouseDown = true;
  if (ready) scheduleFrame();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  let t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
  if (ready) scheduleFrame();
}, { passive: false });
canvas.addEventListener('touchend', () => { mouseDown = false; });

// ---- Sections & routing ----
let currentSection = SECTIONS[0];

function sectionDocTitle(section) {
  return section.id === 'home' ? section.title : `${section.title} · Mihir Sharma`;
}

function commitSection(section) {
  currentSection = section;
  document.title = sectionDocTitle(section);
}

function changeSection(section) {
  if (section.id === currentSection.id) return;

  document.title = sectionDocTitle(section);
  currentSection = section;
  rePrepareText(true);
  scrollY = 0;
  textDirty = true;
}

let hasStarted = false;
function handleSectionChange(section) {
  if (!hasStarted) {
    hasStarted = true;
    commitSection(section);
    return;
  }
  changeSection(section);
}
initRouter(handleSectionChange);

// ---- Mobile nav drawer ----
let navToggle = document.querySelector('.nav-toggle');
let navScrim = document.querySelector('.nav-scrim');

function setNavOpen(open) {
  document.body.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

navToggle.addEventListener('click', () => {
  setNavOpen(!document.body.classList.contains('nav-open'));
});
navScrim.addEventListener('click', () => setNavOpen(false));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') setNavOpen(false);
});

document.querySelectorAll('.section-nav a[data-route]').forEach(a => {
  const id = a.dataset.route;
  a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setNavOpen(false);
    let section = navigate(id);
    if (section) changeSection(section);
  });
});

// ---- Nav-link hover flames ----
// Each link sits "in front of" a virtual dragon's mouth: hovering spawns a
// radial burst of fire (reusing the dragon's own particle system) right
// behind the link.
let navFire = createFireHost();
let hoveredNavLink = null;
let lastNavFireSpawn = 0;
let navHoverTimer = null;
const NAV_FIRE_SPAWN_INTERVAL = 200;
const NAV_FIRE_HOVER_DELAY = 1000;

// A tap makes touch browsers emulate mouseenter but never the matching
// mouseleave, which left the flames burning forever, so only a real mouse
// arms them.
document.querySelectorAll('.section-nav a[data-route]').forEach(a => {
  a.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(navHoverTimer);
    navHoverTimer = setTimeout(() => {
      hoveredNavLink = a;
      if (ready) scheduleFrame();
    }, NAV_FIRE_HOVER_DELAY);
  });
  a.addEventListener('pointerleave', () => {
    clearTimeout(navHoverTimer);
    if (hoveredNavLink === a) hoveredNavLink = null;
  });
});

// ---- Text preparation ----
// A paragraph entry that's an array renders as a tight bullet list: each
// item gets its own line with a leading bullet, tighter line spacing than
// prose, and (unlike normal paragraphs) no extra gap between consecutive
// items — only after the list's last item, same as a regular paragraph break.
const BULLET_PREFIX = '• ';

function flattenParagraphs(paragraphs) {
  let units = [];
  for (let p of paragraphs) {
    if (Array.isArray(p)) {
      p.forEach((item, i) => {
        units.push({ text: BULLET_PREFIX + item, tightGapAfter: i < p.length - 1, isListItem: true, isBold: false });
      });
    } else if (typeof p === 'object' && p !== null) {
      units.push({ text: p.text, tightGapAfter: false, isListItem: false, isBold: !!p.bold });
    } else {
      units.push({ text: p, tightGapAfter: false, isListItem: false, isBold: false });
    }
  }
  return units;
}

function getBoldFont() {
  return `bold ${layout.fontSize}px ${FONT_STACK}`;
}

function prepareUnit(u) {
  return prepareWithSegments(u.text, u.isBold ? getBoldFont() : layout.font);
}

let paragraphUnits = flattenParagraphs(currentSection.paragraphs);
let preparedParagraphs = paragraphUnits.map(prepareUnit);
let lastFontSize = layout.fontSize;

function rePrepareText(force = false) {
  if (force || layout.fontSize !== lastFontSize) {
    paragraphUnits = flattenParagraphs(currentSection.paragraphs);
    preparedParagraphs = paragraphUnits.map(prepareUnit);
    lastFontSize = layout.fontSize;
  }
}

// ---- Dragon & footer art ----
await Promise.all([loadDragonSprites(), loadFooterArt()]);
await document.fonts.ready;

let scale = getPageScale();
let offset = getPageOffset(layout);
let dragonStartX = offset.x + layout.margin + 80 * scale;
let dragonStartY = offset.y + layout.margin + 40 * scale;

let dragon = createDragon(dragonStartX, dragonStartY, scale);

// ---- Resize handler ----
window.addEventListener('resize', () => {
  layout = getResponsiveLayout();
  resize();
  if (ready) {
    rePrepareText();
    scale = getPageScale();
    updateDragonScale(dragon, scale);
    textDirty = true;
    scheduleFrame();
  }
});

// ---- Text layout ----
let textLines = [];
let textDirty = true;
const MIN_LINE_WIDTH = 40;
const TEXT_EXCLUSION_PAD = 10;
const PARAGRAPH_EXTRA_GAP = 0.15;
const LIST_LINE_HEIGHT_RATIO = 0.25;
// How far the top fade (on scrollable pages) extends, as a fraction of the
// dragon's actual coil reach. 1 = fades over the coil's full ~430px depth;
// lower values make the fade shorter/tighter.
const FADE_REACH_RATIO = 0.2;

// A page can hold more content than fits on one screen — it scrolls (wheel
// only) while the dragon stays put, pinned to the viewport. `contentHeight`
// is how tall the current section's full text is, used to clamp scrollY.
let scrollY = 0;
let contentHeight = 0;

// Measured from the actual .links footer nav rather than a fixed constant —
// on mobile it wraps into a 3-line stacked column (see index.html's
// @media rule) which is much taller than the single-row desktop layout, so
// a hardcoded reserve either wastes space on desktop or gets run under on
// mobile.
let linksNavEl = document.querySelector('.links');
function getLinksBottomReserve() {
  if (!linksNavEl) return 20;
  let rect = linksNavEl.getBoundingClientRect();
  return Math.max(20, Math.round(window.innerHeight - rect.top + 12));
}

function maxScrollFor(height) {
  let viewportBottom = layout.pageHeight - layout.margin - getLinksBottomReserve();
  return Math.max(0, height - viewportBottom);
}

// ---- In-text hyperlinks (e.g. "FLAS" on the Travel page) ----
// Body text is canvas-drawn, not DOM, so a link is just a word rendered in
// a different color/underline whose screen rect we record here each frame,
// then hit-test on hover (cursor) and click (open the URL).
const LINK_COLOR = '#c4402a';
let linkHitRegions = [];

function hitTestLink(x, y) {
  return linkHitRegions.find(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

// Fixed screen-space window the scrollable text is allowed to paint in —
// same top/bottom every frame regardless of scrollY, so content hard-cuts
// at the bottom (before the footer links) and, on pages that actually
// scroll, fades out at the top well clear of the dragon's coiled rest pose
// instead of dodging around it column-by-column as it scrolls through.
// Updated once per frame in render().
let textClipTop = 0;
let textClipBottom = Infinity;

// Isolated scratch buffer for the text band, so the top fade (an alpha
// mask) can be composited without erasing the background/dragon drawn
// elsewhere on the shared canvas — same technique as footerArt.js.
let textScratch = document.createElement('canvas');
let textScratchCtx = textScratch.getContext('2d');

function subtractRanges(ranges, left, right) {
  let result = [];
  for (let r of ranges) {
    if (right <= r.left || left >= r.right) {
      result.push(r);
    } else {
      if (left > r.left) result.push({ left: r.left, right: left });
      if (right < r.right) result.push({ left: right, right: r.right });
    }
  }
  return result;
}

function getAvailableRanges(y, lineH, offsetX, offsetY) {
  let ranges = [{ left: layout.margin, right: layout.pageWidth - layout.margin }];

  let top = y + offsetY;
  let bot = y + lineH + offsetY;

  let dragonRects = getDragonExclusions(dragon, top, bot, TEXT_EXCLUSION_PAD);
  for (let r of dragonRects) {
    ranges = subtractRanges(ranges, r.left - offsetX, r.right - offsetX);
  }

  let fireRects = getFireExclusions(dragon, top, bot, 6);
  for (let r of fireRects) {
    ranges = subtractRanges(ranges, r.left - offsetX, r.right - offsetX);
  }

  return ranges.filter(r => r.right - r.left >= MIN_LINE_WIDTH);
}

function layoutText(offsetX, offsetY) {
  textLines = [];
  ctx.save();
  ctx.font = layout.font;
  let ascent = layout.fontSize * 0.857;
  let baselineOffset = (layout.lineHeight - ascent) / 2;
  // No viewport cutoff — the page scrolls instead of clipping content.
  let maxY = Infinity;
  let y = layout.margin + layout.lineHeight;

  for (let pi = 0; pi < preparedParagraphs.length; pi++) {
    let prepared = preparedParagraphs[pi];
    let unit = paragraphUnits[pi];
    let stepH = unit.isListItem ? layout.lineHeight * LIST_LINE_HEIGHT_RATIO : layout.lineHeight;
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let paragraphDone = false;
    let paraStartIdx = textLines.length;

    while (!paragraphDone && y + stepH <= maxY) {
      let ranges = getAvailableRanges(y, stepH, offsetX, offsetY);
      if (ranges.length === 0) { y += stepH; continue; }

      for (let range of ranges) {
        let width = range.right - range.left;
        let line = layoutNextLine(prepared, cursor, width);
        if (line === null) { paragraphDone = true; break; }
        textLines.push({ text: line.text, x: range.left, y: y + baselineOffset, lineWidth: width, isLast: false, isBold: unit.isBold });
        cursor = line.end;
      }
      if (!paragraphDone) y += stepH;
    }

    // Mark the last line of this paragraph so it stays left-aligned
    if (textLines.length > paraStartIdx) {
      textLines[textLines.length - 1].isLast = true;
    }

    if (pi < preparedParagraphs.length - 1) {
      let gap = unit.tightGapAfter ? 0 : PARAGRAPH_EXTRA_GAP;
      y += layout.lineHeight * (1 + gap);
    }
  }

  contentHeight = y;
  scrollY = Math.min(scrollY, maxScrollFor(contentHeight));
  ctx.restore();
  textDirty = false;
}

// Draw one line with justification and optional fire effect
function drawLine(targetCtx, line, offsetX, offsetY) {
  const { text, x, y, lineWidth, isLast, isBold } = line;
  const hasFire = hasActiveFire(dragon);
  const words = text.trim().split(' ');
  const halfAscent = layout.fontSize * 0.857 / 2;

  targetCtx.font = isBold ? getBoldFont() : layout.font;

  const wordWidths = words.map(w => targetCtx.measureText(w).width);
  const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
  const naturalSpace = targetCtx.measureText(' ').width;
  const spaceWidth = (!isLast && words.length > 1)
    ? (lineWidth - totalWordWidth) / (words.length - 1)
    : naturalSpace;

  let sx = x;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const linkUrl = currentSection.links && currentSection.links[word.replace(/[.,;:!?]+$/, '')];

    // Hit-region bookkeeping is unconditional — it must not depend on
    // `hasFire`, or clicking a link (which itself triggers a fire puff via
    // mousedown) blanks its own hit region the instant it's clicked.
    if (linkUrl) {
      const linkTop = y + offsetY;
      const linkBottom = y + halfAscent * 2 + offsetY;
      if (linkBottom > textClipTop && linkTop < textClipBottom) {
        linkHitRegions.push({
          left: sx + offsetX,
          right: sx + wordWidths[wi] + offsetX,
          top: linkTop,
          bottom: linkBottom,
          url: linkUrl
        });
      }
    }

    if (!hasFire) {
      if (linkUrl) {
        targetCtx.fillStyle = LINK_COLOR;
        targetCtx.fillText(word, Math.round(sx), Math.round(y));
        const underlineY = Math.round(y + halfAscent * 2 + 2);
        targetCtx.fillRect(Math.round(sx), underlineY, Math.round(wordWidths[wi]), 1);
      } else {
        targetCtx.fillStyle = TEXT_COLOR;
        targetCtx.fillText(word, Math.round(sx), Math.round(y));
      }
      sx += wordWidths[wi];
    } else {
      for (const char of word) {
        const charW = targetCtx.measureText(char).width;
        const influence = getFireInfluence(dragon, sx + charW / 2 + offsetX, y + halfAscent + offsetY);
        if (influence.strength < 0.01) {
          targetCtx.fillStyle = TEXT_COLOR;
          targetCtx.globalAlpha = 1;
          targetCtx.fillText(char, sx, y);
        } else {
          const str = influence.strength;
          targetCtx.save();
          targetCtx.translate(sx + charW / 2 + influence.dx * str * 45, y + halfAscent + influence.dy * str * 45);
          targetCtx.rotate(str * (influence.dx > 0 ? 1 : -1) * 1.2);
          targetCtx.globalAlpha = Math.max(0, 1 - str * 0.8);
          targetCtx.fillStyle = `rgb(${Math.round(42 + str * 200)},${Math.round(26 + str * 80)},10)`;
          targetCtx.fillText(char, -charW / 2, -halfAscent);
          targetCtx.restore();
        }
        sx += charW;
      }
    }

    if (wi < words.length - 1) sx += spaceWidth;
  }

  targetCtx.globalAlpha = 1;
  targetCtx.fillStyle = TEXT_COLOR;
}

function drawText(targetCtx, offsetX, offsetY) {
  targetCtx.save();
  targetCtx.font = layout.font;
  targetCtx.textBaseline = 'top';
  linkHitRegions = [];
  for (let line of textLines) {
    drawLine(targetCtx, line, offsetX, offsetY);
  }
  targetCtx.restore();
}

// ---- Quote page ----
// Picked once per page load, so a refresh is what rerolls it.
const currentQuote = pickQuote();
const QUOTE_MAX_FONT = 46;
const QUOTE_MIN_FONT = 15;
const QUOTE_LINE_RATIO = 1.42;
const QUOTE_WIDTH_RATIO = 0.92;
const QUOTE_ART_OVERLAP = 0.3;

function wrapQuote(targetCtx, maxWidth) {
  let lines = [];
  let line = '';
  for (let word of currentQuote.split(' ')) {
    let candidate = line ? `${line} ${word}` : word;
    if (line && targetCtx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Shrinks until the whole quote fits the space between the dragon's rest
// pose and the footer art — the list runs from four words to fifty, so a
// fixed size would either look timid or overflow.
function drawQuote(targetCtx, availTop, availBottom) {
  let maxWidth = Math.min(layout.pageWidth, window.innerWidth - layout.margin * 2) * QUOTE_WIDTH_RATIO;
  let availHeight = availBottom - availTop;
  let size = QUOTE_MAX_FONT;
  let lines = [];

  while (size > QUOTE_MIN_FONT) {
    targetCtx.font = `italic ${size}px ${FONT_STACK}`;
    lines = wrapQuote(targetCtx, maxWidth);
    if (lines.length * size * QUOTE_LINE_RATIO <= availHeight) break;
    size -= 1;
  }

  let lineHeight = size * QUOTE_LINE_RATIO;
  let startY = availTop + (availHeight - lines.length * lineHeight) / 2;

  targetCtx.save();
  targetCtx.font = `italic ${size}px ${FONT_STACK}`;
  targetCtx.fillStyle = TEXT_COLOR;
  targetCtx.textAlign = 'center';
  targetCtx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    targetCtx.fillText(lines[i], window.innerWidth / 2, Math.round(startY + i * lineHeight));
  }
  targetCtx.restore();
}

// ---- Render loop ----
let frameScheduled = false;

function render(time) {
  frameScheduled = false;
  let offset = getPageOffset(layout);
  let idle = !mouseDown;
  let sc = getPageScale();
  let restX = offset.x + layout.margin + 80 * sc;
  let restY = offset.y + layout.margin + (-20) * sc;

  let moved = updateDragon(dragon, time, mouse.x, mouse.y, idle, restX, restY);
  if (mouseDown) spawnFire(dragon);
  let hasFire = hasActiveFire(dragon);
  if (hasFire) updateFire(dragon, time);
  if (moved || hasFire) textDirty = true;

  if (hoveredNavLink && time - lastNavFireSpawn > NAV_FIRE_SPAWN_INTERVAL) {
    lastNavFireSpawn = time;
    let rect = hoveredNavLink.getBoundingClientRect();
    spawnRadialFire(navFire, rect.left + rect.width / 2, rect.top + rect.height / 2, sc * 0.55);
  }
  if (hasActiveFire(navFire)) updateFire(navFire, time);

  if (textDirty) layoutText(offset.x, offset.y - scrollY);

  let dpr = Math.ceil(window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (currentSection.id === 'home') {
    let textBottomY = textLines.length
      ? offset.y - scrollY + Math.max(...textLines.map(l => l.y)) + layout.lineHeight
      : null;
    dolomitesArt.draw(ctx, window.innerWidth, window.innerHeight, textBottomY);
  } else if (currentSection.quote) {
    // No text boundary: the quote is vertically centred well above the band,
    // and letting it push the fade down would swallow the pagoda.
    gardenArt.draw(ctx, window.innerWidth, window.innerHeight, null);
  }

  textClipTop = offset.y + layout.margin;
  textClipBottom = offset.y + layout.pageHeight - layout.margin - getLinksBottomReserve();
  let scrollable = maxScrollFor(contentHeight) > 0;

  if (scrollable) {
    // The dragon's idle coil reaches far past its head — fade text out
    // before that point instead of hard-cutting it, so it never has to
    // dodge around the tail as it scrolls through. FADE_REACH_RATIO scales
    // how far down that fade extends (1 = the coil's full reach; lower =
    // tighter/shorter fade).
    let fadeBottom = Math.min(textClipBottom, restY + getRestPoseBottomReach(sc) * FADE_REACH_RATIO);
    let bw = Math.max(1, Math.round(window.innerWidth));
    let bh = Math.max(1, Math.round(textClipBottom - textClipTop));
    let pw = bw * dpr, ph = bh * dpr;
    if (textScratch.width !== pw || textScratch.height !== ph) {
      textScratch.width = pw;
      textScratch.height = ph;
    } else {
      textScratchCtx.clearRect(0, 0, pw, ph);
    }
    // Scratch is a plain 1:1 canvas — without this it renders at CSS-pixel
    // resolution and gets blown up blurry when composited onto the (dpr-
    // scaled) main canvas below.
    textScratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The translate positions drawing within the scratch's local pixels,
    // but fire-influence and link hit-testing need real screen coordinates
    // — so those still get the true (non-scratch-relative) offset.
    textScratchCtx.save();
    textScratchCtx.translate(offset.x, offset.y - scrollY - textClipTop);
    drawText(textScratchCtx, offset.x, offset.y - scrollY);
    textScratchCtx.restore();

    let fadeGrad = textScratchCtx.createLinearGradient(0, 0, 0, fadeBottom - textClipTop);
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fadeGrad.addColorStop(1, 'rgba(0,0,0,1)');
    textScratchCtx.globalCompositeOperation = 'destination-in';
    textScratchCtx.fillStyle = fadeGrad;
    textScratchCtx.fillRect(0, 0, bw, bh);
    textScratchCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(textScratch, 0, 0, pw, ph, 0, textClipTop, bw, bh);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, textClipTop, window.innerWidth, Math.max(0, textClipBottom - textClipTop));
    ctx.clip();
    ctx.translate(offset.x, offset.y - scrollY);
    drawText(ctx, offset.x, offset.y - scrollY);
    ctx.restore();
  }

  if (currentSection.quote) {
    // The quote may run into the band's faded top edge but stops before the
    // pagoda itself — reserving the whole band instead squeezes the quote up
    // into the dragon on desktop, and letting it run the full height buries
    // the pagoda on mobile.
    let bandH = gardenArt.bandHeight(window.innerWidth, window.innerHeight);
    let pagodaTop = window.innerHeight - bandH + bandH * QUOTE_ART_OVERLAP;
    drawQuote(ctx, textClipTop, Math.min(textClipBottom, pagodaTop));
  }

  drawFire(ctx, dragon);
  drawDragon(ctx, dragon);
  if (hasActiveFire(navFire)) drawFire(ctx, navFire);

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  scheduleFrame();
}

function scheduleFrame() {
  if (!frameScheduled) {
    frameScheduled = true;
    requestAnimationFrame(render);
  }
}

ready = true;
scheduleFrame();
