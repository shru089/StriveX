// ============= API URL CONFIGURATION =============
// Priority: window.STRIVEX_API_URL (set in index.html for prod) > auto-detect
const API_URL = (() => {
    // 1. Explicit override (set in a <script> before auth.js in production HTML)
    if (window.STRIVEX_API_URL) return window.STRIVEX_API_URL;
    // 2. Auto-detect: on localhost, point to local backend
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) return 'http://localhost:5001/api';
    // 3. Production: backend is a separate service — read from meta tag or use same-origin /api
    const meta = document.querySelector('meta[name="api-url"]');
    if (meta) return meta.content;
    // 4. Fallback: same-origin /api (works if backend is proxied via Vercel rewrites)
    return `${window.location.origin}/api`;
})();


// ============= TOKEN MANAGEMENT =============
let _refreshTimer = null;

function storeTokens(accessToken, refreshToken, user) {
    localStorage.setItem('authToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    scheduleTokenRefresh(accessToken);
}

function scheduleTokenRefresh(accessToken) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresIn = (payload.exp * 1000) - Date.now();
        const refreshIn = expiresIn - (2 * 60 * 1000); // 2 min before expiry
        if (refreshIn > 0) {
            _refreshTimer = setTimeout(silentRefresh, refreshIn);
        }
    } catch (e) { /* token parse error — ignore */ }
}

async function silentRefresh() {
    const rawRefresh = localStorage.getItem('refreshToken');
    if (!rawRefresh) return;
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: rawRefresh })
        });
        if (res.ok) {
            const data = await res.json();
            storeTokens(data.access_token, data.refresh_token, data.user);
        } else {
            // Refresh failed — redirect to login
            localStorage.clear();
            window.location.href = 'index.html';
        }
    } catch (e) { /* network error — try again next cycle */ }
}

// Capture OAuth tokens from URL params (after Google callback redirect)
(function captureOAuthTokens() {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken) {
        storeTokens(accessToken, refreshToken, null);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        window.location.href = 'dashboard.html';
    }
    const error = params.get('error');
    if (error) {
        console.warn('OAuth error:', error);
    }
})();

// Auth state management
let currentUser = null;
let authToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        scheduleTokenRefresh(token); // Resume refresh timer on page load
        const isLanding = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
        if (isLanding) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.wake_time) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'onboarding.html';
            }
        }
    }
});

// Google Sign-In
function signInWithGoogle() {
    window.location.href = `${API_URL}/auth/google`;
}

// Modal functions
function showAuthModal(mode) {
    const modal = document.getElementById('authModal');
    modal.style.display = 'block';
    switchAuthMode(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
}

function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (mode === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save token and user data
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            authToken = data.token;
            currentUser = data.user;

            // Check if user has completed onboarding
            if (data.user.wake_time && data.user.sleep_time) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'onboarding.html';
            }
        } else {
            alert(data.error || 'Login failed. Please check your credentials.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);

        // Better error messages
        let errorMessage = 'Connection error. ';
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Please make sure the backend server is running on http://localhost:5001';
        } else {
            errorMessage += 'Please try again.';
        }

        alert(errorMessage);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();

    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save token and user data
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            authToken = data.token;
            currentUser = data.user;

            // Redirect to onboarding
            window.location.href = 'onboarding.html';
        } else {
            alert(data.error || 'Signup failed. Please try again.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Signup error:', error);

        // Better error messages
        let errorMessage = 'Connection error. ';
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Please make sure the backend server is running on http://localhost:5001';
        } else {
            errorMessage += 'Please try again.';
        }

        alert(errorMessage);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    window.location.href = 'index.html';
}

// API helper function
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, mergedOptions);
        const data = await response.json();

        if (response.status === 401) {
            // Token expired or invalid
            logout();
            return null;
        }

        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error('API request error:', error);
        return { ok: false, error: error.message };
    }
}

// Get current user
function getCurrentUser() {
    if (!currentUser) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            currentUser = JSON.parse(userStr);
        }
    }
    return currentUser;
}

// Check if authenticated
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

// Protect page (call this on pages that require auth)
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
    }
}
