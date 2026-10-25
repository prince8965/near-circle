import type { Category } from '../types'

const THEMES: Record<Category, { from: string; to: string; accent: string; glyph: string }> = {
  Technology: { from: '#00F2FE', to: '#0B0F19', accent: '#00F2FE', glyph: 'M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10' },
  'AI/ML': { from: '#A855F7', to: '#0B0F19', accent: '#A855F7', glyph: 'M12 4v3M12 17v3M4 12h3M17 12h3M8 8l8 8M16 8l-8 8' },
  'Web Development': { from: '#00F2FE', to: '#1E293B', accent: '#38BDF8', glyph: 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18M12 3a9 9 0 100 18 9 9 0 000-18z' },
  Music: { from: '#EC4899', to: '#1E293B', accent: '#F472B6', glyph: 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z' },
  Sports: { from: '#06B6D4', to: '#0B0F19', accent: '#22D3EE', glyph: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 4 3 14 0 18' },
  Art: { from: '#F43F5E', to: '#1E293B', accent: '#FB7185', glyph: 'M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2-.5-1 0-2 1.5-2H17a4 4 0 004-4c0-5-4-10-9-10z' },
  Business: { from: '#38BDF8', to: '#0B0F19', accent: '#0284C7', glyph: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  Workshops: { from: '#818CF8', to: '#1E293B', accent: '#A5B4FC', glyph: 'M14 7l3 3-9 9H5v-3l9-9zM13 8l3 3' },
}

/** Generates a clean, original SVG poster as a data URL so cards never show a broken image. */
export function generatePoster(category: Category, title: string): string {
  const t = THEMES[category]
  const safe = title.replace(/[<>&"]/g, '')
  const words = safe.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 22) {
      lines.push(cur.trim())
      cur = w
    } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  const shown = lines.slice(0, 3)
  const text = shown
    .map((l, i) => `<text x="40" y="${300 + i * 44}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${l}</text>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${t.from}" stop-opacity="0.85"/>
    <stop offset="1" stop-color="${t.to}"/>
  </linearGradient>
  <radialGradient id="glow" cx="80%" cy="20%" r="60%">
    <stop offset="0" stop-color="${t.accent}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="#0B0F19" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="640" height="400" fill="#0B0F19"/>
<rect width="640" height="400" fill="url(#g)" fill-opacity="0.75"/>
<rect width="640" height="400" fill="url(#glow)"/>
<circle cx="520" cy="90" r="150" fill="${t.accent}" fill-opacity="0.12"/>
<circle cx="470" cy="150" r="90" fill="${t.accent}" fill-opacity="0.08"/>
<g transform="translate(420 30) scale(6)" fill="none" stroke="${t.accent}" stroke-opacity="0.95" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="${t.glyph}"/></g>
<rect x="40" y="40" width="${category.length * 11 + 28}" height="30" rx="15" fill="#0B0F19" fill-opacity="0.9" stroke="#334155" stroke-width="1.5"/>
<text x="54" y="60" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="600" fill="${t.accent}">${category}</text>
${text}
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
