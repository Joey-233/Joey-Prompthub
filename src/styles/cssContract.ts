export interface LegacyRadius {
  selector: string
  radius: number
}

export function findLegacyRadii(
  css: string,
  allowedSelectors: ReadonlySet<string> = new Set()
): LegacyRadius[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const violations: LegacyRadius[] = []
  for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = block[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
    for (const declaration of block[2].split(';')) {
      const separator = declaration.indexOf(':')
      if (separator < 0 || declaration.slice(0, separator).trim().toLowerCase() !== 'border-radius')
        continue
      const value = declaration.slice(separator + 1)
      const radii = Array.from(
        value.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)px(?=\s|\/|!|$)/gi),
        (match) => Number(match[1])
      ).filter((radius) => radius > 12 && radius <= 32)
      for (const selector of selectors) {
        if (allowedSelectors.has(selector)) continue
        for (const radius of radii) violations.push({ selector, radius })
      }
    }
  }
  return violations
}
