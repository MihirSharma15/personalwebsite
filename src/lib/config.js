export const BASE_PAGE_WIDTH = 700;
export const BASE_MARGIN = 45;
export const BASE_FONT_SIZE = 22;
export const BASE_LINE_HEIGHT = 36;
export const FONT_STACK = '"EB Garamond", "Garamond", "Georgia", "Times New Roman", serif';
export const TEXT_COLOR = '#2a1a0a';
export const BG_COLOR = '#f4eee0';

export const DRAGON_SEGMENT_COUNT = 20;
export const DRAGON_SEGMENT_SPACING = 30;
export const DRAGON_SPRITE_SCALE = 0.24;
export const WING_SEGMENT_INDEX = 5;
export const DRAGON_SEGMENT_WIDTHS = [221, 130, 203, 223, 285, 299, 281, 224, 192, 174, 191, 156, 155, 122, 126, 125, 107, 101, 101, 81];
export const FIRE_COLORS = ['#C4402A', '#E08A30', '#F0C030'];
export const FIRE_STEP_INTERVAL = 80;
export const MOUSE_IDLE_TIMEOUT = 2000;

export function getResponsiveLayout() {
  let pageWidth = Math.min(BASE_PAGE_WIDTH, window.innerWidth - 40);
  let widthScale = pageWidth / BASE_PAGE_WIDTH;
  let pageHeight = window.innerHeight;
  let margin = Math.round(BASE_MARGIN * widthScale);
  let fontScale = 0.4 + 0.6 * widthScale;
  let fontSize = Math.max(15, Math.round(BASE_FONT_SIZE * fontScale));
  let lineHeight = Math.max(24, Math.round(BASE_LINE_HEIGHT * fontScale));
  let font = `${fontSize}px ${FONT_STACK}`;
  return { pageWidth, pageHeight, margin, fontSize, lineHeight, font };
}

export function getPageOffset(layout) {
  return {
    x: Math.round((window.innerWidth - layout.pageWidth) / 2),
    y: Math.round(Math.max(20, (window.innerHeight - layout.pageHeight) / 2))
  };
}

export function getPageScale() {
  let pageWidth = Math.min(BASE_PAGE_WIDTH, window.innerWidth - 40);
  return Math.min(1, pageWidth / BASE_PAGE_WIDTH);
}
