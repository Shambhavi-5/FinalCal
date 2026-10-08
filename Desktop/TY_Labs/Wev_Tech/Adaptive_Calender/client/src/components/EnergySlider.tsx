interface EnergySliderProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}

function energyColor(v: number): string {
  if (v <= 3) return 'text-red-400';
  if (v <= 6) return 'text-amber-400';
  return 'text-green-400';
}

function energyLabel(v: number): string {
  if (v <= 3) return 'Low energy';
  if (v <= 6) return 'Medium energy';
  return 'High energy';
}

export default function EnergySlider({ value, onChange, label }: EnergySliderProps) {
  return (
    <div className="flex flex-col items-center w-full gap-3">
      {label && (
        <label className="text-sm font-medium text-slate-300 self-start">
          {label}
        </label>
      )}
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label ?? 'Energy level'}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value}
        className="w-full h-3 rounded-full appearance-none cursor-pointer accent-indigo-500 bg-slate-700"
        style={{ minHeight: '44px' }}
      />
      <span className={`text-6xl font-bold leading-none ${energyColor(value)}`}>
        {value}
      </span>
      <span className="text-sm text-slate-400">{energyLabel(value)}</span>
    </div>
  );
}
