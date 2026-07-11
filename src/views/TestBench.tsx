import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { GenerationGrid } from '../components/test-bench/GenerationGrid'
import { HistoryPanel } from '../components/test-bench/HistoryPanel'
import { PromptList } from '../components/test-bench/PromptList'
import { PromptWorkbench } from '../components/test-bench/PromptWorkbench'
import { GenerationSettingsPanel } from '../components/test-bench/GenerationSettingsPanel'
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import { useAppStore } from '../stores/appStore'
import { useTestBenchStore } from '../stores/testBenchStore'

export function TestBench() {
  const [activeCanvas, setActiveCanvas] = useState<'results' | 'history'>('results')
  const resultTabRef = useRef<HTMLButtonElement>(null)
  const historyTabRef = useRef<HTMLButtonElement>(null)
  const selectCanvas = (canvas: 'results' | 'history') => {
    setActiveCanvas(canvas)
    ;(canvas === 'results' ? resultTabRef : historyTabRef).current?.focus()
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: 'results' | 'history' | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = activeCanvas === 'results' ? 'history' : 'results'
    if (event.key === 'Home') next = 'results'
    if (event.key === 'End') next = 'history'
    if (next) { event.preventDefault(); selectCanvas(next) }
  }
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

  const resource = <PromptList
        prompts={prompts}
        selectedPromptId={selectedPromptId}
        onSelect={selectPrompt}
      />
  const main = <main className="test-bench-content" aria-label="生成结果">
        <PromptWorkbench
          content={draftContent}
          loading={loading}
          canSave={canSave}
          saveStatus={saveStatus}
          onContentChange={setDraftContent}
          onSave={() => void saveDraft()}
        />
        <div className="bench-canvas-tabs" role="tablist" aria-label="生成画布">
          <button ref={resultTabRef} id="bench-results-tab" role="tab" aria-controls="bench-canvas-panel" aria-selected={activeCanvas === 'results'} tabIndex={activeCanvas === 'results' ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => setActiveCanvas('results')}>本轮结果</button>
          <button ref={historyTabRef} id="bench-history-tab" role="tab" aria-controls="bench-canvas-panel" aria-selected={activeCanvas === 'history'} tabIndex={activeCanvas === 'history' ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => setActiveCanvas('history')}>历史记录</button>
        </div>
        <section id="bench-canvas-panel" className="bench-result-canvas" role="tabpanel" aria-labelledby={activeCanvas === 'results' ? 'bench-results-tab' : 'bench-history-tab'}>
        {generateError ? <div className="bench-error" role="alert"><span>{generateError}</span><button type="button" onClick={() => { setActiveCanvas('results'); void generate() }}>重试生成</button></div> : null}
        {activeCanvas === 'history' ? <HistoryPanel
          history={visibleHistory}
          prompts={prompts}
          scope={historyScope}
          onScopeChange={setHistoryScope}
          onRestore={(entryId) => { restoreHistoryEntry(entryId); setActiveCanvas('results') }}
        /> : <GenerationGrid results={results} />}
        </section>
      </main>
  const detail = <GenerationSettingsPanel content={draftContent} loading={loading} providerId={providerId} params={params} onProviderChange={setProviderId} onParamsChange={setParams} onGenerate={() => { setActiveCanvas('results'); void generate() }} />
  return <WorkspaceLayout resource={resource} resourceLabel="绘图提示词" main={main} detail={detail} detailLabel="生成参数" />
}
