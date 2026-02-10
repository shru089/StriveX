// Dashboard functionality
requireAuth();

let dashboardData = null;
let todayTasks = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await loadDashboard();
    setupEventListeners();
    updateDateTime();
});

async function loadDashboard() {
    try {
        const response = await apiRequest('/dashboard');

        if (response.ok) {
            dashboardData = response.data;
            renderDashboard();
            // Automatically refresh current view
            if (document.getElementById('goalsView').style.display === 'block') {
                renderGoals();
            } else if (document.getElementById('analyticsView').style.display === 'block') {
                renderAnalytics();
            }
        } else {
            showToast('Failed to load dashboard', 'error');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('An error occurred', 'error');
    }
}

function renderDashboard() {
    const { user, today_tasks, deadline_risks, active_goals } = dashboardData;

    // Update user info
    const userName = user.email.split('@')[0];
    document.getElementById('userName').textContent = userName;
    document.getElementById('userLevel').textContent = Math.floor(user.xp / 100) + 1;
    document.getElementById('streakCount').textContent = user.streak_count || 0;
    document.getElementById('xpCount').textContent = user.xp || 0;

    // Set avatar
    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

    // Update badge count
    const goalsCount = active_goals ? active_goals.length : 0;
    document.getElementById('activeGoalsCount').textContent = goalsCount;

    // Render deadline warnings
    renderDeadlineWarnings(deadline_risks);

    // Render today's tasks
    todayTasks = today_tasks || [];
    renderTimeline(todayTasks);
}

// View Management
function switchView(viewId) {
    const views = ['dashboardView', 'goalsView', 'analyticsView'];
    views.forEach(id => {
        document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
    });

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Find nav item by icon/label or text content
    if (viewId === 'dashboardView') {
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
        renderDashboard();
    } else if (viewId === 'goalsView') {
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
        renderGoals();
    } else if (viewId === 'analyticsView') {
        document.querySelector('.nav-item:nth-child(4)').classList.add('active');
        renderAnalytics();
    }
}

function showDashboardView() { switchView('dashboardView'); }
function showGoalsView() { switchView('goalsView'); }
function showAnalyticsView() { switchView('analyticsView'); }

// Render Goals
function renderGoals() {
    const { active_goals } = dashboardData;
    const grid = document.getElementById('goalsGrid');
    grid.innerHTML = '';

    if (!active_goals || active_goals.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No goals yet. Create one to start planned!</p></div>';
        return;
    }

    active_goals.forEach(goal => {
        const completedTasks = goal.tasks.filter(t => t.status === 'completed').length;
        const totalTasks = goal.tasks.length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const card = `
            <div class="task-card">
                <div class="task-header">
                    <div class="task-title" style="font-size: 1.25rem;">${goal.title}</div>
                    <span class="difficulty-badge difficulty-${goal.priority}">Priority ${goal.priority}</span>
                </div>
                <div class="task-meta">
                    <span>📅 Deadline: ${new Date(goal.deadline).toLocaleDateString()}</span>
                    <span>⏱ ${goal.estimated_hours}h total</span>
                </div>
                <div class="progress-indicator" style="margin-top: 1rem;">
                    <span>${progress.toFixed(0)}% Complete (${completedTasks}/${totalTasks} tasks)</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', card);
    });
}

// Render Analytics
function renderAnalytics() {
    const { user, patterns } = dashboardData;
    const grid = document.getElementById('analyticsGrid');

    // Simple productivity score calculation
    const score = Math.min(100, (user.streak_count * 5) + (user.xp % 100));
    document.getElementById('productivityScore').textContent = `${score}%`;

    // Render patterns
    if (patterns && patterns.length > 0) {
        const patternsHTML = `
            <div class="task-card" style="grid-column: span 2; margin-top: 1rem;">
                <div class="task-header"><div class="task-title">Your Procrastination Patterns</div></div>
                <ul style="margin-top: 1rem; color: var(--text-secondary);">
                    ${patterns.map(p => `<li style="margin-bottom: 0.5rem;">🚨 ${p}</li>`).join('')}
                </ul>
            </div>
        `;
        // Check if patterns list already exists to avoid duplication
        const existingPatterns = document.getElementById('patternsList');
        if (existingPatterns) existingPatterns.remove();
        grid.insertAdjacentHTML('beforeend', `<div id="patternsList">${patternsHTML}</div>`);
    }

    // Generate simple bar chart
    const chart = document.getElementById('weeklyChart');
    if (chart) {
        chart.innerHTML = '';
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(day => {
            const height = 20 + Math.random() * 80; // Random data for demo
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${height}%`;
            bar.title = `${day}: ${Math.round(height)}% completion`;
            chart.appendChild(bar);
        });
    }
}

function renderDeadlineWarnings(risks) {
    const container = document.getElementById('deadlineWarnings');
    container.innerHTML = '';

    const highRisks = risks.filter(r => r.risk_level === 'HIGH' || r.risk_level === 'MEDIUM');

    highRisks.forEach(risk => {
        const warningHTML = `
            <div class="warning-banner">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                    <h3>${risk.goal_title}</h3>
                    <p>${risk.message}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', warningHTML);
    });
}

function renderTimeline(tasks) {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    if (!tasks || tasks.length === 0) {
        timeline.style.display = 'none';
        emptyState.style.display = 'block';
        updateTaskProgress(0, 0);
        return;
    }

    timeline.style.display = 'block';
    emptyState.style.display = 'none';
    timeline.innerHTML = '';

    // Sort tasks by start time
    const sortedTasks = [...tasks].sort((a, b) => {
        return (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '');
    });

    sortedTasks.forEach(task => {
        const taskHTML = createTaskCard(task);
        timeline.insertAdjacentHTML('beforeend', taskHTML);
    });

    // Update progress
    const completed = tasks.filter(t => t.status === 'completed').length;
    updateTaskProgress(completed, tasks.length);
}

function createTaskCard(task) {
    const isCompleted = task.status === 'completed';
    const isBreak = task.title.toLowerCase().includes('break');

    const difficultyClass = task.difficulty ? `difficulty-${task.difficulty}` : '';
    const cardClass = isCompleted ? 'completed' : (isBreak ? 'break' : '');

    const actionsHTML = isCompleted ? `
        <div class="task-meta">
            <span>✅ Completed</span>
        </div>
    ` : (isBreak ? '' : `
        <div class="task-actions">
            <button class="task-btn btn-complete" onclick="completeTask(${task.id})">
                ✓ Complete
            </button>
            <button class="task-btn btn-skip" onclick="skipTask(${task.id})">
                Skip
            </button>
        </div>
    `);

    return `
        <div class="task-block">
            <div class="task-time">${task.scheduled_start_time || ''}</div>
            <div class="task-dot"></div>
            <div class="task-card ${cardClass}">
                <div class="task-header">
                    <div class="task-title">${task.title}</div>
                    ${task.difficulty && !isBreak ? `<span class="difficulty-badge ${difficultyClass}">Level ${task.difficulty}</span>` : ''}
                </div>
                ${!isBreak ? `
                    <div class="task-meta">
                        <span>⏱ ${task.scheduled_start_time} - ${task.scheduled_end_time}</span>
                        <span>💪 ${task.estimated_hours}h</span>
                        ${task.xp_value ? `<span>⭐ +${task.xp_value} XP</span>` : ''}
                    </div>
                ` : ''}
                ${actionsHTML}
            </div>
        </div>
    `;
}

function updateTaskProgress(completed, total) {
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('totalTasks').textContent = total;

    // Update progress fill
    const fill = document.getElementById('progressFill');
    if (total > 0) {
        const percentage = (completed / total) * 100;
        fill.style.width = `${percentage}%`;
    } else {
        fill.style.width = '0%';
    }
}

async function completeTask(taskId) {
    try {
        const response = await apiRequest(`/tasks/${taskId}/complete`, {
            method: 'POST'
        });

        if (response.ok) {
            const { xp_earned, total_xp, streak } = response.data;

            // Update UI
            showToast(`🎉 +${xp_earned} XP earned!`, 'success');
            document.getElementById('xpCount').textContent = total_xp;
            document.getElementById('streakCount').textContent = streak;

            // Reload dashboard
            await loadDashboard();

            // Check if all tasks completed
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
    if (!confirm('Skip this task? It will be marked as skipped.')) {
        return;
    }

    try {
        const response = await apiRequest(`/tasks/${taskId}/skip`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Task skipped', 'info');
            await loadDashboard();
        } else {
            showToast('Failed to skip task', 'error');
        }
    } catch (error) {
        console.error('Skip task error:', error);
        showToast('An error occurred', 'error');
    }
}

function checkEndOfDay() {
    const now = new Date();
    const hour = now.getHours();

    // Show end of day check after 8 PM
    if (hour >= 20) {
        const completedCount = todayTasks.filter(t => t.status === 'completed').length;
        const totalCount = todayTasks.length;

        // Only show if user has completed at least some tasks
        if (completedCount > 0 && completedCount === totalCount) {
            setTimeout(() => {
                showEndOfDayModal();
            }, 2000);
        }
    }
}

// Modal Toggle Functions
function showNewGoalModal() {
    document.getElementById('newGoalModal').style.display = 'block';
}

function closeNewGoalModal() {
    document.getElementById('newGoalModal').style.display = 'none';
    document.getElementById('newGoalForm').reset();
}

function showEndOfDayModal() {
    document.getElementById('endOfDayModal').style.display = 'block';
}

function closeEndOfDayModal() {
    document.getElementById('endOfDayModal').style.display = 'none';
    document.getElementById('endOfDayForm').reset();
}

// Energy Selection
function selectEnergy(level) {
    document.querySelectorAll('.energy-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.energy-btn[data-value="${level}"]`).classList.add('active');
    document.getElementById('energyLevel').value = level;
}

// Handle New Goal Submission
async function handleNewGoal(e) {
    e.preventDefault();

    const goalData = {
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        deadline: document.getElementById('goalDeadline').value,
        estimated_hours: parseFloat(document.getElementById('goalHours').value)
    };

    try {
        showToast('Generating your smart schedule...', 'info');
        const response = await apiRequest('/goals', {
            method: 'POST',
            body: JSON.stringify(goalData)
        });

        if (response.ok) {
            showToast('Goal created successfully! 🚀', 'success');
            closeNewGoalModal();
            await loadDashboard();
            // Switch to dashboard view to see the new schedule
            showDashboardView();
        } else {
            const errorData = response.data;
            showToast(errorData.error || 'Failed to create goal', 'error');
        }
    } catch (error) {
        console.error('New goal error:', error);
        showToast('An error occurred during goal creation', 'error');
    }
}

async function handleEndOfDaySubmit(e) {
    e.preventDefault();

    const formData = {
        tasks_completed_percentage: parseInt(document.getElementById('completionSlider').value),
        screen_time_level: document.querySelector('input[name="screenTime"]:checked').value,
        main_distraction: document.getElementById('distractionSelect').value,
        energy_level: parseInt(document.getElementById('energyLevel').value),
        skip_reason: document.getElementById('skipReason').value
    };

    try {
        const response = await apiRequest('/daily-log', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const { adjustments, tasks_modified } = response.data;

            closeEndOfDayModal();

            // Show adjustments
            if (adjustments && adjustments.length > 0) {
                let message = '📊 Tomorrow\'s plan adjusted:\n\n';
                adjustments.forEach(adj => {
                    message += `• ${adj}\n`;
                });

                if (tasks_modified > 0) {
                    message += `\n${tasks_modified} tasks modified.`;
                }

                alert(message);
            } else {
                showToast('✅ Log submitted! See you tomorrow!', 'success');
            }

            // Reload dashboard
            await loadDashboard();
        } else {
            showToast('Failed to submit log', 'error');
        }
    } catch (error) {
        console.error('End of day submit error:', error);
        showToast('An error occurred', 'error');
    }
}

function setupEventListeners() {
    // Completion slider
    const slider = document.getElementById('completionSlider');
    if (slider) {
        const sliderValue = document.getElementById('completionValue');
        slider.addEventListener('input', (e) => {
            sliderValue.textContent = e.target.value;
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const endOfDayModal = document.getElementById('endOfDayModal');
        const newGoalModal = document.getElementById('newGoalModal');

        if (e.target === endOfDayModal) {
            closeEndOfDayModal();
        }
        if (e.target === newGoalModal) {
            closeNewGoalModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Alt + G: New Goal
        if (e.altKey && e.key === 'g') {
            showNewGoalModal();
        }
        // Alt + D: Dashboard
        if (e.altKey && e.key === 'd') {
            showDashboardView();
        }
    });
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);
}

// Ensure triggerEndOfDay is global as used in HTML
window.triggerEndOfDay = triggerEndOfDay;
window.showNewGoalModal = showNewGoalModal;
window.showGoalsView = showGoalsView;
window.showAnalyticsView = showAnalyticsView;
window.handleNewGoal = handleNewGoal;
window.handleEndOfDaySubmit = handleEndOfDaySubmit;
window.selectEnergy = selectEnergy;
window.logout = logout; // From auth.js
