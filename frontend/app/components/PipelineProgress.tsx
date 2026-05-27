import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { CheckCircle2, CircleDashed, XCircle, Clock, Zap, ChefHat, ArrowLeft, TrendingUp, Sparkles, Package } from 'lucide-react'

export default function PipelineProgress() {
  const { session_id, pipeline_events, addEvent, setCartProposal, setScreen } = useStore()

  useEffect(() => {
    if (!session_id) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const evtSource = new EventSource(`${API_URL}/api/stream?session_id=${session_id}`);

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.stage === 'heartbeat') return;
      addEvent(data);

      if (data.stage === 'proposal_ready') {
        setCartProposal(data);
        setTimeout(() => setScreen('review'), 1500);
      }
    };

    return () => evtSource.close();
  }, [session_id, addEvent, setCartProposal, setScreen]);

  const stages = [
    { id: 'classify',        label: 'Classifying input',       icon: '🔍', accent: 'from-blue-500 to-blue-600' },
    { id: 'user_context',    label: 'Loading your preferences', icon: '👤', accent: 'from-violet-500 to-purple-600' },
    { id: 'extract',         label: 'Extracting content',      icon: '📄', accent: 'from-emerald-500 to-teal-500' },
    { id: 'understand',      label: 'Understanding recipe',    icon: '🧠', accent: 'from-purple-500 to-pink-500' },
    { id: 'validate_recipe', label: 'Validating recipe',       icon: '✅', accent: 'from-green-500 to-emerald-500' },
    { id: 'normalize',       label: 'Mapping ingredients',     icon: '📐', accent: 'from-amber-500 to-orange-500' },
    { id: 'search',          label: 'Searching Instamart',     icon: '🔎', accent: 'from-swiggy-500 to-orange-500' },
    { id: 'optimize',        label: 'Optimizing basket',       icon: '🛒', accent: 'from-indigo-500 to-violet-500' },
    { id: 'validate_cart',   label: 'Final validation',       icon: '🛡️', accent: 'from-teal-500 to-cyan-500' },
  ];

  const getStageEvent = (stageId: string) => {
    return pipeline_events.find(e => e.stage === stageId && e.status === 'done');
  };

  const getActiveStage = () => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (getStageEvent(stages[i].id)) {
        return i < stages.length - 1 ? stages[i+1].id : null;
      }
    }
    return stages[0].id;
  };

  const hasError = pipeline_events.some(e => e.stage === 'error');
  const errorMsg = pipeline_events.find(e => e.stage === 'error')?.message;
  const activeStage = getActiveStage();
  const completedCount = stages.filter(s => getStageEvent(s.id)).length;
  const progress = (completedCount / stages.length) * 100;

  const totalDuration = pipeline_events
    .filter(e => e.duration_ms)
    .reduce((sum: number, e: any) => sum + (e.duration_ms || 0), 0);

  const getSpeedRating = (ms: number) => {
    if (ms < 200) return { label: 'Instant', color: 'text-green-500', bg: 'bg-green-50' }
    if (ms < 1000) return { label: 'Fast', color: 'text-emerald-500', bg: 'bg-emerald-50' }
    if (ms < 3000) return { label: 'Normal', color: 'text-amber-500', bg: 'bg-amber-50' }
    return { label: 'Slow', color: 'text-red-400', bg: 'bg-red-50' }
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 animate-fade-in">
      {/* Progress Header Card */}
      <div className="swiggy-glass p-5 mb-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-swiggy/40 to-transparent" />
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-swiggy-500/10 rounded-full blur-3xl" />
        
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-swiggy-50 to-orange-100 dark:from-swiggy-500/20 dark:to-orange-500/20 rounded-2xl flex items-center justify-center shadow-lg">
                <ChefHat className="w-6 h-6 text-swiggy-500" />
              </div>
              {activeStage && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-dark-card animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark dark:text-white">Processing Recipe</h2>
              <p className="text-sm text-brand-muted dark:text-dark-muted">
                {completedCount}/{stages.length} nodes complete
                {completedCount === stages.length && ' — Ready!'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {totalDuration > 0 && (
              <div className="flex items-center gap-2 text-sm bg-white/60 dark:bg-dark-card/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-brand-border/40">
                <Clock className="w-4 h-4 text-swiggy-500" />
                <span className="font-semibold text-brand-dark dark:text-white">{(totalDuration / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative mt-5">
          <div className="w-full h-3 bg-brand-bg dark:bg-dark-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-swiggy-500 via-orange-500 to-swiggy-600 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white/30 to-transparent" />
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-mono text-brand-muted dark:text-dark-muted">0%</span>
            <span className="text-[10px] font-bold text-swiggy-500">{Math.round(progress)}%</span>
            <span className="text-[10px] font-mono text-brand-muted dark:text-dark-muted">100%</span>
          </div>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="swiggy-glass overflow-hidden">
        {stages.map((stage, idx) => {
          const event = getStageEvent(stage.id);
          const isActive = activeStage === stage.id;
          const isDone = !!event;
          const isLast = idx === stages.length - 1;
          const speed = event?.duration_ms !== undefined ? getSpeedRating(event.duration_ms) : null;

          return (
            <div
              key={stage.id}
              className={`px-5 py-4 flex items-start gap-4 transition-all duration-300 relative
                ${!isLast ? 'border-b border-brand-border/30 dark:border-dark-border' : ''}
                ${isActive ? 'bg-gradient-to-r from-swiggy-50/50 to-transparent dark:from-swiggy-500/10' : isDone ? 'bg-transparent' : 'opacity-40'}
              `}
            >
              {/* Stage Indicator */}
              <div className="mt-0.5 shrink-0 relative">
                {isDone ? (
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                ) : isActive ? (
                  <div className="w-8 h-8 bg-gradient-to-br from-swiggy-50 to-orange-100 dark:from-swiggy-500/30 dark:to-orange-500/30 rounded-full flex items-center justify-center relative">
                    <CircleDashed className="w-5 h-5 text-swiggy-500 animate-spin" />
                    <div className="absolute inset-0 rounded-full bg-swiggy-500/20 animate-ping" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-brand-bg dark:bg-dark-border rounded-full flex items-center justify-center">
                    <span className="text-lg">{stage.icon}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold ${
                    isActive ? 'text-swiggy-600 dark:text-swiggy-400' : isDone ? 'text-brand-dark dark:text-white' : 'text-brand-muted dark:text-dark-muted'
                  }`}>
                    {stage.label}
                  </h3>
                  {event?.duration_ms !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${speed?.bg} ${speed?.color}`}>
                        {speed?.label}
                      </span>
                      <span className="text-[11px] text-brand-muted dark:text-dark-muted flex items-center gap-1 tabular-nums">
                        <Zap className="w-3 h-3" />
                        {event.duration_ms < 1000 ? `${event.duration_ms}ms` : `${(event.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Active shimmer effect */}
                {isActive && !isDone && (
                  <div className="mt-3 h-2 w-full bg-gradient-to-r from-transparent via-swiggy/20 to-transparent rounded shimmer" />
                )}

                {/* Stage-specific metadata */}
                {isDone && stage.id === 'classify' && event?.input_type && (
                  <p className="text-xs text-brand-subtle dark:text-dark-subtle mt-2">
                    Detected <span className="font-semibold text-swiggy-600 dark:text-swiggy-400 capitalize">{event.input_type}</span> source
                  </p>
                )}
                {isDone && stage.id === 'extract' && (
                  <p className="text-xs text-brand-subtle dark:text-dark-subtle mt-2">
                    <span className="font-medium text-brand-dark dark:text-white">{event.word_count}</span> words extracted via 
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">{event.source}</span>
                  </p>
                )}
                {isDone && stage.id === 'understand' && (
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <span className="swiggy-badge bg-gradient-to-r from-swiggy-50 to-orange-50 text-swiggy-700 border-swiggy-200">
                      {event.recipe_name}
                    </span>
                    <span className="text-xs text-brand-muted dark:text-dark-muted">
                      {event.ingredient_count} ingredients • {Math.round((event.confidence || 0) * 100)}% confidence
                    </span>
                  </div>
                )}
                {isDone && stage.id === 'validate_recipe' && (
                  <div className="mt-2 flex items-center gap-3">
                    {event.passed ? (
                      <span className="swiggy-badge bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200">✓ Clean</span>
                    ) : (
                      <span className="swiggy-badge bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200">⚠ Issues Found</span>
                    )}
                    {event.repairs?.length > 0 && (
                      <span className="text-xs text-brand-muted dark:text-dark-muted">{event.repairs.length} auto-repaired</span>
                    )}
                  </div>
                )}
                {isDone && stage.id === 'normalize' && (
                  <p className="text-xs text-brand-subtle dark:text-dark-subtle mt-2">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{event.db_matched}</span>/{event.total} ingredients matched
                  </p>
                )}
                {isDone && stage.id === 'search' && (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="swiggy-badge bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200">
                      <Package className="w-3 h-3 mr-1" /> {event.found_count} found
                    </span>
                    {event.missing_count > 0 && (
                      <span className="swiggy-badge bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200">
                        {event.missing_count} missing
                      </span>
                    )}
                  </div>
                )}
                {isDone && stage.id === 'user_context' && (
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <span className="swiggy-badge bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border-violet-200">
                      {event.go_to_items || 0} go-to items
                    </span>
                    <span className="swiggy-badge bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border-violet-200">
                      {event.preferred_brands || 0} brand prefs
                    </span>
                  </div>
                )}
                {isDone && stage.id === 'optimize' && (
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    <span className="text-lg font-bold text-brand-dark dark:text-white">₹{event.cart_total}</span>
                    <span className="text-sm text-brand-subtle dark:text-dark-subtle">{event.item_count} items</span>
                    {event.pantry_skipped > 0 && (
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">🍳 {event.pantry_skipped} pantry</span>
                    )}
                    {event.avg_waste_pct !== undefined && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        event.avg_waste_pct > 30 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {event.avg_waste_pct}% waste
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Performance Summary */}
      {completedCount === stages.length && totalDuration > 0 && (
        <div className="swiggy-glass p-4 mt-4 flex items-center gap-4 animate-fade-in-up">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-bold text-brand-dark dark:text-white">Pipeline Complete!</p>
            <p className="text-xs text-brand-muted dark:text-dark-muted">
              {stages.length} nodes processed in {(totalDuration / 1000).toFixed(1)}s
              {' '}({(totalDuration / stages.length).toFixed(0)}ms avg per node)
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-swiggy-500 animate-pulse" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="swiggy-glass p-5 mt-4 border-2 border-red-200/50 bg-red-50/50 dark:bg-red-900/20 flex items-start gap-4 animate-slide-up">
          <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-grow">
            <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Pipeline Error</h4>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorMsg}</p>
            <button
              onClick={() => useStore.getState().setScreen('input')}
              className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="w-3 h-3" /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}