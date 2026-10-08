import { useState } from 'react';
import EnergySlider from './EnergySlider';

export interface TaskFormData {
  title: string;
  type: string;
  durationMinutes: number;
  estimatedEnergy: number;
  priority: string;
  deadline?: string;
}

interface TaskFormProps {
  onAdd: (task: TaskFormData) => void;
  disabled?: boolean;
}

const TASK_TYPES = [
  { label: 'Deep Work', value: 'DEEP_WORK' },
  { label: 'Study', value: 'STUDY' },
  { label: 'Admin / Email', value: 'ADMIN' },
  { label: 'Creative', value: 'CREATIVE' },
  { label: 'Physical / Exercise', value: 'PHYSICAL' },
  { label: 'Meeting', value: 'MEETING' },
  { label: 'Other', value: 'OTHER' },
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

function emptyForm(): TaskFormData {
  return {
    title: '',
    type: 'DEEP_WORK',
    durationMinutes: 30,
    estimatedEnergy: 5,
    priority: 'MEDIUM',
    deadline: '',
  };
}

export default function TaskForm({ onAdd, disabled }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  function validate(): boolean {
    const next: Partial<Record<keyof TaskFormData, string>> = {};
    if (!form.title.trim()) next.title = 'Title is required.';
    if (form.durationMinutes < 5 || form.durationMinutes > 480) {
      next.durationMinutes = 'Duration must be between 5 and 480 minutes.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onAdd({
      ...form,
      deadline: form.deadline || undefined,
    });
    setForm(emptyForm());
    setErrors({});
  }

  const inputClass =
    'bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-3 py-2 w-full';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4"
      aria-label="Add task"
    >
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          type="text"
          className={inputClass}
          placeholder="e.g. Review lecture notes"
          value={form.title}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="task-type">
          Type
        </label>
        <select
          id="task-type"
          className={inputClass}
          value={form.type}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="task-duration">
          Duration (minutes)
        </label>
        <input
          id="task-duration"
          type="number"
          min={5}
          max={480}
          className={inputClass}
          value={form.durationMinutes}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
        />
        {errors.durationMinutes && (
          <p className="text-red-400 text-sm mt-1">{errors.durationMinutes}</p>
        )}
      </div>

      {/* Estimated energy */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Estimated Energy Required</p>
        <EnergySlider
          value={form.estimatedEnergy}
          onChange={(v) => setForm({ ...form, estimatedEnergy: v })}
          label={undefined}
        />
      </div>

      {/* Priority */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Priority</p>
        <div className="flex gap-2" role="group" aria-label="Priority">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => setForm({ ...form, priority: p })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.priority === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              aria-pressed={form.priority === p}
            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="task-deadline">
          Deadline <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          id="task-deadline"
          type="datetime-local"
          className={inputClass}
          value={form.deadline ?? ''}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
      >
        Add Task
      </button>
    </form>
  );
}
