import { useAppStore, type AppView } from '../../stores/appStore'

const destinations: Array<{ view: AppView; label: string; icon: string }> = [
  { view: 'library', label: '提示词库', icon: '库' },
  { view: 'seedance2', label: 'Seedance2', icon: 'S2' },
  { view: 'settings', label: '设置', icon: '设' }
]

export function NavRail() {
  const currentView = useAppStore((state) => state.currentView)
  const setCurrentView = useAppStore((state) => state.setCurrentView)

  return (
    <nav className="nav-rail" aria-label="主导航">
      <div className="nav-brand" aria-label="Joey Prompthub">
        PH
      </div>
      <div className="nav-destinations">
        {destinations.map(({ view, label, icon }) => (
          <button
            className="nav-rail-button"
            type="button"
            key={view}
            aria-label={label}
            aria-describedby={`nav-tooltip-${view}`}
            aria-current={currentView === view ? 'page' : undefined}
            onClick={() => setCurrentView(view)}
          >
            <span aria-hidden="true">{icon}</span>
            <span className="nav-rail-tooltip" id={`nav-tooltip-${view}`} role="tooltip">
              {label}
            </span>
          </button>
        ))}
      </div>
      <a
        className="nav-help"
        href="https://joeystudio.art"
        aria-label="帮助"
        target="_blank"
        rel="noreferrer"
      >
        ?
      </a>
    </nav>
  )
}
