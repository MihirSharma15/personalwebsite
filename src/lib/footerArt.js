import { BG_COLOR } from './config.js';

// A dithered, single-ink illustration used as a quiet full-width footer:
// a photo reduced to one dark-tan ink against the page's own cream so it
// reads as an etching sitting behind the text.
const INK_COLOR = '#6e4c30';
const RENDER_WIDTH = 1200;
const DITHER_STEP = 1;
const BRIGHTEN_GAMMA = 0.5;
const MAX_ALPHA = 0.40;
const MIN_BAND_HEIGHT = 300;
const MAX_BAND_HEIGHT = 5000;
const MAX_BAND_HEIGHT_RATIO = 0.28;
const TOP_FADE_RATIO = 0.8;
// A ratio (of band height) rather than a fixed px count, so the bottom fade
// scales along with the band instead of looking abrupt now that the band
// can grow much taller (MAX_BAND_HEIGHT is effectively uncapped).
const BOTTOM_FADE_RATIO = 0.9;
// Where the sampled crop starts, as a fraction of the source image's height
// (0 = very top of the photo, 1 = very bottom). Set directly rather than
// derived, so it stays predictable regardless of viewport size — how much
// of the image is visible below this point still depends on the responsive
// band height, but where it *starts* is always exactly this.
const SOURCE_TOP_RATIO = 0;
// `scale` (viewportWidth / art.width) shrinks a lot on narrow viewports,
// which inflates the vertical sample height and shifts what a fixed-ratio
// fade lands on (e.g. mountains on desktop, the church on mobile, for the
// exact same source crop). Flooring it keeps the vertical framing
// consistent across viewport widths.
const MIN_SAMPLE_SCALE = 0.75;

function hexToRgb(hex) {
  let n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// The brighten + Atkinson-dither pass is real per-pixel work (400ms+ for
// these images) and runs in ditherWorker.js instead of inline here, so it
// can't freeze the main thread — and with it, every rAF/setTimeout on the
// page, including the loading-screen timer — for its whole duration.
let ditherWorker = null;
let nextRequestId = 1;
const pendingRequests = new Map();

function getDitherWorker() {
  if (!ditherWorker) {
    ditherWorker = new Worker(new URL('./ditherWorker.js', import.meta.url));
    ditherWorker.onmessage = ({ data }) => {
      const resolve = pendingRequests.get(data.id);
      if (!resolve) return;
      pendingRequests.delete(data.id);
      resolve(data);
    };
  }
  return ditherWorker;
}

function ditherInWorker(url, width, gamma, step, palette) {
  return new Promise(resolve => {
    const id = nextRequestId++;
    pendingRequests.set(id, resolve);
    getDitherWorker().postMessage({ id, url, width, gamma, step, palette });
  });
}

// Scratch buffer sized to just the footer band. The fade mask is composited
// here (in isolation) rather than directly on the shared page canvas,
// because `destination-in` clears everything *outside* the drawn shape —
// on the shared canvas that would erase the whole page above the band.
// Shared across instances: only one band is drawn per frame.
let scratch = document.createElement('canvas');
let scratchCtx = scratch.getContext('2d');

// Each page gets its own instance so the crop and fade can be framed around
// that particular photo's subject.
export function createFooterArt(options) {
  const cfg = {
    sourceTopRatio: SOURCE_TOP_RATIO,
    topFadeRatio: TOP_FADE_RATIO,
    maxAlpha: MAX_ALPHA,
    maxBandHeightRatio: MAX_BAND_HEIGHT_RATIO,
    bottomFadeRatio: BOTTOM_FADE_RATIO,
    ...options
  };

  let art = { canvas: null, width: 0, height: 0, ready: false };

  function load() {
    const palette = [hexToRgb(BG_COLOR), hexToRgb(INK_COLOR)];
    return ditherInWorker(cfg.src, RENDER_WIDTH, BRIGHTEN_GAMMA, DITHER_STEP, palette).then(result => {
      if (result.error) return art;

      let { width: w, height: h, buffer } = result;
      let imageData = new ImageData(new Uint8ClampedArray(buffer), w, h);
      let src = document.createElement('canvas');
      src.width = w;
      src.height = h;
      src.getContext('2d').putImageData(imageData, 0, 0);

      art = { canvas: src, width: w, height: h, ready: true };
      return art;
    });
  }

  // How tall the band will be — so a page can keep its own content clear of
  // the artwork instead of stacking on top of it.
  function bandHeight(viewportWidth, viewportHeight) {
    if (!art.ready) return 0;
    let aspect = art.height / art.width;
    let maxBandH = Math.min(Math.max(viewportHeight * cfg.maxBandHeightRatio, MIN_BAND_HEIGHT), MAX_BAND_HEIGHT);
    return Math.min(viewportWidth * aspect, maxBandH);
  }

  // Keep the background fade anchored to the viewport. The dragon and fire
  // reflow the text every frame; following that moving boundary made the
  // artwork pulse and could collapse the bottom gradient to zero height.
  function draw(ctx, viewportWidth, viewportHeight) {
    if (!art.ready) return;

    let bandH = bandHeight(viewportWidth, viewportHeight);
    let bandTop = viewportHeight - bandH;

    let scale = viewportWidth / art.width;
    let visibleSrcH = bandH / Math.max(scale, MIN_SAMPLE_SCALE);
    let sy = Math.max(0, Math.min(art.height - visibleSrcH, art.height * cfg.sourceTopRatio));

    let bw = Math.max(1, Math.round(viewportWidth));
    let bh = Math.max(1, Math.round(bandH));
    if (scratch.width !== bw || scratch.height !== bh) {
      scratch.width = bw;
      scratch.height = bh;
    } else {
      scratchCtx.clearRect(0, 0, bw, bh);
    }

    scratchCtx.globalAlpha = cfg.maxAlpha;
    scratchCtx.imageSmoothingEnabled = false;
    scratchCtx.drawImage(art.canvas, 0, sy, art.width, visibleSrcH, 0, 0, bw, bh);
    scratchCtx.globalAlpha = 1;

    // Local (scratch-space) fade boundary, independent of moving text.
    let visibleFrom = bh * cfg.topFadeRatio;

    let grad = scratchCtx.createLinearGradient(0, 0, 0, visibleFrom);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    scratchCtx.globalCompositeOperation = 'destination-in';
    scratchCtx.fillStyle = grad;
    scratchCtx.fillRect(0, 0, bw, bh);

    // Also fade out right at the very bottom edge, so the fixed footer links
    // (email / LinkedIn / X) sitting on top of the canvas stay legible.
    let bottomFadeStart = Math.max(visibleFrom, bh * (1 - cfg.bottomFadeRatio));
    let bottomGrad = scratchCtx.createLinearGradient(0, bottomFadeStart, 0, bh);
    bottomGrad.addColorStop(0, 'rgba(0,0,0,1)');
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0)');
    scratchCtx.fillStyle = bottomGrad;
    scratchCtx.fillRect(0, 0, bw, bh);
    scratchCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(scratch, 0, bandTop);
  }

  return { load, draw, bandHeight };
}

export const dolomitesArt = createFooterArt({ src: '/dolomiteschurch.png' });

// The /quote backdrop. The quote is drawn on top of this, so nothing here
// needs to leave room for text — every knob below is purely about how the
// picture itself looks.
export const gardenArt = createFooterArt({
  src: '/chinesegarden.jpg',
  // Where the crop starts in the source photo: 0 = top of the sky,
  // 1 = bottom of the trees.
  sourceTopRatio: 0.5,
  // Band height as a share of viewport height. The band is bottom-anchored,
  // so raising this grows it upward. It's only the ceiling: the band is the
  // smaller of this and (viewport width × the image's aspect), which is why
  // narrow viewports stay a short strip no matter how high this goes.
  maxBandHeightRatio: 1,
  // Share of the band spent fading in at the top edge. Lower = reaches full
  // strength sooner, so more of the pagoda reads as solid.
  topFadeRatio: 0.9,
  // Share of the band spent fading out at the bottom, which keeps the footer
  // links legible. Higher = starts fading earlier and more gradually.
  bottomFadeRatio: 0.9,
  // Overall ink strength, 0–1. Turn this down if the picture ever competes
  // with the quote sitting on top of it.
  maxAlpha: 0.4
});

export function loadFooterArt() {
  return Promise.all([dolomitesArt.load(), gardenArt.load()]);
}
