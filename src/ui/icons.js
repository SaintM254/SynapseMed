// Inline SVG icon set — one visual language, no icon font or library.
const s = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  logo: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="18.6" cy="12" r="3" fill="#5EEAD4"/>
    <circle cx="4" cy="5" r="1.7" fill="#8C93A6"/>
    <circle cx="4" cy="19" r="1.7" fill="#8C93A6"/>
    <circle cx="4" cy="12" r="1.7" fill="#8C93A6"/>
    <path d="M5.4 5.7C9 7.4 10.6 10 15.6 11.2M5.4 18.3C9 16.6 10.6 14 15.6 12.8M5.9 12h9.6" stroke="#8C93A6" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,

  folder: s('<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
  caret: s('<path d="M9 5.5 15.5 12 9 18.5"/>', '0 0 24 24'),

  ft_pdf: s('<path d="M6 3.5h7L18 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M12.5 3.5V9H18"/><path d="M8.5 17.5v-4m0 0h1.6a1.45 1.45 0 1 1 0 2.9H8.5m5.7 1.1v-4m0 0h2.1m-2.1 2h1.8" stroke-width="1.4"/>'),
  ft_docx: s('<path d="M6 3.5h7L18 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M12.5 3.5V9H18"/><path d="M8.5 13.5h6M8.5 16h6M8.5 18.5h4" stroke-width="1.4"/>'),
  ft_pptx: s('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M10 8.5v4l3.5-2zM12 16v2.5M9 21h6" stroke-width="1.5"/>'),
  ft_image: s('<rect x="4" y="4.5" width="16" height="15" rx="1.5"/><circle cx="9" cy="9.5" r="1.4"/><path d="m5.5 18 4.5-4.5 3 3 3.5-3.5 2 2"/>'),
  ft_gdoc: s('<path d="M6 3.5h7L18 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M12.5 3.5V9H18"/><path d="M8.5 13.5h6M8.5 16.5h4" stroke-width="1.4"/>'),
  ft_other: s('<path d="M6 3.5h7L18 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M12.5 3.5V9H18"/>'),

  search: s('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  sync: s('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6m0 13.2v2.6M2.8 12h2.6m13.2 0h2.6M5.5 5.5l1.8 1.8m9.4 9.4 1.8 1.8M5.5 18.5l1.8-1.8m9.4-9.4 1.8-1.8"/>'),
  back: s('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  download: s('<path d="M12 4v10m0 0 4-4m-4 4-4-4"/><path d="M4.5 17v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V17"/>'),
  external: s('<path d="M10 6H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"/><path d="M14.5 4.5H19.5V9.5M19 5l-7.5 7.5"/>'),
  send: s('<path d="M4.5 12 19.5 4.5 14 19.5l-2.7-5.6z"/><path d="M19.5 4.5 11.3 13.9"/>'),
  sparkle: s('<path d="M12 4.5 13.8 10.2 19.5 12 13.8 13.8 12 19.5 10.2 13.8 4.5 12 10.2 10.2Z"/><path d="M18.5 4.5v3m1.5-1.5h-3" stroke-width="1.4"/>'),
  zoomIn: s('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M11 8.5v5M8.5 11h5"/>'),
  zoomOut: s('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.5 11h5"/>'),
  file: s('<path d="M6 3.5h7L18 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M12.5 3.5V9H18"/>'),

  google: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6Z"/>
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-7-5.1L1.2 17.2C3.2 21.3 7.3 24 12 24Z"/>
    <path fill="#FBBC05" d="M5 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.2 0 12s.4 3.6 1.2 5.2L5 14.3Z"/>
    <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9.9 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.8L5 9.7c1-2.9 3.8-5.1 7-5.1Z"/>
  </svg>`
};

const TYPE_ICON_MAP = {
  pdf: 'ft_pdf',
  docx: 'ft_docx',
  pptx: 'ft_pptx',
  image: 'ft_image',
  gdoc: 'ft_gdoc',
  gslides: 'ft_pptx',
  other: 'ft_other'
};

export function typeIcon(type) {
  return icons[TYPE_ICON_MAP[type] || 'ft_other'];
}
