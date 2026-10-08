import { useState } from 'react';
import type { ScheduleBlock } from '../types/index';

interface ScheduleTimelineProps {
  blocks: ScheduleBlock[];
}

function durationMins(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function taskBlockStyle(energy: number | undefined): string {
  const e = energy ?? 5;
  if (e <= 3) return 'bg-red-950 border-red-800';
  if (e <= 6) return 'bg-amber-950 border-amber-800';
  return 'bg-green-950 border-green-800';
}

function taskTypeLabel(type: string): string {
  return type.replace(/_/g, ' ');
}

export default function ScheduleTimeline({ blocks }: ScheduleTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (blocks.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-5xl mb-4">📅</p>
        <p className="text-lg">No schedule yet</p>
        <p className="text-sm mt-1">Complete your check-in to generate one</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-0">
      {/* Vertical connecting line */}
      <div className="absolute left-16 top-0 bottom-0 w-px bg-slate-700" aria-hidden="true" />

      {blocks.map((block) => {
        const mins = durationMins(block.startTime, block.endTime);
        const isExpanded = expandedId === block.id;

        return (
          <div key={block.id} className="flex gap-4 items-start py-2">
            {/* Time column */}
            <div className="w-16 text-right text-slate-500 text-sm pt-3 shrink-0">
              {fmtTime(block.startTime)}
            </div>

            {/* Block pill */}
            <div className="flex-1 min-w-0 ml-2">
              {block.kind === 'FIXED' && (
                <div className="border bg-slate-700 border-slate-600 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span aria-hidden="true">🔒</span>
                  <span className="font-medium text-sm text-white truncate">
                    {block.fixedEvent?.title ?? 'Fixed event'}
                  </span>
                  <span className="ml-auto text-xs text-slate-400 shrink-0">{mins}m</span>
                </div>
              )}

              {block.kind === 'TASK' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : block.id)}
                    aria-expanded={isExpanded}
                    aria-label={`Toggle details for ${block.task?.title ?? 'task'}`}
                    className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${taskBlockStyle(
                      block.task?.estimatedEnergy,
                    )}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white truncate flex-1">
                        {block.task?.title ?? 'Task'}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{mins}m</span>
                      {block.task?.estimatedEnergy !== undefined && (
                        <span className="text-xs bg-slate-900/60 rounded px-1.5 py-0.5 shrink-0">
                          ⚡ {block.task.estimatedEnergy}
                        </span>
                      )}
                      {block.task?.type && (
                        <span className="text-xs bg-slate-900/60 text-slate-300 rounded px-1.5 py-0.5 shrink-0 uppercase tracking-wide">
                          {taskTypeLabel(block.task.type)}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && block.task && (
                    <div className="mt-1 border border-slate-700 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 flex flex-col gap-1">
                      <p>
                        <span className="text-slate-500">Type: </span>
                        {taskTypeLabel(block.task.type)}
                      </p>
                      <p>
                        <span className="text-slate-500">Priority: </span>
                        {block.task.priority}
                      </p>
                      {block.task.deadline && (
                        <p>
                          <span className="text-slate-500">Deadline: </span>
                          {new Date(block.task.deadline).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {block.kind === 'BREAK' && (
                <div className="border bg-teal-950 border-teal-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span aria-hidden="true">☕</span>
                  <span className="font-medium text-sm text-teal-200 truncate">
                    {block.breakType ?? 'Break'}
                  </span>
                  <span className="ml-auto text-xs text-teal-400 shrink-0">{mins}m</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
