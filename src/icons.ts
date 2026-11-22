const svg = (
  body: string,
  attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"',
  size = 20
) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs} aria-hidden="true">${body}</svg>`

const filled = 'fill="currentColor"'

export const icons = {
  play: svg('<path d="M7 4.5v15l12-7.5z"/>', filled),
  playSmall: svg('<path d="M7 4.5v15l12-7.5z"/>', filled, 18),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>', filled),
  pauseSmall: svg('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>', filled, 18),
  back: svg(
    '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M10 10v5M13.5 10.8v3.4a1.2 1.2 0 0 0 2.5 0v-3.4a1.2 1.2 0 0 0-2.5 0z" stroke-width="1.6"/>'
  ),
  forward: svg(
    '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/><path d="M8 10v5M11.5 10.8v3.4a1.2 1.2 0 0 0 2.5 0v-3.4a1.2 1.2 0 0 0-2.5 0z" stroke-width="1.6"/>'
  ),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  sound: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  grow: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  shrink: svg('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
  hand: svg(
    '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L4 15.6a1.6 1.6 0 0 1 2.4-2.1L9 16"/>'
  ),
  grip: svg(
    '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
    filled
  ),
  up: svg(
    '<path d="m6 14 6-6 6 6"/>',
    'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"',
    18
  ),
  down: svg(
    '<path d="m6 10 6 6 6-6"/>',
    'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"',
    18
  )
}
