// Onboarding flow management
requireAuth();

let currentStep = 1;
const totalSteps = 5;
let commitments = [];

// Set minimum date to today
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const deadlineInput = document.getElementById('goalDeadline');
    if (deadlineInput) {
        deadlineInput.min = today;
        // Set default to 30 days from now
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        deadlineInput.value = defaultDate.toISOString().split('T')[0];
    }

    // Keyboard support - Enter to continue
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentStep < 5) {
            // Check if user is in a textarea, if so allow new lines
            if (e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                nextStep();
            }
        }
    });

    // Auto-add one commitment block to start
    if (currentStep === 1) {
        // Just let them start fresh
    }
});

function updateProgress() {
    // Update segments
    for (let i = 1; i <= totalSteps; i++) {
        const segment = document.getElementById(`segment${i}`);
        if (segment) {
            segment.classList.remove('active', 'completed');
            if (i < currentStep) {
                segment.classList.add('completed');
            } else if (i === currentStep) {
                segment.classList.add('active');
            }
        }
    }
}

function nextStep() {
    // Validate current step
    if (!validateStep(currentStep)) {
        return;
    }

    // Move to next step
    document.getElementById(`step${currentStep}`).classList.remove('active');
    currentStep++;
    const nextElem = document.getElementById(`step${currentStep}`);
    if (nextElem) {
        nextElem.classList.add('active');
        updateProgress();

        // Focus first input of next step
        const firstInput = nextElem.querySelector('input, button.btn-primary');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
}

function prevStep() {
    if (currentStep <= 1) return;

    document.getElementById(`step${currentStep}`).classList.remove('active');
    currentStep--;
    const prevElem = document.getElementById(`step${currentStep}`);
    if (prevElem) {
        prevElem.classList.add('active');
        updateProgress();
    }
}

function validateStep(step) {
    switch (step) {
        case 2:
            const wakeTime = document.getElementById('wakeTime').value;
            const sleepTime = document.getElementById('sleepTime').value;

            if (!wakeTime || !sleepTime) {
                showToast('Please specify both wake and sleep times.', 'error');
                return false;
            }

            // Check if sleep time is after wake time (simple approach)
            const wake = parseInt(wakeTime.replace(':', ''));
            const sleep = parseInt(sleepTime.replace(':', ''));

            if (sleep <= wake && sleep > 600) { // If sleep is before wake and not early morning (like 02:00)
                showToast('Target sleep time must be after wake time.', 'error');
                return false;
            }

            return true;

        case 4:
            const goalTitle = document.getElementById('goalTitle').value.trim();
            const goalDeadline = document.getElementById('goalDeadline').value;

            if (!goalTitle) {
                showToast('Mission objective title is required.', 'error');
                document.getElementById('goalTitle').focus();
                return false;
            }

            if (!goalDeadline) {
                showToast('A hard deadline must be established.', 'error');
                return false;
            }

            return true;

        default:
            return true;
    }
}

// Commitment management
function addCommitment() {
    const commitmentId = Date.now();
    const commitmentHTML = `
        <div class="commitment-card" id="commitment-${commitmentId}" style="animation: fadeInUp 0.3s ease;">
            <button class="remove-btn" onclick="removeCommitment(${commitmentId})">✕</button>
            <div class="commitment-fields">
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label style="font-size: 0.75rem;">Block Title</label>
                    <input type="text" class="commitment-title" placeholder="e.g., Core Work Hours" required>
                </div>
                <div class="commitment-row">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Day</label>
                        <select class="commitment-day">
                            <option value="0">Monday</option>
                            <option value="1">Tuesday</option>
                            <option value="2">Wednesday</option>
                            <option value="3">Thursday</option>
                            <option value="4">Friday</option>
                            <option value="5">Saturday</option>
                            <option value="6">Sunday</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Start</label>
                        <input type="time" class="commitment-start" value="09:00" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">End</label>
                        <input type="time" class="commitment-end" value="17:00" required>
                    </div>
                </div>
            </div>
        </div>
    `;

    const list = document.getElementById('commitmentsList');
    list.insertAdjacentHTML('beforeend', commitmentHTML);
    commitments.push(commitmentId);

    // Scroll to bottom of list
    list.scrollTop = list.scrollHeight;

    // Focus the new title field
    setTimeout(() => {
        const newCard = document.getElementById(`commitment-${commitmentId}`);
        if (newCard) newCard.querySelector('input').focus();
    }, 100);
}

function removeCommitment(id) {
    const el = document.getElementById(`commitment-${id}`);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.95)';
        setTimeout(() => {
            el.remove();
            commitments = commitments.filter(c => c !== id);
        }, 200);
    }
}

function getCommitmentsData() {
    const commitmentCards = document.querySelectorAll('.commitment-card');
    const data = [];

    commitmentCards.forEach(card => {
        const title = card.querySelector('.commitment-title').value;
        const day = parseInt(card.querySelector('.commitment-day').value);
        const start = card.querySelector('.commitment-start').value;
        const end = card.querySelector('.commitment-end').value;

        if (title && start && end) {
            data.push({
                title,
                day_of_week: day,
                start_time: start,
                end_time: end,
                recurring: true
            });
        }
    });

    return data;
}

// Complete onboarding
async function completeOnboarding() {
    if (!validateStep(4)) {
        return;
    }

    // Show loading step
    document.getElementById('step4').classList.remove('active');
    currentStep = 5;
    document.getElementById('step5').classList.add('active');
    updateProgress();

    try {
        // Step 1: Save profile
        const wakeTime = document.getElementById('wakeTime').value;
        const sleepTime = document.getElementById('sleepTime').value;
        const energyType = document.querySelector('input[name="energyType"]:checked').value;

        updateLoadingStatus('profile', 'saving');
        const profileResponse = await apiRequest('/onboarding/profile', {
            method: 'POST',
            body: JSON.stringify({
                wake_time: wakeTime,
                sleep_time: sleepTime,
                energy_type: energyType
            })
        });

        if (!profileResponse.ok) throw new Error('Could not synchronize profile metadata.');
        updateLoadingStatus('profile', 'completed');

        // Step 2: Save commitments
        const commitmentsData = getCommitmentsData();
        if (commitmentsData.length > 0) {
            updateLoadingStatus('commitments', 'saving');
            const commitmentsResponse = await apiRequest('/onboarding/commitments', {
                method: 'POST',
                body: JSON.stringify({ commitments: commitmentsData })
            });

            if (!commitmentsResponse.ok) throw new Error('Could not map commitment blocks.');
        }
        updateLoadingStatus('commitments', 'completed');

        // Step 3: Create goal and generate schedule
        const goalTitle = document.getElementById('goalTitle').value.trim();
        const goalDescription = document.getElementById('goalDescription').value.trim();
        const goalDeadline = document.getElementById('goalDeadline').value;
        const goalHours = document.getElementById('goalHours').value;

        updateLoadingStatus('goal', 'active');
        const goalResponse = await apiRequest('/goals', {
            method: 'POST',
            body: JSON.stringify({
                title: goalTitle,
                description: goalDescription,
                deadline: goalDeadline,
                estimated_hours: goalHours ? parseFloat(goalHours) : null
            })
        });

        if (!goalResponse.ok) {
            const errorMsg = goalResponse.data?.error || 'Goal synchronization failed.';
            throw new Error(errorMsg);
        }
        updateLoadingStatus('goal', 'completed');

        updateLoadingStatus('schedule', 'active');
        await new Promise(resolve => setTimeout(resolve, 800)); // Visual pause for "optimization"
        updateLoadingStatus('schedule', 'completed');

        // Success! Update user in localStorage
        const userResponse = await apiRequest('/dashboard');
        if (userResponse.ok) {
            localStorage.setItem('user', JSON.stringify(userResponse.data.user));
        }

        updateLoadingText('Deployment successful. Launching StriveX OS...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Redirect to dashboard
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Core Logic Failure:', error);
        showToast(error.message, 'error');

        // Recovery: Go back to step 4
        setTimeout(() => {
            document.getElementById('step5').classList.remove('active');
            currentStep = 4;
            document.getElementById('step4').classList.add('active');
            updateProgress();
        }, 2000);
    }
}

function updateLoadingText(text) {
    const el = document.getElementById('loadingText');
    if (el) el.textContent = text;
}

function updateLoadingStatus(step, state) {
    // This is a simplified version of the loading items
    const textMap = {
        'profile': 'Profile Analysis',
        'commitments': 'Commitment Mapping',
        'goal': 'Goal Decomposition',
        'schedule': 'Schedule Optimization'
    };

    if (state === 'saving' || state === 'active') {
        updateLoadingText(`Synthesizing ${textMap[step]}...`);
    }
}

// Ensure triggerEndOfDay and other helpers are global
window.nextStep = nextStep;
window.prevStep = prevStep;
window.addCommitment = addCommitment;
window.removeCommitment = removeCommitment;
window.completeOnboarding = completeOnboarding;

// Add some extra styles dynamically for the new loading items
const onboardingStyles = document.createElement('style');
onboardingStyles.textContent = `
    .loading-item {
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        font-size: 0.875rem;
        color: var(--text-tertiary);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transition: all 0.3s ease;
    }
    .loading-item::before {
        content: '○';
        font-weight: bold;
    }
    .loading-item.active {
        color: var(--primary);
        border-color: rgba(102, 126, 234, 0.3);
        background: rgba(102, 126, 234, 0.05);
    }
    .loading-item.active::before {
        content: '●';
        animation: pulse 1s infinite;
    }
    .loading-item.success {
        color: #10b981;
        border-color: rgba(16, 185, 129, 0.2);
    }
    .loading-item.success::before {
        content: '✓';
    }
    
    ::-webkit-scrollbar {
        width: 6px;
    }
    ::-webkit-scrollbar-track {
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
    }
`;
document.head.appendChild(onboardingStyles);
