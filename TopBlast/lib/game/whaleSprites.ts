/**
 * Standalone Blasty SVG strings with literal colors (no CSS vars) so they can
 * be rasterized to canvas Images — used by the Blast Off game and the brand
 * asset generator. Kept in sync with components/mascot/BlastyWhale.tsx.
 */

const BODY = '#9945FF'
const BODY_DARK = '#7A2FD4'
const BODY_DEEP = '#4c1d95'
const INKFACE = '#2b2140'

const DEFS = `
  <defs>
    <linearGradient id="gb" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0%" stop-color="${BODY}"/>
      <stop offset="70%" stop-color="${BODY_DARK}"/>
      <stop offset="100%" stop-color="${BODY_DEEP}"/>
    </linearGradient>
    <linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fdf7ff"/>
      <stop offset="100%" stop-color="#e4d9fb"/>
    </linearGradient>
    <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="55%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
    <radialGradient id="gr">
      <stop offset="0%" stop-color="#fda4af" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#fda4af" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="gc"><path d="M40 138 C40 84 94 48 158 48 C214 48 250 72 258 106 C261 119 259 130 252 140 C244 158 222 172 196 178 C160 186 108 184 76 172 C52 163 40 152 40 138 Z"/></clipPath>
  </defs>`

const TAIL = `<path d="M226 148 C247 140 259 124 263 102 C266 86 274 72 290 64 C287 80 286 92 290 100 C302 102 313 112 319 126 C306 132 294 132 284 127 C276 143 260 156 240 162 Z" fill="url(#gb)"/>
  <path d="M240 158 C258 150 270 136 276 118 C278 132 272 148 258 158 Z" fill="${BODY_DEEP}" opacity="0.35"/>`

const FIN_TOP = `<path d="M176 54 C180 38 194 30 210 34 C202 42 196 50 194 60 Z" fill="url(#gb)"/>`

const BODY_SHAPE = `<path d="M40 138 C40 84 94 48 158 48 C214 48 250 72 258 106 C261 119 259 130 252 140 C244 158 222 172 196 178 C160 186 108 184 76 172 C52 163 40 152 40 138 Z" fill="url(#gb)"/>`

const SHADING = `<g clip-path="url(#gc)">
    <ellipse cx="180" cy="196" rx="170" ry="62" fill="#3b0764" opacity="0.28"/>
    <path d="M24 154 C70 166 130 172 190 166 C224 162 248 152 262 142 L268 250 L16 250 Z" fill="url(#gy)"/>
    <path d="M40 168 C96 180 168 182 232 168" stroke="#c4b5fd" stroke-opacity="0.55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M56 180 C110 190 172 190 224 180" stroke="#c4b5fd" stroke-opacity="0.4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="118" cy="72" rx="112" ry="52" fill="#ffffff" opacity="0.16"/>
    <ellipse cx="98" cy="62" rx="46" ry="22" fill="#ffffff" opacity="0.18"/>
  </g>`

const FLIPPER = `<path d="M138 152 C158 146 176 150 184 164 C172 176 152 176 138 166 C132 161 132 156 138 152 Z" fill="url(#gb)"/>
  <path d="M142 155 C158 151 170 154 177 162" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2.5" fill="none" stroke-linecap="round"/>`

const BLUSH = `<circle cx="62" cy="136" r="11" fill="url(#gr)"/>`

const EYE_OPEN = `<ellipse cx="80" cy="114" rx="11" ry="13" fill="${INKFACE}"/>
  <circle cx="84" cy="109" r="4" fill="#ffffff"/>
  <circle cx="76" cy="119" r="1.8" fill="#ffffff" opacity="0.8"/>`

const EYE_HAPPY = `<path d="M66 114 q12 -13 24 0" stroke="${INKFACE}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`

const MOUTH_SMILE = `<path d="M58 138 q12 10 26 3" stroke="${INKFACE}" stroke-width="4" fill="none" stroke-linecap="round"/>`

const MOUTH_OPEN = `<path d="M58 138 C66 152 84 154 94 144 C88 140 66 138 58 138 Z" fill="${INKFACE}"/>`

const SPOUT = `<g>
    <path d="M136 44 C134 32 126 28 126 16" stroke="#7dd3fc" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M146 42 C148 32 154 28 154 18" stroke="#7dd3fc" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
    <circle cx="123" cy="10" r="4.5" fill="#bae6fd"/>
    <circle cx="157" cy="12" r="4" fill="#bae6fd"/>
    <circle cx="140" cy="5" r="5" fill="#7dd3fc"/>
  </g>`

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 250">${DEFS}${inner}</svg>`
}

/** Idle Blasty (open eye, smile, spout). */
export const WHALE_IDLE_SVG = svg(
  `${TAIL}${FIN_TOP}${BODY_SHAPE}${SHADING}${FLIPPER}${SPOUT}${EYE_OPEN}${BLUSH}${MOUTH_SMILE}`
)

/** Happy Blasty (^‿^ eye, open smile) — flying pose for the game. */
export const WHALE_HAPPY_SVG = svg(
  `${TAIL}${FIN_TOP}${BODY_SHAPE}${SHADING}${FLIPPER}${EYE_HAPPY}${BLUSH}${MOUTH_OPEN}`
)

/** Happy Blasty riding a rocket with flames. */
export const WHALE_ROCKET_SVG = svg(
  `<defs><linearGradient id="ghull" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs>
  <g transform="rotate(-8 160 204)">
    <path d="M240 186 C278 190 302 199 316 204 C302 209 278 218 240 222 Z" fill="#fb923c" opacity="0.9"/>
    <path d="M240 193 C268 196 288 200 300 204 C288 208 268 212 240 215 Z" fill="#fde047"/>
    <rect x="98" y="182" width="146" height="44" rx="22" fill="url(#ghull)"/>
    <rect x="98" y="182" width="146" height="15" rx="7.5" fill="#ffffff" opacity="0.6"/>
    <path d="M102 182 C76 189 62 197 55 204 C62 211 76 219 102 226 Z" fill="#ef4444"/>
    <path d="M230 184 C244 171 257 165 268 164 C262 175 258 183 255 191 Z" fill="#ef4444"/>
    <path d="M230 224 C244 237 257 243 268 244 C262 233 258 225 255 217 Z" fill="#ef4444"/>
    <rect x="198" y="183" width="6" height="42" fill="#94a3b8" opacity="0.7"/>
    <circle cx="150" cy="204" r="13" fill="#7dd3fc" stroke="#e2e8f0" stroke-width="5"/>
    <circle cx="146" cy="200" r="4" fill="#ffffff" opacity="0.8"/>
  </g>
  ${TAIL}${FIN_TOP}${BODY_SHAPE}${SHADING}${FLIPPER}${EYE_HAPPY}${BLUSH}${MOUTH_OPEN}`
)

/** Load an SVG string as a drawable Image (browser only). */
export function loadSprite(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`
  })
}
