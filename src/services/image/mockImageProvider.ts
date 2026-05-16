import type {
  ImageGenerationInput,
  ImageGenerationOutcome,
  ImageProvider
} from './types'

function buildPlaceholderDataUrl(label: string, hue: number) {
  // Inline SVG → data URL. Avoids any network or canvas dependency in tests.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 70%, 75%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360}, 60%, 55%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="50%" font-family="Inter,Segoe UI,sans-serif" font-size="32"
        text-anchor="middle" dominant-baseline="middle" fill="rgba(20,20,20,0.85)">
    ${label}
  </text>
</svg>`
  // btoa is available in modern browsers and Node 18+, both of which are
  // the only environments this code runs in (Electron renderer + jsdom tests).
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const mockImageProvider: ImageProvider = {
  id: 'mock-image',
  label: 'Mock Provider',
  description: '本地占位 provider，不调任何外部服务，用于先把流程串起来。',
  capabilities: {
    sizes: [
      { id: '512x512', label: '512×512', width: 512, height: 512 },
      { id: '768x512', label: '768×512', width: 768, height: 512 },
      { id: '512x768', label: '512×768', width: 512, height: 768 }
    ],
    maxBatch: 4
  },
  defaultParams: {
    width: 512,
    height: 512,
    count: 3
  },
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutcome> {
    const count = Math.max(1, Math.min(input.params.count ?? 3, 4))
    const baseHue = (input.prompt.length * 23) % 360

    return {
      providerId: 'mock-image',
      status: 'mocked',
      effectiveParams: {
        width: input.params.width,
        height: input.params.height,
        count,
        promptLength: input.prompt.length
      },
      results: Array.from({ length: count }, (_, index) => ({
        imageData: buildPlaceholderDataUrl(`Mock ${index + 1}`, (baseHue + index * 40) % 360),
        mimeType: 'image/svg+xml'
      }))
    }
  }
}
