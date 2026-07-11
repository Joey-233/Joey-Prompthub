import { AppFrame } from './components/layout/AppFrame'
import { useAppStore } from './stores/appStore'
import { Library } from './views/Library'
import { Seedance2 } from './views/Seedance2'
import { Settings } from './views/Settings'
import { TestBench } from './views/TestBench'

export default function App() {
  const currentView = useAppStore((state) => state.currentView)
  const titles = { library: '提示词库', 'test-bench': '测试台', seedance2: 'Seedance2', settings: '设置' }

  return (
    <AppFrame title={titles[currentView]}>
      {currentView === 'library' && <Library />}
      {currentView === 'test-bench' && <TestBench />}
      {currentView === 'seedance2' && <Seedance2 />}
      {currentView === 'settings' && <Settings />}
    </AppFrame>
  )
}
