import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, RadialBarChart, RadialBar, Cell,
    CartesianGrid, Legend
} from 'recharts'

/* ─── Shared tooltip style ─── */
const TooltipStyle = {
    contentStyle: {
        background: 'rgba(12,13,14,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        fontSize: '12px',
        color: '#f5f5f7',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    },
    itemStyle: { color: '#a5b4fc' },
    labelStyle: { color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
}

const axisStyle = { fill: 'rgba(255,255,255,0.3)', fontSize: 11 }

/* ─── 1. Weekly Completion Bar Chart ─── */
export function WeeklyCompletionChart({ data }) {
    // data: [{day:'Mon', completion_rate:72}, ...]
    const chartData = data?.length
        ? data
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, completion_rate: 0 }))

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div className="chart-title">📅 Weekly Completion</div>
                <div className="chart-sub">Last 7 days task completion %</div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip
                        {...TooltipStyle}
                        formatter={(value) => [`${value}%`, 'Completion']}
                    />
                    <Bar dataKey="completion_rate" radius={[6, 6, 0, 0]} maxBarSize={36}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={index}
                                fill={
                                    entry.completion_rate >= 75 ? '#10b981'
                                        : entry.completion_rate >= 40 ? '#5e6ad2'
                                            : entry.completion_rate > 0 ? '#f59e0b'
                                                : 'rgba(255,255,255,0.06)'
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend">
                <span className="cl-dot" style={{ background: '#10b981' }} />On track
                <span className="cl-dot" style={{ background: '#5e6ad2' }} />Good
                <span className="cl-dot" style={{ background: '#f59e0b' }} />Needs work
            </div>
        </div>
    )
}

/* ─── 2. XP Progress Area Chart ─── */
export function XPAreaChart({ currentXP, levelInfo }) {
    // Build a simulated XP curve for the current level
    const levels = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6000, 9000]
    const currentLvl = levelInfo?.level || 1
    const start = levels[Math.max(0, currentLvl - 1)] || 0
    const end = levels[Math.min(currentLvl, levels.length - 1)] || 100
    const progress = Math.min(100, Math.round(((currentXP || 0) - start) / Math.max(1, end - start) * 100))

    // Generate 7 simulated data points showing XP climb
    const today = currentXP || 0
    const data = Array.from({ length: 7 }, (_, i) => ({
        day: ['6d', '5d', '4d', '3d', '2d', '1d', 'Now'][i],
        xp: Math.max(0, Math.round(today * (0.55 + i * 0.075))),
    }))

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div className="chart-title">⚡ XP Progress</div>
                <div className="chart-sub">
                    Level {levelInfo?.level || 1} · {levelInfo?.title || 'Newcomer'} · {progress}% to next
                </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5e6ad2" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#5e6ad2" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip {...TooltipStyle} formatter={(v) => [`${v} XP`, 'Experience']} />
                    <Area
                        type="monotone"
                        dataKey="xp"
                        stroke="#667eea"
                        strokeWidth={2}
                        fill="url(#xpGrad)"
                        dot={{ fill: '#667eea', r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#a5b4fc' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
            <div className="xp-level-bar">
                <div className="xp-bar-track">
                    <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="xp-label">{today} XP · {levelInfo?.xp_to_next || 0} to next level</span>
            </div>
        </div>
    )
}

/* ─── 3. Goal Progress Radial Chart ─── */
export function GoalRadialChart({ goals }) {
    if (!goals || goals.length === 0) return null

    const display = goals.slice(0, 5).map((g, i) => ({
        name: g.title?.length > 18 ? g.title.slice(0, 18) + '…' : g.title,
        value: g.progress || 0,
        fill: ['#667eea', '#f093fb', '#10b981', '#f59e0b', '#fb923c'][i % 5],
    }))

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div className="chart-title">🎯 Goal Progress</div>
                <div className="chart-sub">Completion % per active goal</div>
            </div>
            <div className="goal-radial-wrap">
                <ResponsiveContainer width="50%" height={180}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={display} startAngle={90} endAngle={-270}>
                        <RadialBar
                            background={{ fill: 'rgba(255,255,255,0.04)' }}
                            dataKey="value"
                            cornerRadius={4}
                        />
                        <Tooltip
                            {...TooltipStyle}
                            formatter={(v) => [`${v}%`, 'Progress']}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="goal-radial-legend">
                    {display.map((g, i) => (
                        <div key={i} className="grl-item">
                            <span className="grl-dot" style={{ background: g.fill }} />
                            <span className="grl-name">{g.name}</span>
                            <span className="grl-pct" style={{ color: g.fill }}>{g.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
