import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { GenerationGrid } from '../components/test-bench/GenerationGrid'
import { HistoryPanel } from '../components/test-bench/HistoryPanel'
import { PromptList } from '../components/test-bench/PromptList'
import { PromptWorkbench } from '../components/test-bench/PromptWorkbench'
import { useAppStore } from '../stores/appStore'
import { useTestBenchStore } from '../stores/testBenchStore'

export function TestBench() {
  const {
    prompts,
    selectedPromptId,
    draftContent,
    providerId,
    params,
    results,
    history,
    loading,
    loadingPrompts,
    loadingHistory,
    historyScope,
    saveStatus,
    generateError,
    loadPrompts,
    loadHistory,
    selectPrompt,
    setDraftContent,
    setProviderId,
    setParams,
    setHistoryScope,
    restoreHistoryEntry,
    saveDraft,
    generate
  } = useTestBenchStore(
    useShallow((state) => ({
      prompts: state.prompts,
      selectedPromptId: state.selectedPromptId,
      draftContent: state.draftContent,
      providerId: state.providerId,
      params: state.params,
      results: state.results,
      history: state.history,
      loading: state.loading,
      loadingPrompts: state.loadingPrompts,
      loadingHistory: state.loadingHistory,
      historyScope: state.historyScope,
      saveStatus: state.saveStatus,
      generateError: state.generateError,
      loadPrompts: state.loadPrompts,
      loadHistory: state.loadHistory,
      selectPrompt: state.selectPrompt,
      setDraftContent: state.setDraftContent,
      setProviderId: state.setProviderId,
      setParams: state.setParams,
      setHistoryScope: state.setHistoryScope,
      restoreHistoryEntry: state.restoreHistoryEntry,
      saveDraft: state.saveDraft,
      generate: state.generate
    }))
  )

  const { pendingTestBenchPromptId, clearPendingTestBenchPromptId, setCurrentView } = useAppStore(
    useShallow((state) => ({
      pendingTestBenchPromptId: state.pendingTestBenchPromptId,
      clearPendingTestBenchPromptId: state.clearPendingTestBenchPromptId,
      setCurrentView: state.setCurrentView
    }))
  )

  useEffect(() => {
    void Promise.all([loadPrompts(pendingTestBenchPromptId), loadHistory()])
    if (pendingTestBenchPromptId) {
      clearPendingTestBenchPromptId()
    }
  }, [clearPendingTestBenchPromptId, loadHistory, loadPrompts, pendingTestBenchPromptId])

  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) ?? null
  const visibleHistory =
    historyScope === 'all' || !selectedPromptId
      ? history
      : history.filter((entry) => entry.promptId === selectedPromptId)
  const canSave = Boolean(
    selectedPrompt && selectedPrompt.content !== draftContent
  )

  if (loadingPrompts || loadingHistory) {
    return (
      <section className="test-bench-layout">
        <div className="empty-state bench-empty-state">正在加载测试台数据...</div>
      </section>
    )
  }

  if (prompts.length === 0 && history.length === 0) {
    return (
      <section className="test-bench-layout">
        <div className="empty-state bench-empty-state">
          <div className="empty-state-copy">
            <h2 className="view-title">还没有可测试的绘图提示词</h2>
            <p className="view-description">
              先去提示词库添加一条绘图提示词，再回来做临时调参和生成测试。
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCurrentView('library')}
            >
              去提示词库添加
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="test-bench-layout">
      <PromptList
        prompts={prompts}
        selectedPromptId={selectedPromptId}
        onSelect={selectPrompt}
      />
      <div className="test-bench-content">
        <header className="view-heading view-heading-compact">
          <span className="view-eyebrow">Prompt Lab</span>
          <div>
            <h2 className="view-title">测试台</h2>
            <p className="view-description">
              对绘图提示词做临时编辑和参数试跑，确认满意后再同步回提示词库。
            </p>
          </div>
        </header>
        <PromptWorkbench
          content={draftContent}
          loading={loading}
          canSave={canSave}
          saveStatus={saveStatus}
          providerId={providerId}
          params={params}
          generateError={generateError}
          onContentChange={setDraftContent}
          onProviderChange={setProviderId}
          onParamsChange={setParams}
          onSave={() => void saveDraft()}
          onGenerate={() => void generate()}
        />
        <HistoryPanel
          history={visibleHistory}
          prompts={prompts}
          scope={historyScope}
          onScopeChange={setHistoryScope}
          onRestore={restoreHistoryEntry}
        />
        <GenerationGrid results={results} />
      </div>
    </section>
  )
}
