import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { Check, Loader2 } from 'lucide-react'

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
        setTimeout(() => setScreen('review'), 1000);
      }
    };

    return () => evtSource.close();
  }, [session_id, addEvent, setCartProposal, setScreen]);

  const stages = [
    { id: 'classify',        label: 'Identifying recipe' },
    { id: 'user_context',    label: 'Loading preferences' },
    { id: 'extract',         label: 'Reading the recipe' },
    { id: 'understand',      label: 'Checking ingredients' },
    { id: 'validate_recipe', label: 'Verifying the list' },
    { id: 'normalize',       label: 'Matching products' },
    { id: 'search',          label: 'Finding in store' },
    { id: 'optimize',        label: 'Picking the best' },
    { id: 'validate_cart',   label: 'Final check' },
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

  return (
    <div className="max-w-lg mx-auto mt-10 animate-fade-in">
      {/* Header */}
      <div className="swiggy-card p-6 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {completedCount === stages.length ? 'Ready to order' : 'Gathering ingredients'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {completedCount} of {stages.length} steps complete
            </p>
          </div>
          {totalDuration > 0 && (
            <span className="text-sm text-[var(--text-muted)] tabular-nums">
              {(totalDuration / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 relative h-1.5 bg-sand-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-2">
        {stages.map((stage) => {
          const event = getStageEvent(stage.id);
          const isActive = activeStage === stage.id;
          const isDone = !!event;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-sand-50 border border-sand-200'
                  : isDone
                  ? 'opacity-60'
                  : 'opacity-40'
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-sand-300" />
                )}
              </div>

              <span className={`text-sm ${
                isActive ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}>
                {stage.label}
              </span>

              {event?.duration_ms !== undefined && (
                <span className="ml-auto text-xs text-[var(--text-muted)] tabular-nums">
                  {event.duration_ms < 1000 ? `${event.duration_ms}ms` : `${(event.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {hasError && (
        <div className="mt-5 p-5 rounded-2xl bg-red-50 border border-red-100 text-red-800">
          <p className="text-sm font-medium">Something went wrong</p>
          <p className="text-xs mt-1">{errorMsg}</p>
          <button
            onClick={() => useStore.getState().setScreen('input')}
            className="mt-3 text-xs font-medium underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
