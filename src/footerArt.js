import DitherJS from 'ditherjs';
import { BG_COLOR } from './config.js';

// A dithered, single-ink illustration used as a quiet full-width footer on
// the home page: the Dolomites, reduced to one dark-tan ink against the
// page's own cream so it reads as an etching sitting behind the text.
const IMAGE_SRC = '/dolomiteschurch.png';
const INK_COLOR = '#6e4c30';
const RENDER_WIDTH = 1200;
const DITHER_STEP = 1;
const BRIGHTEN_GAMMA = 0.5;
const MAX_ALPHA = 0.40;
const MIN_BAND_HEIGHT = 300;
const MAX_BAND_HEIGHT = 5000;
const MAX_BAND_HEIGHT_RATIO = 0.28;
const TOP_FADE_RATIO = 0.8;
const TEXT_GAP = 60;
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

// Reduces to grayscale and brightens with a gamma curve so only genuinely
// dark structure (treeline, church, rock shadow) survives as ink — most of
// the photo (sky, snow, sunlit grass) lifts toward the background tone
// instead of the dither reading as a solid, distracting block of color.
function brightenGrayscale(imageData, gamma) {
  let d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = 255 * Math.pow(luma / 255, gamma);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}

let art = { canvas: null, width: 0, height: 0, ready: false };

// Scratch buffer sized to just the footer band. The fade mask is composited
// here (in isolation) rather than directly on the shared page canvas,
// because `destination-in` clears everything *outside* the drawn shape —
// on the shared canvas that would erase the whole page above the band.
let scratch = document.createElement('canvas');
let scratchCtx = scratch.getContext('2d');

export function loadFooterArt() {
  return new Promise(resolve => {
    let img = new Image();
    img.onload = () => {
      let w = RENDER_WIDTH;
      let h = Math.round(w * (img.naturalHeight / img.naturalWidth));

      let src = document.createElement('canvas');
      src.width = w;
      src.height = h;
      let sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0, w, h);

      let imageData = sctx.getImageData(0, 0, w, h);
      brightenGrayscale(imageData, BRIGHTEN_GAMMA);
      let dither = new DitherJS({
        algorithm: 'atkinson',
        step: DITHER_STEP,
        palette: [hexToRgb(BG_COLOR), hexToRgb(INK_COLOR)]
      });
      dither.ditherImageData(imageData);
      sctx.putImageData(imageData, 0, 0);

      art = { canvas: src, width: w, height: h, ready: true };
      resolve(art);
    };
    img.onerror = () => resolve(art);
    img.src = IMAGE_SRC;
  });
}

// Draws the dithered artwork as a bottom-anchored, full-width band behind
// the page content. `textBottomY` is the viewport-space Y of the lowest
// line of body text (or null if there is none) — the band fades out before
// it reaches that line so the art never fights with the text for legibility.
export function drawFooterArt(ctx, viewportWidth, viewportHeight, textBottomY) {
  if (!art.ready) return;

  let aspect = art.height / art.width;
  let maxBandH = Math.min(Math.max(viewportHeight * MAX_BAND_HEIGHT_RATIO, MIN_BAND_HEIGHT), MAX_BAND_HEIGHT);
  let bandH = Math.min(viewportWidth * aspect, maxBandH);
  let bandTop = viewportHeight - bandH;

  let scale = viewportWidth / art.width;
  let visibleSrcH = bandH / Math.max(scale, MIN_SAMPLE_SCALE);
  let sy = Math.max(0, Math.min(art.height - visibleSrcH, art.height * SOURCE_TOP_RATIO));

  let bw = Math.max(1, Math.round(viewportWidth));
  let bh = Math.max(1, Math.round(bandH));
  if (scratch.width !== bw || scratch.height !== bh) {
    scratch.width = bw;
    scratch.height = bh;
  } else {
    scratchCtx.clearRect(0, 0, bw, bh);
  }

  scratchCtx.globalAlpha = MAX_ALPHA;
  scratchCtx.imageSmoothingEnabled = false;
  scratchCtx.drawImage(art.canvas, 0, sy, art.width, visibleSrcH, 0, 0, bw, bh);
  scratchCtx.globalAlpha = 1;

  // Local (scratch-space) fade boundary: natural soft top edge, pushed
  // further down the band if the text runs long enough to reach it.
  let visibleFrom = bh * TOP_FADE_RATIO;
  if (textBottomY != null) {
    let localTextBoundary = (textBottomY + TEXT_GAP) - bandTop;
    if (localTextBoundary > visibleFrom) visibleFrom = Math.min(localTextBoundary, bh);
  }

  let grad = scratchCtx.createLinearGradient(0, 0, 0, visibleFrom);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  scratchCtx.globalCompositeOperation = 'destination-in';
  scratchCtx.fillStyle = grad;
  scratchCtx.fillRect(0, 0, bw, bh);

  // Also fade out right at the very bottom edge, so the fixed footer links
  // (email / LinkedIn / X) sitting on top of the canvas stay legible.
  let bottomFadeStart = Math.max(visibleFrom, bh * (1 - BOTTOM_FADE_RATIO));
  let bottomGrad = scratchCtx.createLinearGradient(0, bottomFadeStart, 0, bh);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,1)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0)');
  scratchCtx.fillStyle = bottomGrad;
  scratchCtx.fillRect(0, 0, bw, bh);
  scratchCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(scratch, 0, bandTop);
}
