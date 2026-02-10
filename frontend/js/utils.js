// Common utilities
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');

    // Create toast if it doesn't exist
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Add CSS for toast if not present in the CSS file
const toastStyle = `
.toast {
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #18181b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 2000;
    color: white;
    font-weight: 500;
}

.toast.show {
    transform: translateY(0);
    opacity: 1;
}

.toast.success { border-color: #10b981; }
.toast.error { border-color: #ef4444; }
.toast.info { border-color: #6366f1; }
`;

if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = toastStyle;
    document.head.appendChild(style);
}

window.showToast = showToast;
