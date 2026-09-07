import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext';
import { SECTIONS } from './sections.js';
import { initRouter, navigate } from './router.js';
import {
  TEXT_COLOR, BG_COLOR,
  getResponsiveLayout, getPageOffset, getPageScale
} from './config.js';
import {
  loadDragonSprites, createDragon, updateDragonScale, updateDragon,
  getDragonExclusions, getFireExclusions, getFireInfluence,
  spawnFire, hasActiveFire, updateFire,
  drawDragon, drawFire,
  createFireHost, spawnRadialFire
} from './dragon.js';

// ---- WebGL setup ----
let canvas = document.getElementById('manuscript');
let gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
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
  if (ready) scheduleFrame();
});
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

document.querySelectorAll('.section-nav a[data-route]').forEach(a => {
  const id = a.dataset.route;
  a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
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
const NAV_FIRE_SPAWN_INTERVAL = 200;

document.querySelectorAll('.section-nav a[data-route]').forEach(a => {
  a.addEventListener('mouseenter', () => { hoveredNavLink = a; if (ready) scheduleFrame(); });
  a.addEventListener('mouseleave', () => { if (hoveredNavLink === a) hoveredNavLink = null; });
});

// ---- Text preparation ----
let preparedParagraphs = currentSection.paragraphs.map(p => prepareWithSegments(p, layout.font));
let lastFontSize = layout.fontSize;

function rePrepareText(force = false) {
  if (force || layout.fontSize !== lastFontSize) {
    preparedParagraphs = currentSection.paragraphs.map(p => prepareWithSegments(p, layout.font));
    lastFontSize = layout.fontSize;
  }
}

// ---- Dragon ----
await loadDragonSprites();
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
const PARAGRAPH_EXTRA_GAP = 0.9;
const LINKS_BOTTOM_RESERVE = 56;

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
  let maxY = layout.pageHeight - layout.margin - LINKS_BOTTOM_RESERVE;
  let y = layout.margin + layout.lineHeight;

  for (let pi = 0; pi < preparedParagraphs.length; pi++) {
    let prepared = preparedParagraphs[pi];
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let paragraphDone = false;
    let paraStartIdx = textLines.length;

    while (!paragraphDone && y + layout.lineHeight <= maxY) {
      let ranges = getAvailableRanges(y, layout.lineHeight, offsetX, offsetY);
      if (ranges.length === 0) { y += layout.lineHeight; continue; }

      for (let range of ranges) {
        let width = range.right - range.left;
        let line = layoutNextLine(prepared, cursor, width);
        if (line === null) { paragraphDone = true; break; }
        textLines.push({ text: line.text, x: range.left, y: y + baselineOffset, lineWidth: width, isLast: false });
        cursor = line.end;
      }
      if (!paragraphDone) y += layout.lineHeight;
    }

    // Mark the last line of this paragraph so it stays left-aligned
    if (textLines.length > paraStartIdx) {
      textLines[textLines.length - 1].isLast = true;
    }

    if (pi < preparedParagraphs.length - 1) {
      y += layout.lineHeight * (1 + PARAGRAPH_EXTRA_GAP);
    }
  }

  ctx.restore();
  textDirty = false;
}

// Draw one line with justification and optional fire effect
function drawLine(line, offsetX, offsetY) {
  const { text, x, y, lineWidth, isLast } = line;
  const hasFire = hasActiveFire(dragon);
  const words = text.trim().split(' ');
  const halfAscent = layout.fontSize * 0.857 / 2;

  const wordWidths = words.map(w => ctx.measureText(w).width);
  const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
  const naturalSpace = ctx.measureText(' ').width;
  const spaceWidth = (!isLast && words.length > 1)
    ? (lineWidth - totalWordWidth) / (words.length - 1)
    : naturalSpace;

  let sx = x;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];

    if (!hasFire) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(word, Math.round(sx), Math.round(y));
      sx += wordWidths[wi];
    } else {
      for (const char of word) {
        const charW = ctx.measureText(char).width;
        const influence = getFireInfluence(dragon, sx + charW / 2 + offsetX, y + halfAscent + offsetY);
        if (influence.strength < 0.01) {
          ctx.fillStyle = TEXT_COLOR;
          ctx.globalAlpha = 1;
          ctx.fillText(char, sx, y);
        } else {
          const str = influence.strength;
          ctx.save();
          ctx.translate(sx + charW / 2 + influence.dx * str * 45, y + halfAscent + influence.dy * str * 45);
          ctx.rotate(str * (influence.dx > 0 ? 1 : -1) * 1.2);
          ctx.globalAlpha = Math.max(0, 1 - str * 0.8);
          ctx.fillStyle = `rgb(${Math.round(42 + str * 200)},${Math.round(26 + str * 80)},10)`;
          ctx.fillText(char, -charW / 2, -halfAscent);
          ctx.restore();
        }
        sx += charW;
      }
    }

    if (wi < words.length - 1) sx += spaceWidth;
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = TEXT_COLOR;
}

function drawText(offsetX, offsetY) {
  ctx.save();
  ctx.font = layout.font;
  ctx.textBaseline = 'top';
  for (let line of textLines) {
    drawLine(line, offsetX, offsetY);
  }
  ctx.restore();
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

  if (textDirty) layoutText(offset.x, offset.y);

  let dpr = Math.ceil(window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(offset.x, offset.y);
  drawText(offset.x, offset.y);
  ctx.restore();

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
