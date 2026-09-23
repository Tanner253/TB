/**
 * The help popover is 320px wide and hangs off a 16px icon that can sit
 * anywhere on a row. Anchoring it to either edge is not enough — at phone
 * width it fits on neither side of a mid-row icon — so the offset is clamped
 * to keep it inside the viewport. This is that clamp, isolated.
 */
function popoverOffset(iconLeft: number, viewportWidth: number, margin = 12): number {
  const panel = Math.min(320, viewportWidth - margin * 2)
  const clamped = Math.min(Math.max(margin, iconLeft), viewportWidth - panel - margin)
  return Math.round(clamped - iconLeft)
}

function resultingBox(iconLeft: number, viewportWidth: number, margin = 12) {
  const panel = Math.min(320, viewportWidth - margin * 2)
  const left = iconLeft + popoverOffset(iconLeft, viewportWidth, margin)
  return { left, right: left + panel, panel }
}

describe('help popover placement', () => {
  const widths = [320, 375, 414, 768, 1280]

  it('never leaves the viewport, wherever the icon sits', () => {
    for (const vw of widths) {
      for (let iconLeft = 0; iconLeft <= vw - 16; iconLeft += 7) {
        const { left, right } = resultingBox(iconLeft, vw)
        expect(left).toBeGreaterThanOrEqual(0)
        expect(right).toBeLessThanOrEqual(vw)
      }
    }
  })

  it('shrinks the panel rather than overflowing a narrow screen', () => {
    expect(resultingBox(10, 320).panel).toBe(296)
    expect(resultingBox(10, 1280).panel).toBe(320)
  })

  it('does not move the panel when there is room to the right', () => {
    expect(popoverOffset(40, 1280)).toBe(0)
  })

  it('pulls the panel left when the icon is near the right edge', () => {
    expect(popoverOffset(360, 375)).toBeLessThan(0)
    expect(resultingBox(360, 375).right).toBeLessThanOrEqual(375)
  })

  it('pushes the panel right when the icon is hard against the left edge', () => {
    expect(popoverOffset(0, 375)).toBeGreaterThan(0)
    expect(resultingBox(0, 375).left).toBeGreaterThanOrEqual(0)
  })
})
