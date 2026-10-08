import { useState, useEffect } from 'react';
import ScheduleTimeline from '../components/ScheduleTimeline';
import EnergyCurveChart from '../components/EnergyCurveChart';
import EnergySlider from '../components/EnergySlider';
import { getScheduleApi, generateScheduleApi } from '../api/schedule';
import { createCheckinApi } from '../api/checkins';
import type { ScheduleBlock, SchedulerWarning } from '../types/index';

const DEFAULT_CURVE = [5, 5, 5, 4, 4, 5, 6, 7, 8, 8, 7, 7, 6, 5, 5, 6, 6, 5, 5, 4, 4, 4, 4, 5];

interface ScheduleState {
  blocks: ScheduleBlock[];
  warnings: SchedulerWarning[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function CalendarPage() {
  const [schedule, setSchedule] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEnergyLevel, setNewEnergyLevel] = useState(7);
  const [modalLoading, setModalLoading] = useState(false);

  const today = new Date();
  const todayIso = today.toISOString();
  const currentHour = today.getHours();

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      try {
        const res = await getScheduleApi(todayIso);
        setSchedule({ blocks: res.blocks, warnings: [] });
      } catch {
        // No schedule yet — show empty state
        setSchedule({ blocks: [], warnings: [] });
      } finally {
        setLoading(false);
      }
    }
    void loadSchedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRecheckSave() {
    setModalLoading(true);
    try {
      await createCheckinApi({ level: newEnergyLevel, context: 'MANUAL' });
      const res = await generateScheduleApi(todayIso, newEnergyLevel);
      setSchedule({ blocks: res.blocks, warnings: res.warnings });
      setIsModalOpen(false);
    } catch {
      // Keep modal open; user can retry
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Date header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Today</h1>
        <p className="text-slate-400 mt-0.5">{formatDate(today)}</p>
      </div>

      {/* Energy curve card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-sm font-medium text-slate-300 mb-3">Your energy curve today</p>
        <EnergyCurveChart curve={DEFAULT_CURVE} currentHour={currentHour} />
      </div>

      {/* Warnings */}
      {schedule?.warnings.map((w, i) => (
        <div
          key={i}
          className="bg-amber-950 border border-amber-800 text-amber-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
          role="alert"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{w.message}</span>
        </div>
      ))}

      {/* Timeline skeleton / content */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading schedule">
          <div className="h-6 bg-slate-700 rounded w-3/4" />
          <div className="h-6 bg-slate-700 rounded w-1/2" />
          <div className="h-6 bg-slate-700 rounded w-5/6" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <ScheduleTimeline blocks={schedule?.blocks ?? []} />
        </div>
      )}

      {/* Re-check energy button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg px-4 py-2 text-sm transition-colors"
        >
          Re-check energy
        </button>
      </div>

      {/* Re-check modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recheck-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 id="recheck-title" className="text-lg font-semibold text-white mb-5">
              Re-check your energy
            </h2>
            <EnergySlider value={newEnergyLevel} onChange={setNewEnergyLevel} />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecheckSave}
                disabled={modalLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
