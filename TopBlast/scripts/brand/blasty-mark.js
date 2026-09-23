/**
 * Blasty as a standalone SVG string, sized for brand assets (viewBox 0 0 400 300).
 *
 * This is the "portrait" Blasty used on the icon / banner / OG image — rounder
 * and chunkier than the in-app sprite in lib/game/whaleSprites.ts, which has to
 * animate. Colours are Heritage Violet, literal so the markup can be
 * rasterised without a document.
 */
const LIME = '#9945FF'
const LIME_LIGHT = '#b478ff'
const LIME_MID = '#7A2FD4'
const LIME_DEEP = '#5b21b6'
const OLIVE = '#4c1d95'
const INK = '#2b2140'
const BELLY_TOP = '#fdf7ff'
const BELLY_BOT = '#e4d9fb'
const FOAM = '#cfe8ff'

/** @param {{spout?: boolean}} [opts] */
function blastyMark(opts = {}) {
  const spout = opts.spout !== false
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bBody" x1="0.15" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${LIME_LIGHT}"/>
      <stop offset="42%" stop-color="${LIME}"/>
      <stop offset="100%" stop-color="${LIME_MID}"/>
    </linearGradient>
    <linearGradient id="bTail" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${LIME_MID}"/>
      <stop offset="100%" stop-color="${LIME_DEEP}"/>
    </linearGradient>
    <linearGradient id="bBelly" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BELLY_TOP}"/>
      <stop offset="100%" stop-color="${BELLY_BOT}"/>
    </linearGradient>
    <radialGradient id="bGloss" cx="0.32" cy="0.22" r="0.5">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bBlush">
      <stop offset="0%" stop-color="#ff9d8a" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ff9d8a" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="bClip">
      <path d="M46 168 C46 106 104 66 178 66 C244 66 292 96 302 140 C306 158 303 174 294 188 C280 212 244 230 200 234 C136 240 78 224 56 198 C48 188 46 178 46 168 Z"/>
    </clipPath>
  </defs>

  <!-- Tail, drawn before the body so the peduncle tucks in behind it. The
       root starts well inside the silhouette (x~256) — start it at the body
       edge and the fluke reads as a detached leaf. -->
  <g>
    <path d="M256 176 C286 170 306 152 316 124 C322 104 336 86 358 76 C351 96 349 112 355 122 C369 126 383 140 389 158 C373 164 359 163 347 156 C337 176 315 194 288 202 C272 206 258 200 254 190 Z" fill="url(#bTail)"/>
    <path d="M292 194 C314 184 330 167 338 146 C340 164 332 182 314 194 Z" fill="${OLIVE}" opacity="0.3"/>
  </g>

  <!-- dorsal fin -->
  <path d="M204 70 C208 48 226 38 246 44 C235 54 228 62 226 76 Z" fill="url(#bTail)"/>

  <!-- body -->
  <path d="M46 168 C46 106 104 66 178 66 C244 66 292 96 302 140 C306 158 303 174 294 188 C280 212 244 230 200 234 C136 240 78 224 56 198 C48 188 46 178 46 168 Z" fill="url(#bBody)"/>

  <g clip-path="url(#bClip)">
    <!-- underside shade -->
    <ellipse cx="205" cy="252" rx="200" ry="84" fill="${OLIVE}" opacity="0.3"/>
    <!-- cream belly with a wavy top edge -->
    <path d="M22 196 C74 212 146 220 216 212 C256 207 286 195 302 183 L312 300 L14 300 Z" fill="url(#bBelly)"/>
    <!-- belly pleats -->
    <path d="M48 214 C112 230 196 232 268 214" stroke="${LIME_MID}" stroke-opacity="0.45" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M66 228 C128 240 200 240 258 228" stroke="${LIME_MID}" stroke-opacity="0.32" stroke-width="4" fill="none" stroke-linecap="round"/>
    <!-- top gloss -->
    <ellipse cx="140" cy="100" rx="130" ry="60" fill="url(#bGloss)"/>
  </g>

  <!-- pectoral fin -->
  <path d="M164 200 C188 192 210 197 220 214 C205 229 180 229 164 217 C157 211 157 205 164 200 Z" fill="url(#bTail)"/>
  <path d="M170 204 C188 199 202 203 210 212" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${spout ? `
  <!-- spout -->
  <path d="M158 62 C154 50 146 44 142 34" stroke="${FOAM}" stroke-width="11" fill="none" stroke-linecap="round" opacity="0.95"/>
  <path d="M172 60 C174 48 182 42 188 34" stroke="${FOAM}" stroke-width="11" fill="none" stroke-linecap="round" opacity="0.95"/>
  <path d="M165 58 L165 32" stroke="${FOAM}" stroke-width="11" fill="none" stroke-linecap="round" opacity="0.8"/>
  <circle cx="136" cy="24" r="7" fill="${FOAM}"/>
  <circle cx="194" cy="25" r="6.5" fill="${FOAM}"/>
  <circle cx="165" cy="18" r="7.5" fill="#ffffff" opacity="0.92"/>` : ''}

  <!-- face -->
  <ellipse cx="92" cy="142" rx="13" ry="16" fill="${INK}"/>
  <circle cx="97" cy="136" r="5" fill="#ffffff"/>
  <circle cx="87" cy="149" r="2.2" fill="#ffffff" opacity="0.85"/>
  <circle cx="70" cy="168" r="13" fill="url(#bBlush)"/>
  <path d="M66 172 q14 13 30 4" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`
}

if (typeof module !== 'undefined') module.exports = { blastyMark, LIME, LIME_LIGHT, LIME_MID, LIME_DEEP, OLIVE, INK }
