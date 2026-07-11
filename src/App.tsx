import { AppFrame } from './components/layout/AppFrame'
import { useAppStore } from './stores/appStore'
import { Library } from './views/Library'
import { Seedance2 } from './views/Seedance2'
import { Settings } from './views/Settings'
import { TestBench } from './views/TestBench'

export default function App() {
  const currentView = useAppStore((state) => state.currentView)

  return (
    <AppFrame>
      {currentView === 'library' && <Library />}
      {currentView === 'test-bench' && <TestBench />}
      {currentView === 'seedance2' && <Seedance2 />}
      {currentView === 'settings' && <Settings />}
    </AppFrame>
  )
}
