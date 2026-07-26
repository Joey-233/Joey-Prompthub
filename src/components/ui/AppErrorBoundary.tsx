import { Component, type ErrorInfo, type ReactNode } from 'react'

function ErrorFallback({ message }: { message: string }) {
  return (
    <main className="fatal-error" role="alert">
      <div className="fatal-error-panel">
        <h1>Joey Prompthub 无法继续运行</h1>
        <p>{message || '界面发生了未预期错误。'}</p>
        <button className="editor-action" type="button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    </main>
  )
}

export function StartupError({ error }: { error: unknown }) {
  return (
    <ErrorFallback
      message={error instanceof Error ? error.message : '应用启动失败，请重新启动。'}
    />
  )
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Joey Prompthub renderer crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) return <ErrorFallback message={this.state.error.message} />
    return this.props.children
  }
}
