import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from 'recharts';

interface EnergyCurveChartProps {
  curve: number[]; // 24 values
  currentHour: number;
}

interface TooltipPayloadItem {
  value: number;
  payload: { hour: number; energy: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm">
        <p className="text-slate-300">{payload[0].payload.hour}:00</p>
        <p className="text-indigo-400 font-bold">Energy: {payload[0].value.toFixed(1)}</p>
      </div>
    );
  }
  return null;
};

export default function EnergyCurveChart({ curve, currentHour }: EnergyCurveChartProps) {
  const data = curve.map((energy, hour) => ({ hour, energy }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(h: number) => (h % 3 === 0 ? `${h}:00` : '')}
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          x={currentHour}
          stroke="#a5b4fc"
          strokeDasharray="3 3"
          label={{ value: 'Now', fill: '#a5b4fc', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="energy"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#energyGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
