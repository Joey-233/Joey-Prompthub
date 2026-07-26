/**
 * 把用户选择的图片文件读成压缩后的 data URL。
 *
 * 统一走 canvas 重编码（默认 JPEG）：
 * - 识图：控制 base64 体积，避免多模态请求超限
 * - 预览图：控制 SQLite 行大小，列表加载不被拖慢
 *
 * 注意：依赖 DOM 的 Image/canvas，仅在渲染进程使用；测试中应 mock 本模块。
 */

export interface ReadImageOptions {
  /** 长边像素上限，超出则等比缩小。 */
  maxDimension?: number
  /** 输出格式，默认 image/jpeg。 */
  mimeType?: string
  /** 0-1 压缩质量，仅对有损格式生效。 */
  quality?: number
}

export async function readImageFileAsDataUrl(
  file: File,
  options: ReadImageOptions = {}
): Promise<string> {
  const { maxDimension = 1024, mimeType = 'image/jpeg', quality = 0.85 } = options
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('仅支持 PNG、JPEG 或 WebP 图片')
  }
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
    throw new Error('图片文件必须小于 20 MB')
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    throw new Error('输出图片格式不受支持')
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片文件失败'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法解析图片内容，请确认文件是有效图片'))
    img.src = rawDataUrl
  })
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    image.width > 20_000 ||
    image.height > 20_000 ||
    image.width * image.height > 40_000_000
  ) {
    throw new Error('图片像素尺寸过大，请先缩小图片')
  }

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前环境无法安全压缩图片')
  }

  // JPEG 没有透明通道，先铺白底避免 PNG 透明区域变黑
  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(image, 0, 0, width, height)

  const result = canvas.toDataURL(mimeType, Math.max(0.1, Math.min(quality, 0.95)))
  if (result.length > 16 * 1024 * 1024) throw new Error('压缩后的图片仍然过大')
  return result
}
