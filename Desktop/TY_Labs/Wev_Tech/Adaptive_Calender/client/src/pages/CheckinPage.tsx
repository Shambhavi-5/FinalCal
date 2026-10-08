import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnergySlider from '../components/EnergySlider';
import TaskForm, { type TaskFormData } from '../components/TaskForm';
import { createCheckinApi } from '../api/checkins';
import { createTaskApi, deleteTaskApi } from '../api/tasks';
import { generateScheduleApi } from '../api/schedule';
import { apiFetch } from '../api/client';
import type { Task, FixedEvent } from '../types/index';

export default function CheckinPage() {
  const navigate = useNavigate();

  // Section 1 — Energy check-in
  const [energyLevel, setEnergyLevel] = useState(7);
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // Section 2 — Tasks
  const [tasksAdded, setTasksAdded] = useState<Task[]>([]);
  const [taskError, setTaskError] = useState('');

  // Section 3 — Fixed events
  const [fixedOpen, setFixedOpen] = useState(false);
  const [fixedTitle, setFixedTitle] = useState('');
  const [fixedStart, setFixedStart] = useState('');
  const [fixedEnd, setFixedEnd] = useState('');
  const [fixedEvents, setFixedEvents] = useState<FixedEvent[]>([]);
  const [fixedError, setFixedError] = useState('');

  // Section 4 — Generate
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // --- Section 1 handlers ---
  async function handleCheckin() {
    setCheckinLoading(true);
    try {
      await createCheckinApi({ level: energyLevel, context: 'DAILY_START' });
      setCheckinDone(true);
    } catch {
      // Non-fatal: still allow continuing
    } finally {
      setCheckinLoading(false);
    }
  }

  // --- Section 2 handlers ---
  async function handleAddTask(formData: TaskFormData) {
    setTaskError('');
    try {
      const res = await createTaskApi({
        ...formData,
        date: new Date().toISOString(),
      });
      setTasksAdded((prev) => [...prev, res.task]);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to add task');
    }
  }

  async function handleRemoveTask(id: string) {
    try {
      await deleteTaskApi(id);
      setTasksAdded((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // Best-effort removal — remove from UI regardless
      setTasksAdded((prev) => prev.filter((t) => t.id !== id));
    }
  }

  // --- Section 3 handlers ---
  async function handleAddFixed(e: React.FormEvent) {
    e.preventDefault();
    setFixedError('');
    try {
      const res = await apiFetch<{ fixedEvent: FixedEvent }>('/fixed-events', {
        method: 'POST',
        body: JSON.stringify({ title: fixedTitle, startTime: fixedStart, endTime: fixedEnd }),
      });
      setFixedEvents((prev) => [...prev, res.fixedEvent]);
      setFixedTitle('');
      setFixedStart('');
      setFixedEnd('');
    } catch (err) {
      setFixedError(err instanceof Error ? err.message : 'Failed to add event');
    }
  }

  // --- Section 4 handler ---
  async function handleGenerate() {
    setGenerateError('');
    setGenerateLoading(true);
    try {
      await generateScheduleApi(new Date().toISOString(), energyLevel);
      navigate('/calendar');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate schedule');
    } finally {
      setGenerateLoading(false);
    }
  }

  const inputClass =
    'bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* ── Section 1: Energy check-in ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">How&apos;s your energy right now?</h2>
        <EnergySlider value={energyLevel} onChange={setEnergyLevel} />
        <div className="mt-6">
          {checkinDone ? (
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <span className="text-xl" aria-hidden="true">✓</span>
              <span>Check-in saved!</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCheckin}
              disabled={checkinLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkinLoading ? 'Saving…' : 'Start my day'}
            </button>
          )}
        </div>
      </section>

      {/* ── Section 2: Add tasks ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">What&apos;s on your plate today?</h2>

        {/* Task-level error toast */}
        {taskError && (
          <div
            className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4 flex items-center justify-between"
            role="alert"
          >
            <span>{taskError}</span>
            <button
              type="button"
              onClick={() => setTaskError('')}
              className="ml-3 text-red-400 hover:text-red-200"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <TaskForm onAdd={handleAddTask} />

        {/* Task pills */}
        {tasksAdded.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2" aria-label="Added tasks">
            {tasksAdded.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              >
                <span className="flex-1 text-sm text-white truncate">{task.title}</span>
                <span className="text-xs text-slate-400 shrink-0">{task.durationMinutes}m</span>
                <span className="text-xs bg-indigo-900 text-indigo-300 rounded px-1.5 py-0.5 shrink-0">
                  ⚡ {task.estimatedEnergy}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTask(task.id)}
                  className="text-slate-500 hover:text-red-400 ml-1 shrink-0 text-lg leading-none"
                  aria-label={`Remove ${task.title}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Section 3: Fixed events (collapsible) ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <button
          type="button"
          onClick={() => setFixedOpen((o) => !o)}
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
        >
          {fixedOpen ? '− Hide fixed event form' : '+ Add fixed event'}
        </button>

        {fixedOpen && (
          <div className="mt-4">
            {fixedError && (
              <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4" role="alert">
                {fixedError}
              </div>
            )}
            <form onSubmit={handleAddFixed} className="flex flex-col gap-3">
              <div>
                <label htmlFor="fixed-title" className="block text-sm font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  id="fixed-title"
                  type="text"
                  required
                  className={inputClass}
                  placeholder="e.g. Math lecture"
                  value={fixedTitle}
                  onChange={(e) => setFixedTitle(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="fixed-start" className="block text-sm font-medium text-slate-300 mb-1">
                  Start
                </label>
                <input
                  id="fixed-start"
                  type="datetime-local"
                  required
                  className={inputClass}
                  value={fixedStart}
                  onChange={(e) => setFixedStart(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="fixed-end" className="block text-sm font-medium text-slate-300 mb-1">
                  End
                </label>
                <input
                  id="fixed-end"
                  type="datetime-local"
                  required
                  className={inputClass}
                  value={fixedEnd}
                  onChange={(e) => setFixedEnd(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                Add
              </button>
            </form>

            {fixedEvents.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2" aria-label="Fixed events">
                {fixedEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm" aria-hidden="true">🔒</span>
                    <span className="flex-1 text-sm text-white truncate">{ev.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── Section 4: Generate schedule ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {generateError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4" role="alert">
            {generateError}
          </div>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generateLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-4 text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generateLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Generating…
            </>
          ) : (
            'Generate my schedule →'
          )}
        </button>
      </section>
    </div>
  );
}
