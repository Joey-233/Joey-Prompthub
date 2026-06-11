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

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    // canvas 不可用时退回原始数据（极少见，如禁用硬件加速的特殊环境）
    return rawDataUrl
  }

  // JPEG 没有透明通道，先铺白底避免 PNG 透明区域变黑
  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL(mimeType, quality)
}
