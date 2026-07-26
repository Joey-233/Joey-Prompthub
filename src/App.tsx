import { lazy, Suspense } from 'react'

import { AppFrame } from './components/layout/AppFrame'
import { useAppStore } from './stores/appStore'

const Library = lazy(() =>
  import('./views/Library').then((module) => ({ default: module.Library }))
)
const Seedance2 = lazy(() =>
  import('./views/Seedance2').then((module) => ({ default: module.Seedance2 }))
)
const Settings = lazy(() =>
  import('./views/Settings').then((module) => ({ default: module.Settings }))
)

export default function App() {
  const currentView = useAppStore((state) => state.currentView)
  const titles = {
    library: '提示词库',
    seedance2: 'Seedance2',
    settings: '设置'
  }

  return (
    <AppFrame title={titles[currentView]}>
      <Suspense
        fallback={
          <div className="empty-state" role="status">
            正在加载工作区…
          </div>
        }
      >
        {currentView === 'library' && <Library />}
        {currentView === 'seedance2' && <Seedance2 />}
        {currentView === 'settings' && <Settings />}
      </Suspense>
    </AppFrame>
  )
}
