// Onboarding v2 — StriveX Stage 3
// 4-step onboarding: Rhythm, Peak Hours, Commitments, First Goal

const TOTAL_STEPS = 4;
let currentStep = 1;
const commitments = [];

// ===== STEP NAVIGATION =====

function goToStep(step) {
    // Validate before advancing
    if (step > currentStep && !validateStep(currentStep)) return;

    // Hide current step
    const currentEl = document.getElementById('step' + currentStep);
    if (currentEl) currentEl.classList.remove('active');

    // Show new step
    currentStep = step;
    const nextEl = document.getElementById('step' + currentStep);
    if (nextEl) nextEl.classList.add('active');

    // Update progress bar
    const percent = (step / TOTAL_STEPS) * 100;
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressLabel');
    if (fill) fill.style.width = percent + '%';
    if (label) label.textContent = 'Step ' + step + ' of ' + TOTAL_STEPS;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step) {
    if (step === 1) {
        const wake = document.getElementById('wakeTime').value;
        const sleep = document.getElementById('sleepTime').value;
        if (!wake || !sleep) {
            showToast('Please set your wake and sleep times', 'error');
            return false;
        }
    }
    if (step === 2) {
        const peakStart = document.getElementById('peakStart').value;
        const peakEnd = document.getElementById('peakEnd').value;
        if (!peakStart || !peakEnd) {
            showToast('Set your peak focus hours', 'error');
            return false;
        }
        if (peakEnd <= peakStart) {
            showToast('Peak end must be after peak start', 'error');
            return false;
        }
    }
    return true;
}

// ===== COMMITMENT BUILDER =====

function addCommitment() {
    const title = document.getElementById('commitTitle').value.trim();
    const start = document.getElementById('commitStart').value;
    const end = document.getElementById('commitEnd').value;

    if (!title) { showToast('Enter an activity name', 'error'); return; }
    if (!start || !end) { showToast('Set start and end times', 'error'); return; }
    if (end <= start) { showToast('End time must be after start time', 'error'); return; }

    commitments.push({ title: title, start_time: start, end_time: end });
    renderCommitments();

    document.getElementById('commitTitle').value = '';
    document.getElementById('commitStart').value = '09:00';
    document.getElementById('commitEnd').value = '17:00';
}

function removeCommitment(index) {
    commitments.splice(index, 1);
    renderCommitments();
}

function renderCommitments() {
    const list = document.getElementById('commitmentList');
    list.innerHTML = '';
    commitments.forEach(function (c, i) {
        list.insertAdjacentHTML('beforeend',
            '<div class="commitment-item">' +
            '<span class="commitment-item-title">' + c.title + '</span>' +
            '<span class="commitment-item-time">' + c.start_time + ' – ' + c.end_time + '</span>' +
            '<button class="commitment-remove" onclick="removeCommitment(' + i + ')">✕</button>' +
            '</div>'
        );
    });
}

// ===== LIVE FEASIBILITY PREVIEW =====

let feasibilityTimeout = null;

function setupFeasibilityPreview() {
    var dl = document.getElementById('goalDeadline');
    var hrs = document.getElementById('goalHours');
    if (dl) dl.addEventListener('change', triggerFeasibility);
    if (hrs) hrs.addEventListener('input', triggerFeasibility);
}

function triggerFeasibility() {
    clearTimeout(feasibilityTimeout);
    feasibilityTimeout = setTimeout(previewFeasibility, 400);
}

function previewFeasibility() {
    var deadline = document.getElementById('goalDeadline').value;
    var hours = parseFloat(document.getElementById('goalHours').value);
    if (!deadline || !hours || hours <= 0) return;

    var today = new Date();
    var deadlineDate = new Date(deadline);
    var daysLeft = Math.max(1, Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)));

    var wakeTime = document.getElementById('wakeTime').value || '07:00';
    var sleepTime = document.getElementById('sleepTime').value || '23:00';
    var wakeH = parseInt(wakeTime.split(':')[0]);
    var sleepH = parseInt(sleepTime.split(':')[0]);
    var freeHoursPerDay = Math.max(1, (sleepH - wakeH) * 0.4);
    var availableHours = daysLeft * freeHoursPerDay;
    var rawScore = Math.min(100, Math.round((availableHours / hours) * 100));

    var riskLevel = 'LOW';
    var msg = 'You have plenty of time. Excellent!';
    if (rawScore < 35) { riskLevel = 'CRITICAL'; msg = 'Very tight deadline — daily commitment is critical.'; }
    else if (rawScore < 60) { riskLevel = 'HIGH'; msg = 'Challenging but achievable with consistency.'; }
    else if (rawScore < 80) { riskLevel = 'MEDIUM'; msg = 'On the edge — stay disciplined.'; }

    var preview = document.getElementById('feasibilityPreview');
    var content = document.getElementById('feasibilityPreviewContent');
    if (preview) preview.style.display = 'block';
    if (content) content.className = 'feasibility-preview-content risk-' + riskLevel.toLowerCase();
    var fpScore = document.getElementById('fpScore');
    var fpMsg = document.getElementById('fpMsg');
    if (fpScore) fpScore.textContent = rawScore + '%';
    if (fpMsg) fpMsg.textContent = msg;
}

// ===== FINISH ONBOARDING =====

async function finishOnboarding() {
    var title = document.getElementById('goalTitle').value.trim();
    var deadline = document.getElementById('goalDeadline').value;
    var hours = document.getElementById('goalHours').value;

    if (!title) { showToast('Enter your goal title', 'error'); return; }
    if (!deadline) { showToast('Set a deadline', 'error'); return; }
    if (!hours || parseFloat(hours) <= 0) { showToast('Enter estimated hours', 'error'); return; }

    var btn = document.getElementById('finishBtn');
    btn.disabled = true;
    btn.textContent = 'Setting up…';

    try {
        // Get energy type safely
        var energyEl = document.querySelector('input[name="energyType"]:checked');
        var energyType = energyEl ? energyEl.value : 'morning';

        // Get work style safely
        var workEl = document.querySelector('input[name="workStyle"]:checked');
        var workStyle = workEl ? workEl.value : 'deep';

        // Step A: save profile
        var profileResp = await apiRequest('/onboarding/profile', {
            method: 'POST',
            body: JSON.stringify({
                wake_time: document.getElementById('wakeTime').value || '07:00',
                sleep_time: document.getElementById('sleepTime').value || '23:00',
                energy_type: energyType,
                peak_start: document.getElementById('peakStart').value || '09:00',
                peak_end: document.getElementById('peakEnd').value || '12:00',
                work_style: workStyle
            })
        });
        if (!profileResp || !profileResp.ok) {
            throw new Error('Profile save failed: ' + JSON.stringify(profileResp));
        }

        // Update cached user so landing page redirect works correctly next time
        try {
            var user = JSON.parse(localStorage.getItem('user') || '{}');
            user.wake_time = document.getElementById('wakeTime').value || '07:00';
            localStorage.setItem('user', JSON.stringify(user));
        } catch (e) { /* ignore cache errors */ }

        // Step B: commitments (optional, non-blocking)
        if (commitments.length > 0) {
            try {
                await apiRequest('/onboarding/commitments', {
                    method: 'POST',
                    body: JSON.stringify({ commitments: commitments })
                });
            } catch (e) { /* commitments are optional, continue */ }
        }

        // Step C: first goal
        var goalResp = await apiRequest('/goals', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                description: (document.getElementById('goalDescription') || {}).value || '',
                deadline: deadline,
                estimated_hours: parseFloat(hours)
            })
        });

        if (!goalResp || !goalResp.ok) {
            var errMsg = goalResp && goalResp.data ? goalResp.data.error : 'Goal creation failed';
            throw new Error(errMsg);
        }

        // Success — just redirect, no DOM manipulation needed
        showToast('🚀 Schedule built! Opening dashboard…', 'success');
        setTimeout(function () { window.location.href = 'dashboard.html'; }, 1500);

    } catch (error) {
        console.error('Onboarding error:', error);
        // Show the actual error message so it's debuggable
        showToast('Error: ' + (error.message || 'Unknown error'), 'error');
        btn.disabled = false;
        btn.textContent = 'Launch StriveX 🚀';
    }
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', function () {
    // Auth guard — but don't interrupt if already on onboarding
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'index.html';
        return;
    }

    // Set min deadline date to tomorrow
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dl = document.getElementById('goalDeadline');
    if (dl) dl.min = tomorrow.toISOString().split('T')[0];

    setupFeasibilityPreview();
});

// Expose all functions for inline onclick handlers
window.goToStep = goToStep;
window.addCommitment = addCommitment;
window.removeCommitment = removeCommitment;
window.finishOnboarding = finishOnboarding;
