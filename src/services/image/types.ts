export type ImageGenerationStatus = 'mocked' | 'success' | 'failed'

export interface ImageSizeOption {
  id: string
  label: string
  width: number
  height: number
}

export interface ImageProviderCapabilities {
  /**
   * Discrete size presets the provider accepts. When omitted, the UI shows a
   * free-form width/height pair instead.
   */
  sizes?: ImageSizeOption[]
  /** If true, user can edit step count. */
  steps?: { min: number; max: number; default: number }
  /** Sampler choices, if applicable. */
  samplers?: string[]
  /** Quality / fidelity presets (e.g. DALL·E "standard" vs "hd"). */
  qualities?: Array<{ id: string; label: string }>
  /** How many images per generate call this provider supports. */
  maxBatch: number
  /** Settings keys this provider needs (read from settings store). */
  configFields?: Array<{
    key: string
    label: string
    type: 'string' | 'secret'
    placeholder?: string
    description?: string
  }>
}

export interface ImageGenerationParams {
  width: number
  height: number
  steps?: number
  sampler?: string
  quality?: string
  count?: number
  /** Free-form additional fields stored verbatim on the generation record. */
  [key: string]: unknown
}

export interface ImageGenerationInput {
  prompt: string
  params: ImageGenerationParams
}

export interface ImageGenerationItem {
  /** A data URL (`data:image/png;base64,...`) or remote URL. Stored verbatim. */
  imageData: string
  mimeType?: string
}

export interface ImageGenerationOutcome {
  providerId: string
  status: ImageGenerationStatus
  effectiveParams: Record<string, unknown>
  results: ImageGenerationItem[]
}

export interface ImageProvider {
  id: string
  label: string
  description?: string
  capabilities: ImageProviderCapabilities
  /** Default params used when the test bench loads this provider for the first time. */
  defaultParams: ImageGenerationParams
  generate: (input: ImageGenerationInput) => Promise<ImageGenerationOutcome>
}
