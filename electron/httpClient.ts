export interface JsonRequestOptions {
  timeoutMs?: number
  maxBytes?: number
  signal?: AbortSignal
  serviceLabel?: string
}

function statusMessage(status: number) {
  if (status === 401 || status === 403) return '认证失败，请检查 API Key 与账号权限'
  if (status === 404) return '接口或模型不存在，请检查 Base URL 与模型名'
  if (status === 408 || status === 504) return '服务响应超时，请稍后重试'
  if (status === 409) return '请求与服务当前状态冲突'
  if (status === 413) return '请求内容过大，请缩小图片或提示词'
  if (status === 429) return '请求过于频繁或额度不足，请稍后重试'
  if (status >= 500) return '服务暂时不可用，请稍后重试'
  return `服务拒绝了请求（HTTP ${status}）`
}

function combineAbortSignal(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const abort = () => controller.abort(external?.reason)
  external?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      external?.removeEventListener('abort', abort)
    }
  }
}

async function readLimitedBody(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > maxBytes) throw new Error('服务返回内容过大，已终止读取')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new Error('服务返回内容过大，已终止读取')
  return new TextDecoder().decode(bytes)
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options: JsonRequestOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 45_000
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024
  const combined = combineAbortSignal(options.signal, timeoutMs)
  const serviceLabel = options.serviceLabel ?? '远程服务'

  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: combined.signal
    })
    if (typeof response.arrayBuffer !== 'function') {
      if (!response.ok) throw new Error(`${serviceLabel}：${statusMessage(response.status)}`)
      const payload = await response.json()
      if (JSON.stringify(payload).length > maxBytes) throw new Error('服务返回内容过大，已终止读取')
      return payload as T
    }
    const text = await readLimitedBody(response, maxBytes)
    if (!response.ok) throw new Error(`${serviceLabel}：${statusMessage(response.status)}`)
    if (!text) throw new Error(`${serviceLabel}返回了空响应`)
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new Error(`${serviceLabel}返回格式不正确`, { cause: error })
    }
  } catch (error) {
    if (combined.signal.aborted) {
      if (options.signal?.aborted) throw new Error(`${serviceLabel}请求已取消`, { cause: error })
      throw new Error(`${serviceLabel}请求超时，请检查网络或稍后重试`, { cause: error })
    }
    if (error instanceof Error && !/^fetch failed$/i.test(error.message)) throw error
    throw new Error(`${serviceLabel}连接失败，请检查网络和 Base URL`, { cause: error })
  } finally {
    combined.dispose()
  }
}

export function validateServiceBaseUrl(raw: string, options: { allowLoopbackHttp?: boolean } = {}) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Base URL 格式不正确')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL 不能包含账号、查询参数或锚点')
  }
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(url.hostname)
  if (
    url.protocol !== 'https:' &&
    !(options.allowLoopbackHttp && loopback && url.protocol === 'http:')
  ) {
    throw new Error('远程服务必须使用 HTTPS；本机服务仅允许回环 HTTP 地址')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}
