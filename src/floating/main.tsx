import { mountFloatingBall } from './floatingBallUi'
import '../index.css'

const rootElement = document.getElementById('floating-root')

if (!rootElement) {
  throw new Error('Floating root element not found')
}

if (!window.promptHubFloating) {
  rootElement.innerHTML =
    '<main class="fatal-error" role="alert"><div class="fatal-error-panel"><h1>Joey Prompthub 浮球启动失败</h1><p>安全桥接加载失败，请重新启动应用。</p></div></main>'
} else {
  mountFloatingBall(rootElement, window.promptHubFloating)
}
