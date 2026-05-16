import type {
  ImageGenerationInput,
  ImageGenerationOutcome,
  ImageProvider
} from './types'
import { mockImageProvider } from './mockImageProvider'
import { openaiImageProvider } from './openaiImageProvider'
import { sdWebuiProvider } from './sdWebuiProvider'

const REGISTERED: ImageProvider[] = [
  openaiImageProvider,
  sdWebuiProvider,
  mockImageProvider
]

export const imageProviders = REGISTERED.map((provider) => ({
  id: provider.id,
  label: provider.label
}))

export function listImageProviders(): ImageProvider[] {
  return REGISTERED
}

export function getImageProvider(id: string): ImageProvider | undefined {
  return REGISTERED.find((provider) => provider.id === id)
}

export function getImageProviderOrFallback(id: string | undefined): ImageProvider {
  return getImageProvider(id ?? '') ?? REGISTERED[0]
}

export async function generateWithProvider(
  providerId: string,
  input: ImageGenerationInput
): Promise<ImageGenerationOutcome> {
  const provider = getImageProvider(providerId)
  if (!provider) {
    throw new Error(`未知的图像 provider: ${providerId}`)
  }
  return provider.generate(input)
}
