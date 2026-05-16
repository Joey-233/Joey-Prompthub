import { AppFrame } from './components/layout/AppFrame'
import { useAppStore } from './stores/appStore'
import { Library } from './views/Library'
import { Settings } from './views/Settings'
import { TestBench } from './views/TestBench'

export default function App() {
  const currentView = useAppStore((state) => state.currentView)

  return (
    <AppFrame>
      {currentView === 'library' && <Library />}
      {currentView === 'test-bench' && <TestBench />}
      {currentView === 'settings' && <Settings />}
    </AppFrame>
  )
}
