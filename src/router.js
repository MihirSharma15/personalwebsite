import { SECTIONS } from './sections.js';

function resolveSection(pathname) {
  return SECTIONS.find(s => s.path === pathname) || SECTIONS[0];
}

export function initRouter(onChange) {
  onChange(resolveSection(window.location.pathname));
  window.addEventListener('popstate', () => {
    onChange(resolveSection(window.location.pathname));
  });
}

export function navigate(id) {
  let section = SECTIONS.find(s => s.id === id);
  if (!section) return;
  if (window.location.pathname !== section.path) {
    window.history.pushState({}, '', section.path);
  }
  return section;
}
