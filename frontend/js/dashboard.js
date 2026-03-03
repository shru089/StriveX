// Dashboard — StriveX v3.0 (Secured)
// Features: Replan My Day, Ctrl+K Command Bar, Feasibility Ring, Focus Sessions, Heatmap, Milestones

// ============= SECURITY UTILITIES =============

/**
 * escapeHtml: Sanitizes user-supplied strings before injecting into DOM.
 * Prevents XSS when rendering goal titles, task names, etc.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Checks if the stored JWT token is still valid (not expired).
 * Returns false if expired, redirecting to login.
 */
function isTokenValid() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userEmail');
            return false;
        }
        return true;
    } catch (e) {
        localStorage.removeItem('authToken');
        return false;
    }
}

// ============= STATE =============
let dashboardData = null;
let todayTasks = [];
let focusSessionTaskId = null;
let focusSessionStart = null;
let focusTimerInterval = null;

// ============= INIT =============

document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard: check token existence AND validity (expiry)
    if (!isTokenValid()) {
        window.location.href = 'index.html';
        return;
    }
    await loadDashboard();
    setupEventListeners();
    updateDateTime();

    // Phase 8: Initial Social Stats
    updateSocialStats();
    setInterval(updateSocialStats, 30000); // Update every 30s

    // Phase 8: Behavioral Nudges
    checkGlobalNudges();
    setInterval(checkGlobalNudges, 60000); // Check every minute
});

async function loadDashboard() {
    try {
        const response = await apiRequest('/dashboard');
        if (response.ok) {
            dashboardData = response.data;
            renderDashboard();
        } else {
            showToast('Failed to load dashboard', 'error');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('An error occurred', 'error');
    }
}

function renderDashboard() {
    const { user, today_tasks, upcoming_tasks, deadline_risks, active_goals, feasibility, overall_feasibility, patterns } = dashboardData;

    // User info
    const userName = user.email.split('@')[0];
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userName;

    // XP Level Badge logic
    const levelNum = Math.floor((user.xp || 0) / 100) + 1;
    const levelTitle = user.level_title || "Newcomer";
    const levelEmojis = { 1: "🌱", 2: "🔥", 3: "⚡", 4: "🚀", 5: "👑" };
    const emoji = levelEmojis[levelNum] || "✨";

    const levelEl = document.getElementById('userLevel');
    if (levelEl) {
        levelEl.innerHTML = `<span class="level-badge">${emoji} ${levelTitle}</span>`;
    }

    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

    const goalsCount = active_goals ? active_goals.length : 0;
    const goalsCountEl = document.getElementById('activeGoalsCount');
    if (goalsCountEl) goalsCountEl.textContent = goalsCount;

    // POPULATE THE PULSE (God-Mode Upgrade)
    const pulseFocus = document.getElementById('pulseFocus');
    if (pulseFocus) {
        if (active_goals && active_goals.length > 0) {
            pulseFocus.textContent = active_goals[0].title;
        } else {
            pulseFocus.textContent = "No active focus";
        }
    }

    const pulseXP = document.getElementById('pulseXP');
    if (pulseXP) pulseXP.textContent = `${user.xp || 0} XP`;

    const pulseEff = document.getElementById('pulseEff');
    if (pulseEff) {
        // Simple efficiency heuristic: (completed / total)
        const ratio = patterns ? patterns.weekly_efficiency || 0 : 0;
        pulseEff.textContent = `${Math.round(ratio * 100)}%`;
    }

    const pulsePending = document.getElementById('pulsePending');
    if (pulsePending) {
        const pendingCount = (today_tasks || []).filter(t => t.status === 'pending').length;
        pulsePending.textContent = pendingCount;
    }

    // Update feasibility ring
    updateFeasibilityRing(overall_feasibility || 0);

    // Show consequence if any goal is at-risk
    if (feasibility && feasibility.length > 0) {
        const worstGoal = feasibility.reduce((prev, curr) =>
            curr.feasibility_score < prev.feasibility_score ? curr : prev
        );
        if (worstGoal.risk_level === 'HIGH' || worstGoal.risk_level === 'CRITICAL') {
            showConsequenceBanner(worstGoal.consequence, worstGoal.risk_level);
        }
    }

    renderDeadlineWarnings(deadline_risks);

    todayTasks = today_tasks || [];
    renderTimeline(todayTasks, upcoming_tasks);

    // Phase 8: Dynamic UI Patterns
    applyDynamicTheme(user);
}

function applyDynamicTheme(user) {
    const hour = new Date().getHours();
    const body = document.body;

    // Remove old themes
    body.classList.remove('theme-morning-peak', 'theme-twilight-rest', 'theme-neutral-focus');

    // Logic: 
    // Morning person + Morning hour => Peak
    // Night person + Night hour => Peak
    // Late night => Rest

    if (hour >= 23 || hour < 5) {
        body.classList.add('theme-twilight-rest');
    } else if (user.energy_type === 'morning' && hour >= 6 && hour <= 11) {
        body.classList.add('theme-morning-peak');
    } else if (user.energy_type === 'night' && hour >= 19 && hour <= 23) {
        body.classList.add('theme-morning-peak'); // Use peak styling for night peaks too
    } else {
        body.classList.add('theme-neutral-focus');
    }
}

async function updateSocialStats() {
    try {
        // Use API_URL from auth.js if available, but here it's hardcoded in the original script
        const response = await fetch('http://localhost:5001/api/stats/active-users');
        const data = await response.json();
        const badge = document.getElementById('socialBadge');
        if (badge && data.active_count) {
            badge.innerHTML = `<span class="pulse-dot"></span> ${data.active_count} Strivers Focused`;
            badge.style.display = 'flex';
        }
    } catch (e) { console.error('Social stats error', e); }
}

async function checkGlobalNudges() {
    try {
        const response = await apiRequest('/intelligence/nudges');
        if (response.ok && response.data && response.data.length > 0) {
            // Show only the highest priority nudge
            const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
            const topNudge = response.data.sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority])[0];

            // Avoid repeating same nudge too frequently
            const lastNudge = sessionStorage.getItem('lastNudge');
            if (lastNudge !== topNudge.message) {
                showAIModal(topNudge.message, topNudge.type);
                sessionStorage.setItem('lastNudge', topNudge.message);
            }
        }
    } catch (e) { console.error('Nudge error', e); }
}

function showAIModal(message, type) {
    // Premium AI Mentor Modal
    const modal = document.createElement('div');
    modal.className = `ai-mentor-modal ${type}`;
    modal.innerHTML = `
        <div class="ai-mentor-content">
            <div class="ai-avatar-glow">🤖</div>
            <div class="ai-message">
                <h4>AI Behavioral Mentor</h4>
                <p>${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ai-dismiss">Got it</button>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 100);
}

// ============= FEASIBILITY RING =============

function updateFeasibilityRing(percent) {
    const ringFill = document.getElementById('feasibilityRingFill');
    const percentEl = document.getElementById('feasibilityPercent');

    if (!ringFill || !percentEl) return;

    // SVG circle circumference for r=24: 2*π*24 ≈ 150.8
    const circumference = 150.8;
    const offset = circumference - (circumference * Math.max(0, Math.min(100, percent)) / 100);

    ringFill.style.strokeDashoffset = offset;

    percentEl.textContent = `${percent}%`;

    // Color code the ring
    const widget = document.getElementById('feasibilityWidget');
    if (percent >= 80) {
        ringFill.style.stroke = '#10b981';
        widget.classList.remove('risk-medium', 'risk-high', 'risk-critical');
        widget.classList.add('risk-low');
    } else if (percent >= 60) {
        ringFill.style.stroke = '#f59e0b';
        widget.classList.remove('risk-low', 'risk-high', 'risk-critical');
        widget.classList.add('risk-medium');
    } else if (percent >= 35) {
        ringFill.style.stroke = '#ef4444';
        widget.classList.remove('risk-low', 'risk-medium', 'risk-critical');
        widget.classList.add('risk-high');
    } else {
        ringFill.style.stroke = '#ec4899';
        widget.classList.remove('risk-low', 'risk-medium', 'risk-high');
        widget.classList.add('risk-critical');
    }
}

// ============= CONSEQUENCE BANNER =============

function showConsequenceBanner(text, riskLevel) {
    const banner = document.getElementById('consequenceBanner');
    const textEl = document.getElementById('consequenceText');
    if (!banner || !textEl) return;

    textEl.textContent = text;
    banner.style.display = 'flex';
    banner.className = `consequence-banner risk-${riskLevel.toLowerCase()}`;
}

function dismissConsequence() {
    const banner = document.getElementById('consequenceBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// ============= REPLAN MY DAY (PRD 5.3) =============

async function triggerReplan() {
    const btn = document.getElementById('replanBtn');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = '<span class="replan-icon">⚡</span><span>Replanning...</span>';
    }

    // Optimistic UI — show immediate feedback
    showToast('⚡ Replanning your day...', 'info');

    try {
        const response = await apiRequest('/tasks/replan', { method: 'POST' });

        if (response.ok) {
            const { summary, feasibility_percent, risk_level, consequence, moved, removed, pushed_to_tomorrow } = response.data;

            // Show result banner
            showReplanResult(summary, feasibility_percent, consequence);

            // Update feasibility ring
            updateFeasibilityRing(feasibility_percent);

            // Show consequence if needed
            if (risk_level === 'HIGH' || risk_level === 'CRITICAL') {
                showConsequenceBanner(consequence, risk_level);
            } else {
                dismissConsequence();
            }

            // Reload dashboard tasks
            await loadDashboard();

            showToast(`✅ ${summary}`, 'success');
        } else {
            showToast(response.data?.error || 'Replan failed', 'error');
        }
    } catch (error) {
        console.error('Replan error:', error);
        showToast('Could not replan — try again', 'error');
    } finally {
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = '<span class="replan-icon">⚡</span><span>Replan My Day</span>';
        }
    }
}

function showReplanResult(summary, percent, consequence) {
    const resultEl = document.getElementById('replanResult');
    if (!resultEl) return;

    resultEl.innerHTML = `
        <div class="replan-result-content">
            <span class="replan-result-icon">⚡</span>
            <div class="replan-result-text">
                <strong>${summary}</strong>
                ${consequence ? `<span class="replan-consequence">${consequence}</span>` : ''}
            </div>
            <button class="replan-result-close" onclick="document.getElementById('replanResult').style.display='none'">✕</button>
        </div>
    `;
    resultEl.style.display = 'block';

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        if (resultEl) resultEl.style.display = 'none';
    }, 8000);
}

// ============= COMMAND BAR (Ctrl+K, PRD 5.4) =============

function showCommandBar() {
    const overlay = document.getElementById('commandBar');
    if (overlay) {
        overlay.classList.add('active');
        document.getElementById('commandInput').focus();
        document.getElementById('commandResult').style.display = 'none';
        document.getElementById('commandSuggestions').style.display = 'block';
    }
}

function hideCommandBar() {
    const overlay = document.getElementById('commandBar');
    if (overlay) {
        overlay.classList.remove('active');
        document.getElementById('commandInput').value = '';
    }
}

function closeCommandBar(event) {
    if (event.target === document.getElementById('commandBar')) {
        hideCommandBar();
    }
}

function fillCommand(text) {
    const input = document.getElementById('commandInput');
    if (input) {
        input.value = text;
        input.focus();
    }
}

async function executeCommand() {
    const input = document.getElementById('commandInput');
    const command = input?.value?.trim();

    if (!command) return;

    const resultEl = document.getElementById('commandResult');
    const suggestionsEl = document.getElementById('commandSuggestions');

    if (resultEl) {
        resultEl.style.display = 'flex';
        resultEl.innerHTML = '<div class="command-loading">⚡ Processing...</div>';
    }
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    try {
        const response = await apiRequest('/nlp/parse', {
            method: 'POST',
            body: JSON.stringify({ command })
        });

        if (response.ok && response.data.success) {
            const { message, action } = response.data;

            if (resultEl) {
                resultEl.innerHTML = `
                    <div class="command-success">
                        <span class="cmd-success-icon">✅</span>
                        <div>
                            <div class="cmd-result-msg">${message}</div>
                            <div class="cmd-result-action">Action: ${action}</div>
                        </div>
                    </div>
                `;
            }

            // Reload dashboard after action
            setTimeout(async () => {
                await loadDashboard();
                if (action !== 'replan') {
                    setTimeout(hideCommandBar, 1000);
                }
            }, 500);

        } else {
            const errorData = response.data;
            const suggestions = errorData.suggestions || [];
            if (resultEl) {
                resultEl.innerHTML = `
                    <div class="command-error">
                        <span>❓ Not understood.</span>
                        ${suggestions.map(s => `<div class="cmd-suggestion-item">${s}</div>`).join('')}
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('NLP parse error:', error);
        if (resultEl) {
            resultEl.innerHTML = '<div class="command-error">⚠️ Could not process command.</div>';
        }
    }
}

// ============= VIEW MANAGEMENT =============

function switchView(viewId) {
    const views = ['dashboardView', 'goalsView', 'analyticsView'];
    views.forEach(id => {
        document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
    });

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    if (viewId === 'dashboardView') {
        document.getElementById('navDashboard')?.classList.add('active');
        document.getElementById('headerTitle').textContent = "Today's Schedule 🔥";
        renderDashboard();
    } else if (viewId === 'goalsView') {
        document.getElementById('navGoals')?.classList.add('active');
        document.getElementById('headerTitle').textContent = 'Your Goals 🎯';
        renderGoals();
    } else if (viewId === 'analyticsView') {
        document.getElementById('navAnalytics')?.classList.add('active');
        document.getElementById('headerTitle').textContent = 'Performance Analytics 📈';
        renderAnalytics();
    }
}

function showDashboardView() { switchView('dashboardView'); }
function showGoalsView() { switchView('goalsView'); }
function showAnalyticsView() { switchView('analyticsView'); }

// ============= GOALS VIEW =============

function renderGoals() {
    if (!dashboardData) return;
    const { active_goals, feasibility } = dashboardData;
    const grid = document.getElementById('goalsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!active_goals || active_goals.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <h3>No goals yet</h3>
                <p>Create your first goal to get an intelligent daily schedule.</p>
                <button class="btn-primary" onclick="showNewGoalModal()">Create First Goal</button>
            </div>
        `;
        return;
    }

    active_goals.forEach(goal => {
        // Use tasks_count from goal dict, or 0 if not available
        const completedTasks = goal.tasks_completed || 0;
        const totalTasks = goal.tasks_count || 0;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const feasData = feasibility ? feasibility.find(f => f.goal_id === goal.id) : null;
        const feasPercent = feasData ? feasData.feasibility_percent : null;
        const riskLevel = feasData ? feasData.risk_level : 'LOW';
        const consequence = feasData ? feasData.consequence : '';

        const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)));

        const card = `
            <div class="goal-card risk-${riskLevel.toLowerCase()}">
                <div class="goal-card-header">
                    <div class="goal-title">${goal.title}</div>
                    <span class="priority-badge priority-${goal.priority || 3}">P${goal.priority || 3}</span>
                </div>
                <div class="goal-meta">
                    <span>📅 ${daysLeft} days left</span>
                    <span>⏱ ${goal.estimated_hours || 0}h total</span>
                </div>
                <div class="goal-progress-row">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-label">${progress.toFixed(0)}% (${completedTasks}/${totalTasks})</span>
                </div>
                ${feasPercent !== null ? `
                <div class="goal-feasibility">
                    <div class="goal-feasibility-score risk-${riskLevel.toLowerCase()}">${feasPercent}% feasible</div>
                    <div class="goal-feasibility-msg">${consequence}</div>
                </div>` : ''}
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', card);
    });
}

// ============= ANALYTICS VIEW =============

async function renderAnalytics() {
    if (!dashboardData) return;
    const { user, patterns, overall_feasibility } = dashboardData;

    const analyticsStreakEl = document.getElementById('analyticsStreak');
    const analyticsFeasEl = document.getElementById('analyticsFeasibility');
    if (analyticsStreakEl) analyticsStreakEl.textContent = `${user.streak_count || 0} 🔥`;
    if (analyticsFeasEl) analyticsFeasEl.textContent = `${overall_feasibility || 0}%`;

    // Fetch real weekly data from API
    try {
        const weeklyResp = await apiRequest('/analytics/weekly');
        if (weeklyResp && weeklyResp.ok) {
            const { weekly_data, burnout_risk, burnout_message } = weeklyResp.data;

            // Burnout warning
            const burnoutEl = document.getElementById('burnoutWarning');
            if (burnout_risk && burnoutEl) {
                const burnoutMsg = document.getElementById('burnoutMsg');
                if (burnoutMsg) burnoutMsg.textContent = burnout_message || '';
                burnoutEl.style.display = 'flex';
            }

            if (weekly_data && weekly_data.length > 0) {
                // Average completion
                const avg = weekly_data.reduce((sum, d) => sum + d.completion_rate, 0) / weekly_data.length;
                const avgEl = document.getElementById('avgCompletion');
                if (avgEl) avgEl.textContent = `${Math.round(avg)}%`;

                // Render bar chart with real data
                renderWeeklyChart(weekly_data);
            } else {
                const chart = document.getElementById('weeklyChart');
                if (chart) chart.innerHTML = '<div class="chart-empty">No data for the last 7 days yet.</div>';
                const avgEl = document.getElementById('avgCompletion');
                if (avgEl) avgEl.textContent = '—%';
            }
        }
    } catch (e) {
        console.warn('Weekly analytics load failed', e);
    }

    // Fetch heatmap data
    try {
        const heatmapResp = await apiRequest('/analytics/heatmap');
        if (heatmapResp && heatmapResp.ok) {
            renderHeatmap(heatmapResp.data);
        }
    } catch (e) {
        console.warn('Heatmap load failed', e);
    }

    // Patterns — handle both array format and old dict format
    const patternsEl = document.getElementById('patternsSection');
    if (patternsEl) {
        let patternsList = [];
        if (Array.isArray(patterns)) {
            patternsList = patterns;
        } else if (patterns && patterns.patterns) {
            // Old detector format: {has_data, patterns: [...]}
            patternsList = patterns.patterns || [];
        }
        if (patternsList.length > 0) {
            patternsEl.innerHTML = `
                <h3 class="chart-title">Behavioral Patterns Detected</h3>
                <div class="patterns-list">
                    ${patternsList.map(p => `<div class="pattern-item">🚨 ${p}</div>`).join('')}
                </div>
            `;
        } else {
            patternsEl.innerHTML = `
                <h3 class="chart-title">Behavioral Patterns</h3>
                <div class="patterns-empty">
                    StriveX is still learning your work rhythm. Keep logging tasks to reveal insights.
                </div>
            `;
        }
    }
}

function renderWeeklyChart(weeklyData) {
    const chart = document.getElementById('weeklyChart');
    if (!chart) return;
    chart.innerHTML = '';

    const maxRate = 100;

    weeklyData.forEach(day => {
        const barGroup = document.createElement('div');
        barGroup.className = 'bar-group';

        const rate = day.completion_rate;
        const barColor = rate >= 70 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--danger)';

        barGroup.innerHTML = `
            <div class="bar-wrapper" title="${day.day}: ${rate}%">
                <div class="bar" style="height: ${Math.max(4, rate)}%; background: ${barColor};">
                    <span class="bar-value">${rate}%</span>
                </div>
            </div>
            <div class="bar-label">${day.day}</div>
        `;
        chart.appendChild(barGroup);
    });
}

function renderHeatmap(data) {
    const container = document.getElementById('heatmapContainer');
    if (!container || !data.heatmap) return;

    const days = data.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxVal = Math.max(1, ...data.heatmap.flat());

    let html = '<div class="heatmap-grid">';

    // Hour labels (every 3 hours)
    html += '<div class="heatmap-row heatmap-hour-labels"><div class="heatmap-day-label"></div>';
    for (let h = 0; h < 24; h += 3) {
        html += `<div class="hour-label">${h}:00</div>`;
    }
    html += '</div>';

    days.forEach((day, d) => {
        html += `<div class="heatmap-row"><div class="heatmap-day-label">${day}</div>`;
        for (let h = 0; h < 24; h++) {
            const count = data.heatmap[d][h] || 0;
            const intensity = Math.round((count / maxVal) * 4); // 0-4
            const tooltip = count > 0 ? `${day} ${h}:00 — ${count} resistance event${count > 1 ? 's' : ''}` : '';
            html += `<div class="heatmap-cell intensity-${intensity}" title="${tooltip}"></div>`;
        }
        html += '</div>';
    });

    html += '</div>';

    if (data.total_resistance_events === 0) {
        html = `<div class="heatmap-empty">
            <p>📊 No resistance data yet.</p>
            <p>Start tracking your tasks and patterns will appear here.</p>
        </div>`;
    }

    container.innerHTML = html;
}

// ============= TIMELINE =============

function renderDeadlineWarnings(risks) {
    const container = document.getElementById('deadlineWarnings');
    container.innerHTML = '';

    const highRisks = risks ? risks.filter(r => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL') : [];

    highRisks.forEach(risk => {
        container.insertAdjacentHTML('beforeend', `
            <div class="warning-banner">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                    <h3>${risk.goal_title}</h3>
                    <p>${risk.message}</p>
                </div>
                <button class="warning-replan-btn" onclick="triggerReplan()">⚡ Replan Now</button>
            </div>
        `);
    });
}

function renderTimeline(tasks, upcomingTasks = []) {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');
    if (!timeline) return;

    if ((!tasks || tasks.length === 0) && (!upcomingTasks || upcomingTasks.length === 0)) {
        timeline.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        updateTaskProgress(0, 0);
        return;
    }

    timeline.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    timeline.innerHTML = '';

    if (tasks && tasks.length > 0) {
        const sortedTasks = [...tasks].sort((a, b) =>
            (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '')
        );
        sortedTasks.forEach(task => {
            timeline.insertAdjacentHTML('beforeend', createTaskCard(task));
        });
        updateTaskProgress(tasks.filter(t => t.status === 'completed').length, tasks.length);
    } else if (upcomingTasks && upcomingTasks.length > 0) {
        // Show upcoming tasks with a separator
        timeline.innerHTML = `
            <div class="upcoming-indicator">
                <span>🗓 No tasks today. Starting soon:</span>
            </div>
        `;
        upcomingTasks.forEach(task => {
            const card = createTaskCard(task);
            // Add a date ribbon to upcoming tasks
            const dateStr = new Date(task.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const modifiedCard = card.replace('<div class="task-card', `<div class="task-card upcoming-card" data-date="${dateStr}"`);
            timeline.insertAdjacentHTML('beforeend', modifiedCard);
        });
        updateTaskProgress(0, 0);
    }
}

function createTaskCard(task) {
    const isCompleted = task.status === 'completed';
    const isSkipped = task.status === 'skipped';
    const isExpired = task.status === 'expired';
    const isBreak = task.title.toLowerCase().includes('break');
    const isGhost = task.is_ghost;
    const isFocused = focusSessionTaskId === task.id;

    const difficultyClass = task.difficulty ? `difficulty-${task.difficulty}` : '';
    let cardClass = '';
    if (isCompleted) cardClass = 'completed';
    else if (isSkipped || isExpired) cardClass = 'skipped';
    else if (isBreak) cardClass = 'break';
    else if (isGhost) cardClass = 'ghost';
    else if (isFocused) cardClass = 'focused';

    // Duration bar width (visual proportional to hours)
    const maxHours = 4;
    const barWidth = Math.min(100, (task.estimated_hours / maxHours) * 100);

    let statusBadge = '';
    if (isCompleted) statusBadge = '<span class="status-badge status-done">✅ Done</span>';
    else if (isSkipped) statusBadge = '<span class="status-badge status-skipped">⏭ Skipped</span>';
    else if (isExpired) statusBadge = '<span class="status-badge status-expired">⌛ Expired</span>';
    else if (isGhost) statusBadge = '<span class="status-badge status-ghost">👻 Ghost</span>';
    else if (isFocused) statusBadge = '<span class="status-badge status-focused pulse">🎯 Focusing</span>';

    const actionsHTML = (isCompleted || isSkipped || isExpired || isBreak) ? '' : `
        <div class="task-actions">
            <button class="task-btn btn-start" onclick="startFocusSession(${task.id})" ${isFocused ? 'disabled' : ''}>
                ${isFocused ? '🎯 Focusing' : '▶ Start'}
            </button>
            <button class="task-btn btn-complete" onclick="completeTask(${task.id})">✓ Done</button>
            <button class="task-btn btn-skip" onclick="skipTask(${task.id})">Skip</button>
            <button class="task-btn btn-ghost" onclick="toggleGhost(${task.id})" title="Toggle Ghost Mode">👻</button>
        </div>
    `;

    return `
        <div class="task-block" id="task-${task.id}">
            <div class="task-time">${task.scheduled_start_time || ''}</div>
            <div class="task-dot ${isCompleted ? 'dot-done' : ''}"></div>
            <div class="task-card ${cardClass}">
                <div class="task-header">
                    <div class="task-title">${task.title}</div>
                    <div class="task-badges">
                        ${task.difficulty && !isBreak ? `<span class="difficulty-badge ${difficultyClass}">L${task.difficulty}</span>` : ''}
                        ${statusBadge}
                    </div>
                </div>
                ${!isBreak ? `
                <div class="task-duration-bar">
                    <div class="task-duration-fill" style="width: ${barWidth}%"></div>
                </div>
                <div class="task-meta">
                    <span>⏱ ${task.scheduled_start_time} – ${task.scheduled_end_time}</span>
                    <span>💪 ${task.estimated_hours}h</span>
                    ${task.xp_value ? `<span>⭐ +${task.xp_value} XP</span>` : ''}
                </div>` : ''}
                ${actionsHTML}
            </div>
        </div>
    `;
}

function updateTaskProgress(completed, total) {
    const completedEl = document.getElementById('completedTasks');
    const totalEl = document.getElementById('totalTasks');
    const fill = document.getElementById('progressFill');
    if (completedEl) completedEl.textContent = completed;
    if (totalEl) totalEl.textContent = total;
    if (fill) fill.style.width = total > 0 ? `${(completed / total) * 100}%` : '0%';
}

// ============= FOCUS SESSION =============

function startFocusSession(taskId) {
    if (focusSessionTaskId) {
        showToast('Finish your current focus session first', 'info');
        return;
    }

    focusSessionTaskId = taskId;
    focusSessionStart = Date.now();

    // Log start event
    apiRequest(`/tasks/${taskId}/start`, { method: 'POST' });

    // Show timer badge
    const badge = document.getElementById('focusTimer');
    if (badge) badge.style.display = 'flex';

    // Start ticking
    focusTimerInterval = setInterval(updateFocusTimer, 1000);

    // Re-render to show focused state
    renderTimeline(todayTasks);
    showToast('🎯 Focus session started!', 'success');
}

function updateFocusTimer() {
    const elapsed = Date.now() - focusSessionStart;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const text = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const el = document.getElementById('focusTimerText');
    if (el) el.textContent = text;
}

function endFocusSession() {
    if (!focusSessionTaskId) return;

    clearInterval(focusTimerInterval);
    const taskId = focusSessionTaskId;
    focusSessionTaskId = null;
    focusSessionStart = null;

    const badge = document.getElementById('focusTimer');
    if (badge) badge.style.display = 'none';

    // Ask if completed
    if (confirm('Did you complete this task?')) {
        completeTask(taskId);
    } else {
        renderTimeline(todayTasks);
    }
}

// ============= TASK ACTIONS =============

async function completeTask(taskId) {
    try {
        const response = await apiRequest(`/tasks/${taskId}/complete`, { method: 'POST' });
        if (response.ok) {
            const { xp_earned, total_xp, streak } = response.data;
            showToast(`🎉 +${xp_earned} XP earned!`, 'success');
            document.getElementById('xpCount').textContent = total_xp;
            document.getElementById('streakCount').textContent = streak;

            if (focusSessionTaskId === taskId) endFocusSession();

            await loadDashboard();
            checkEndOfDay();
        } else {
            showToast('Failed to complete task', 'error');
        }
    } catch (error) {
        console.error('Complete task error:', error);
        showToast('An error occurred', 'error');
    }
}

async function skipTask(taskId) {
    if (!confirm('Skip this task? It will be logged for pattern analysis.')) return;

    try {
        const response = await apiRequest(`/tasks/${taskId}/skip`, { method: 'POST' });
        if (response.ok) {
            showToast('Task skipped', 'info');
            await loadDashboard();
        } else {
            showToast('Failed to skip task', 'error');
        }
    } catch (error) {
        showToast('An error occurred', 'error');
    }
}

async function toggleGhost(taskId) {
    try {
        const response = await apiRequest(`/tasks/${taskId}/ghost`, { method: 'POST' });
        if (response.ok) {
            const { is_ghost } = response.data;
            showToast(is_ghost ? '👻 Ghost mode on — task is now soft-scheduled' : '👻 Ghost mode off', 'info');
            await loadDashboard();
        }
    } catch (error) {
        showToast('Failed to toggle ghost mode', 'error');
    }
}

function checkEndOfDay() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 20) {
        const completedCount = todayTasks.filter(t => t.status === 'completed').length;
        if (completedCount > 0 && completedCount === todayTasks.length) {
            setTimeout(showEndOfDayModal, 2000);
        }
    }
}

// ============= MODALS =============

function showNewGoalModal() {
    document.getElementById('newGoalModal').style.display = 'block';
    // Set min date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('goalDeadline').min = tomorrow.toISOString().split('T')[0];

    // Setup live feasibility preview
    const dl = document.getElementById('goalDeadline');
    const hrs = document.getElementById('goalHours');
    if (dl && !dl.dataset.listener) {
        dl.addEventListener('change', updateGoalFeasibility);
        dl.dataset.listener = "true";
    }
    if (hrs && !hrs.dataset.listener) {
        hrs.addEventListener('input', updateGoalFeasibility);
        hrs.dataset.listener = "true";
    }
}

function updateGoalFeasibility() {
    const deadline = document.getElementById('goalDeadline').value;
    const hours = parseFloat(document.getElementById('goalHours').value);
    const container = document.getElementById('goalFeasibilityPreview');

    if (!deadline || !hours || hours <= 0 || !dashboardData) {
        if (container) container.style.display = 'none';
        return;
    }

    const today = new Date();
    const dlDate = new Date(deadline);
    const daysLeft = Math.max(1, Math.ceil((dlDate - today) / (86400000)));

    // Estimate free hours (using user profile if available, else default)
    // For dashboard, we can try to use the average free time from habits
    const freeHoursPerDay = 5; // Default average
    const totalAvailable = daysLeft * freeHoursPerDay;
    const score = Math.min(100, Math.round((totalAvailable / hours) * 100));

    let risk = 'low';
    let msg = 'Looks highly feasible! 🚀';
    if (score < 30) { risk = 'critical'; msg = 'Extremely tight. High risk of failure. 😱'; }
    else if (score < 55) { risk = 'high'; msg = 'Very challenging. Needs 100% consistency. ⚠️'; }
    else if (score < 75) { risk = 'medium'; msg = 'Manageable but tight. 😐'; }

    if (container) {
        container.style.display = 'block';
        container.innerHTML = `
            <div class="feasibility-preview-content risk-${risk}">
                <div class="feasibility-preview-score">${score}%</div>
                <div>
                    <div class="feasibility-preview-label">Live Feasibility Prediction</div>
                    <div class="feasibility-preview-msg">${msg}</div>
                </div>
            </div>
        `;
    }
}

function closeNewGoalModal() {
    document.getElementById('newGoalModal').style.display = 'none';
    document.getElementById('newGoalForm').reset();
    document.getElementById('goalFeasibilityPreview').style.display = 'none';
    document.getElementById('goalGenerating').style.display = 'none';
    const btn = document.getElementById('goalSubmitBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Goal & Generate Schedule →'; }
}

function showEndOfDayModal() {
    document.getElementById('endOfDayModal').style.display = 'block';
}

function closeEndOfDayModal() {
    document.getElementById('endOfDayModal').style.display = 'none';
    document.getElementById('endOfDayForm').reset();
}

function selectEnergy(level) {
    document.querySelectorAll('.energy-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.energy-btn[data-value="${level}"]`).classList.add('active');
    document.getElementById('energyLevel').value = level;
}

// ============= GOAL CREATION =============

async function handleNewGoal(e) {
    e.preventDefault();

    const btn = document.getElementById('goalSubmitBtn');
    const generating = document.getElementById('goalGenerating');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generating schedule...';
    }
    if (generating) generating.style.display = 'flex';

    const goalData = {
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        deadline: document.getElementById('goalDeadline').value,
        estimated_hours: parseFloat(document.getElementById('goalHours').value)
    };

    try {
        const response = await apiRequest('/goals', {
            method: 'POST',
            body: JSON.stringify(goalData)
        });

        if (response && response.ok) {
            const { feasibility_score, risk_level, consequence } = response.data;
            const percent = Math.round((feasibility_score || 1.0) * 100);

            // Update modal UI to show final feasibility before closing
            const preview = document.getElementById('goalFeasibilityPreview');
            if (preview) {
                preview.style.display = 'block';
                preview.innerHTML = `
                    <div class="feasibility-preview-content risk-${(risk_level || 'LOW').toLowerCase()}">
                        <div class="feasibility-preview-score">${percent}%</div>
                        <div>
                            <div class="feasibility-preview-label">Final Feasibility Score</div>
                            <div class="feasibility-preview-msg">${consequence || ''}</div>
                        </div>
                    </div>
                `;
            }

            showToast(`✅ Goal created! ${percent}% feasible`, 'success');

            setTimeout(async () => {
                closeNewGoalModal();
                await loadDashboard();
                showDashboardView();
            }, 1500);
        } else {
            const errorMsg = response && response.data ? (response.data.error || 'Failed to create goal') : 'Failed to create goal';
            showToast(errorMsg, 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Create Goal & Generate Schedule →';
            }
            if (generating) generating.style.display = 'none';
        }
    } catch (error) {
        console.error('New goal error:', error);
        showToast('An error occurred during goal creation', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Create Goal & Generate Schedule →';
        }
        if (generating) generating.style.display = 'none';
    }
}

// ============= END OF DAY =============

async function handleEndOfDaySubmit(e) {
    e.preventDefault();

    const screenTimeRadio = document.querySelector('input[name="screenTime"]:checked');
    const formData = {
        tasks_completed_percentage: parseInt(document.getElementById('completionSlider').value),
        screen_time_level: screenTimeRadio ? screenTimeRadio.value : 'Low',
        main_distraction: document.getElementById('distractionSelect').value,
        energy_level: parseInt(document.getElementById('energyLevel').value) || 3,
        skip_reason: document.getElementById('skipReason').value
    };

    try {
        const response = await apiRequest('/daily-log', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        if (response && response.ok) {
            const { adjustments } = response.data;
            closeEndOfDayModal();

            if (adjustments && adjustments.length > 0) {
                showToast(`📊 Tomorrow adjusted: ${adjustments[0]}`, 'info');
            } else {
                showToast('✅ Great work today! See you tomorrow 🚀', 'success');
            }

            await loadDashboard();
        } else {
            showToast('Failed to submit log', 'error');
        }
    } catch (error) {
        console.error('End of day submit error:', error);
        showToast('An error occurred', 'error');
    }
}

// ============= EVENT LISTENERS =============

function setupEventListeners() {
    // Slider
    const slider = document.getElementById('completionSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            document.getElementById('completionValue').textContent = e.target.value;
        });
    }

    // Close modal on backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('endOfDayModal')) closeEndOfDayModal();
        if (e.target === document.getElementById('newGoalModal')) closeNewGoalModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K / Cmd+K — Command bar
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showCommandBar();
        }
        // Escape — close command bar or modal
        if (e.key === 'Escape') {
            hideCommandBar();
            closeNewGoalModal();
            closeEndOfDayModal();
        }
        // Alt+G — New goal
        if (e.altKey && e.key === 'g') showNewGoalModal();
        // Alt+D — Dashboard
        if (e.altKey && e.key === 'd') showDashboardView();
        // Alt+R — Replan
        if (e.altKey && e.key === 'r') triggerReplan();
    });

    // Command bar Enter
    const cmdInput = document.getElementById('commandInput');
    if (cmdInput) {
        cmdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeCommand();
            }
        });
    }
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);
}

// ============= TRIGGER END OF DAY =============

function triggerEndOfDay() {
    showEndOfDayModal();
}

// ============= EXPOSE GLOBALS =============

window.triggerEndOfDay = triggerEndOfDay;
window.showNewGoalModal = showNewGoalModal;
window.showGoalsView = showGoalsView;
window.showAnalyticsView = showAnalyticsView;
window.showDashboardView = showDashboardView;
window.handleNewGoal = handleNewGoal;
window.handleEndOfDaySubmit = handleEndOfDaySubmit;
window.selectEnergy = selectEnergy;
window.logout = logout;
window.completeTask = completeTask;
window.skipTask = skipTask;
window.toggleGhost = toggleGhost;
window.startFocusSession = startFocusSession;
window.endFocusSession = endFocusSession;
window.triggerReplan = triggerReplan;
window.showCommandBar = showCommandBar;
window.hideCommandBar = hideCommandBar;
window.closeCommandBar = closeCommandBar;
window.executeCommand = executeCommand;
window.fillCommand = fillCommand;
window.dismissConsequence = dismissConsequence;
window.startVoiceRecognition = startVoiceRecognition;

// ============= VOICE COMMANDS (PHASE 8) =============

function startVoiceRecognition() {
    const btn = document.getElementById('voiceTrigger');
    if (!('webkitSpeechRecognition' in window)) {
        showToast('Voice recognition not supported in this browser', 'error');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    btn.classList.add('listening');
    btn.innerHTML = '🔴';
    showToast('Listening for your goal... (e.g. "Draft report by Friday, 5 hours")', 'info');

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        console.log('Voice result:', text);
        parseVoiceCommand(text);
    };

    recognition.onerror = (e) => {
        console.error('Voice error:', e);
        btn.classList.remove('listening');
        btn.innerHTML = '🎤';
    };

    recognition.onend = () => {
        btn.classList.remove('listening');
        btn.innerHTML = '🎤';
    };

    recognition.start();
}

function parseVoiceCommand(text) {
    // Basic NLP parsing for "Goal Name by [Day/Date], [Number] hours"
    text = text.toLowerCase();

    // 1. Extract Hours
    let hours = 5; // Default
    const hourMatch = text.match(/(\d+)\s*hours?/);
    if (hourMatch) hours = parseInt(hourMatch[1]);

    // 2. Extract Deadline (very basic mapping)
    const today = new Date();
    let deadline = new Date(today);
    deadline.setDate(today.getDate() + 7); // Default 1 week

    if (text.includes('tomorrow')) {
        deadline.setDate(today.getDate() + 1);
    } else if (text.includes('friday')) {
        const dayOffset = (5 - today.getDay() + 7) % 7 || 7;
        deadline.setDate(today.getDate() + dayOffset);
    } else if (text.includes('monday')) {
        const dayOffset = (1 - today.getDay() + 7) % 7 || 7;
        deadline.setDate(today.getDate() + dayOffset);
    }

    // 3. Extract Title (everything before "by" or "in")
    let title = text.replace(/by\s+.*|in\s+.*|\d+\s*hours?.*/g, '').trim();
    if (!title) title = "New Goal from Voice";

    // Fill form
    document.getElementById('goalTitle').value = title.charAt(0).toUpperCase() + title.slice(1);
    document.getElementById('goalHours').value = hours;
    document.getElementById('goalDeadline').value = deadline.toISOString().split('T')[0];

    showToast(`Parsed: "${title}"`, 'success');
}
