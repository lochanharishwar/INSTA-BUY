'use client'
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { Check, Loader2, Play, Flame, AlertCircle } from 'lucide-react'
import { getDialogue } from '../lib/hindi-dialogues'

export default function PipelineProgress() {
  const { session_id, pipeline_events, addEvent, setCartProposal, setScreen } = useStore()
  const [dialogue, setDialogue] = useState<{ text: string; movie: string; emoji: string } | null>(null)

  useEffect(() => {
    setDialogue(getDialogue('loading'))
  }, [])

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
    { id: 'classify',        label: 'Identifying recipe source' },
    { id: 'user_context',    label: 'Loading order history & pantry' },
    { id: 'extract',         label: 'Transcribing & reading recipe ingredients' },
    { id: 'understand',      label: 'Checking ingredient volumes' },
    { id: 'validate_recipe', label: 'Verifying portion matching logic' },
    { id: 'normalize',       label: 'Standardizing names for search' },
    { id: 'search',          label: 'Querying Swiggy Instamart inventory' },
    { id: 'optimize',        label: 'Optimizing unit sizes & minimizing waste' },
    { id: 'validate_cart',   label: 'Validating store address & prices' },
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
    <div className="max-w-xl mx-auto px-4 mt-6 animate-fade-up">
      {/* Dialogue Banner */}
      {dialogue && (
        <div className="hindi-banner mb-6 text-left flex items-center gap-3">
          <span className="text-2xl">{dialogue.emoji}</span>
          <div>
            <p className="font-semibold text-orange-950">"{dialogue.text}"</p>
            <p className="text-[10px] text-orange-800/60 mt-0.5">— {dialogue.movie}</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">AI Cooking Agent</span>
            </div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] mt-1.5">
              {completedCount === stages.length ? 'Cart is ready!' : 'Mapping recipe to Instamart...'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
              {completedCount} of {stages.length} pipeline steps completed
            </p>
          </div>
          {totalDuration > 0 && (
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-100 tabular-nums">
              {(totalDuration / 1000).toFixed(1)}s elapsed
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 relative h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="bg-white rounded-3xl border border-[var(--border-color)] p-4 shadow-sm space-y-1">
        {stages.map((stage, idx) => {
          const event = getStageEvent(stage.id);
          const isActive = activeStage === stage.id && !hasError;
          const isDone = !!event;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-orange-50/40 border border-orange-100/50'
                  : isDone
                  ? 'opacity-70'
                  : 'opacity-40'
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md shadow-green-500/10">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </div>
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-stone-200 bg-white" />
                )}
              </div>

              <div className="min-w-0">
                <span className={`text-xs block truncate ${
                  isActive ? 'font-bold text-[var(--text-primary)]' : 'font-semibold text-[var(--text-secondary)]'
                }`}>
                  {stage.label}
                </span>
              </div>

              {event?.duration_ms !== undefined && (
                <span className="ml-auto text-[10px] font-bold text-[var(--text-muted)] bg-stone-100 px-2 py-0.5 rounded tabular-nums">
                  {event.duration_ms < 1000 ? `${event.duration_ms}ms` : `${(event.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error Block */}
      {hasError && (
        <div className="mt-5 p-5 rounded-3xl bg-red-50 border border-red-100 text-red-800 animate-fade-in flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold">Failed to process recipe</p>
            <p className="text-xs text-red-700/90 mt-1 leading-relaxed">{errorMsg || 'Recipe link is invalid or the store is down.'}</p>
            <button
              onClick={() => useStore.getState().setScreen('input')}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
            >
              Try another recipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
