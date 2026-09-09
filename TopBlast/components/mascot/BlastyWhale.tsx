'use client'

/**
 * Blasty — the TopBlast whale. Pure inline SVG, theme-aware via CSS vars,
 * animated with cheap CSS keyframes (mobile-friendly, GPU transforms only).
 *
 * Built with layered shading clipped to the body silhouette so every theme
 * and size renders clean: gradient body, wavy cream belly, top light,
 * bottom ambient shade, glossy eye, soft blush, grounded shadow.
 *
 * Poses:
 *  - idle:    bobbing, blinking, occasional water spout, tail wag
 *  - happy:   ^‿^ eyes, open smile, sparkles — payouts, wins
 *  - sleep:   closed eyes + zZz — waiting for topup / empty pool
 *  - rocket:  riding a rocket, blasting off — celebrations
 */

import { useId } from 'react'

export type BlastyPose = 'idle' | 'happy' | 'sleep' | 'rocket'

interface BlastyWhaleProps {
  pose?: BlastyPose
  /** Width in px; height scales automatically. */
  size?: number
  className?: string
  /** Disable the ambient bob (e.g. when a parent animates position). */
  still?: boolean
  /** Hide the soft ground shadow (for overlays / flight). */
  noShadow?: boolean
}

/** Body silhouette — plump head-heavy blob, tapering right into the tail root. */
const BODY_PATH =
  'M40 138 C40 84 94 48 158 48 C214 48 250 72 258 106 C261 119 259 130 252 140 C244 158 222 172 196 178 C160 186 108 184 76 172 C52 163 40 152 40 138 Z'

/** Chunky two-lobe tail, root tucked behind the body's right edge. */
const TAIL_PATH =
  'M226 148 C247 140 259 124 263 102 C266 86 274 72 290 64 C287 80 286 92 290 100 C302 102 313 112 319 126 C306 132 294 132 284 127 C276 143 260 156 240 162 Z'

export function BlastyWhale({
  pose = 'idle',
  size = 160,
  className = '',
  still = false,
  noShadow = false,
}: BlastyWhaleProps) {
  const sleeping = pose === 'sleep'
  const happy = pose === 'happy'
  const rocket = pose === 'rocket'
  // Unique ids per instance — duplicate SVG ids break fills when one copy is hidden
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bodyId = `bw-body-${uid}`
  const bellyId = `bw-belly-${uid}`
  const flameId = `bw-flame-${uid}`
  const blushId = `bw-blush-${uid}`
  const clipId = `bw-clip-${uid}`
  const finId = `bw-fin-${uid}`

  return (
    <svg
      viewBox="0 0 320 250"
      width={size}
      height={(size * 250) / 320}
      className={className}
      role="img"
      aria-label={
        sleeping
          ? 'Blasty the whale, asleep'
          : rocket
            ? 'Blasty the whale, blasting off on a rocket'
            : 'Blasty the whale'
      }
    >
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="rgb(var(--tb-purple))" />
          <stop offset="70%" stopColor="rgb(var(--tb-purple-dark))" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id={bellyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf7ff" />
          <stop offset="100%" stopColor="#e4d9fb" />
        </linearGradient>
        <linearGradient id={finId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--tb-purple-dark))" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id={flameId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id={`${flameId}-hull`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id={blushId}>
          <stop offset="0%" stopColor="#fda4af" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {/* grounded ambient shadow */}
      {!noShadow && !rocket ? (
        <ellipse cx="158" cy="232" rx="96" ry="11" fill="rgb(var(--tb-ink))" opacity="0.1" />
      ) : null}

      <g className={still || rocket ? undefined : 'whale-bob'}>
        {rocket ? (
          <g transform="rotate(-8 160 204)">
            {/* exhaust flame (points backward, flickers) */}
            <g className="whale-flame">
              <path
                d="M240 186 C278 190 302 199 316 204 C302 209 278 218 240 222 Z"
                fill="#fb923c"
                opacity="0.9"
              />
              <path
                d="M240 193 C268 196 288 200 300 204 C288 208 268 212 240 215 Z"
                fill="#fde047"
              />
            </g>
            {/* hull */}
            <rect x="98" y="182" width="146" height="44" rx="22" fill={`url(#${flameId}-hull)`} />
            <rect x="98" y="182" width="146" height="15" rx="7.5" fill="#ffffff" opacity="0.6" />
            {/* nose cone (direction of travel) */}
            <path d="M102 182 C76 189 62 197 55 204 C62 211 76 219 102 226 Z" fill="#ef4444" />
            {/* tail fins */}
            <path d="M230 184 C244 171 257 165 268 164 C262 175 258 183 255 191 Z" fill="#ef4444" />
            <path d="M230 224 C244 237 257 243 268 244 C262 233 258 225 255 217 Z" fill="#ef4444" />
            {/* stripe + porthole */}
            <rect x="198" y="183" width="6" height="42" fill="#94a3b8" opacity="0.7" />
            <circle cx="150" cy="204" r="13" fill="#7dd3fc" stroke="#e2e8f0" strokeWidth="5" />
            <circle cx="146" cy="200" r="4" fill="#ffffff" opacity="0.8" />
          </g>
        ) : null}

        {/* tail (behind body) */}
        <g className={still || rocket ? undefined : 'whale-tail'}>
          <path d={TAIL_PATH} fill={`url(#${bodyId})`} />
          <path
            d="M240 158 C258 150 270 136 276 118 C278 132 272 148 258 158 Z"
            fill="#4c1d95"
            opacity="0.35"
          />
        </g>

        {/* dorsal fin (behind body top edge) */}
        <path
          d="M176 54 C180 38 194 30 210 34 C202 42 196 50 194 60 Z"
          fill={`url(#${finId})`}
        />

        {/* body */}
        <path d={BODY_PATH} fill={`url(#${bodyId})`} />

        {/* shading layers clipped to the silhouette */}
        <g clipPath={`url(#${clipId})`}>
          {/* bottom ambient shade */}
          <ellipse cx="180" cy="196" rx="170" ry="62" fill="#3b0764" opacity="0.28" />
          {/* cream belly with wavy top edge */}
          <path
            d="M24 154 C70 166 130 172 190 166 C224 162 248 152 262 142 L268 250 L16 250 Z"
            fill={`url(#${bellyId})`}
          />
          {/* belly pleats */}
          <path
            d="M40 168 C96 180 168 182 232 168"
            stroke="#c4b5fd"
            strokeOpacity="0.55"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M56 180 C110 190 172 190 224 180"
            stroke="#c4b5fd"
            strokeOpacity="0.4"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {/* soft top light */}
          <ellipse cx="118" cy="72" rx="112" ry="52" fill="#ffffff" opacity="0.16" />
          <ellipse cx="98" cy="62" rx="46" ry="22" fill="#ffffff" opacity="0.18" />
        </g>

        {/* side flipper */}
        <g>
          <path
            d="M138 152 C158 146 176 150 184 164 C172 176 152 176 138 166 C132 161 132 156 138 152 Z"
            fill={`url(#${finId})`}
          />
          <path
            d="M142 155 C158 151 170 154 177 162"
            stroke="#ffffff"
            strokeOpacity="0.18"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* water spout */}
        {!sleeping && !rocket ? (
          <g className="whale-spout">
            <path
              d="M136 44 C134 32 126 28 126 16"
              stroke="#7dd3fc"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M146 42 C148 32 154 28 154 18"
              stroke="#7dd3fc"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle cx="123" cy="10" r="4.5" fill="#bae6fd" />
            <circle cx="157" cy="12" r="4" fill="#bae6fd" />
            <circle cx="140" cy="5" r="5" fill="#7dd3fc" />
          </g>
        ) : null}

        {/* face */}
        {sleeping ? (
          <g>
            <path
              d="M70 116 q11 9 22 0"
              stroke="#2b2140"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            <text x="242" y="66" fontSize="28" fontWeight="700" fill="rgb(var(--tb-ink-3))" fontFamily="Inter, sans-serif">z</text>
            <text x="262" y="44" fontSize="20" fontWeight="700" fill="rgb(var(--tb-ink-3))" fontFamily="Inter, sans-serif">z</text>
            <text x="278" y="27" fontSize="14" fontWeight="700" fill="rgb(var(--tb-ink-3))" fontFamily="Inter, sans-serif">z</text>
          </g>
        ) : happy || rocket ? (
          <g>
            <path
              d="M66 114 q12 -13 24 0"
              stroke="#2b2140"
              strokeWidth="5.5"
              fill="none"
              strokeLinecap="round"
            />
            <g fill="rgb(var(--tb-gold))">
              <path d="M262 34 l3.4 9 9 3.4 -9 3.4 -3.4 9 -3.4 -9 -9 -3.4 9 -3.4 Z" />
              <path d="M34 58 l2.6 6.8 6.8 2.6 -6.8 2.6 -2.6 6.8 -2.6 -6.8 -6.8 -2.6 6.8 -2.6 Z" />
            </g>
          </g>
        ) : (
          <g className="whale-eye">
            <ellipse cx="80" cy="114" rx="11" ry="13" fill="#2b2140" />
            <circle cx="84" cy="109" r="4" fill="#ffffff" />
            <circle cx="76" cy="119" r="1.8" fill="#ffffff" opacity="0.8" />
          </g>
        )}

        {/* blush */}
        <circle cx="62" cy="136" r="11" fill={`url(#${blushId})`} />

        {/* mouth */}
        {happy || rocket ? (
          <path
            d="M58 138 C66 152 84 154 94 144 C88 140 66 138 58 138 Z"
            fill="#2b2140"
          />
        ) : sleeping ? (
          <path d="M62 140 q8 5 16 1" stroke="#2b2140" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M58 138 q12 10 26 3" stroke="#2b2140" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
      </g>
    </svg>
  )
}
