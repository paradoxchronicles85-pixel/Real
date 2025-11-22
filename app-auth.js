
// Complete Authentication System - Fixed and Production Ready

async function handleSignup(e) {
    e.preventDefault();
    
    // Check verification status
    if (!emailVerified) {
        showNotification('❌ Please verify your email address first', 'error');
        return;
    }
    
    if (!phoneVerified) {
        showNotification('❌ Please verify your phone number first', 'error');
        return;
    }
    
    const formData = new FormData(e.target);

    const fullname = formData.get('fullname')?.trim();
    const email = formData.get('email')?.trim();
    const phone = formData.get('phone')?.trim();
    const password = formData.get('password');
    const plan = formData.get('plan');
    const coupon = formData.get('coupon')?.trim() || '';

    // Validation
    if (!fullname || !email || !phone || !password || !plan) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    if (password.length < 8) {
        showNotification('Password must be at least 8 characters', 'error');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Creating Account...</span>';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                fullname, 
                email, 
                phone, 
                password, 
                plan, 
                couponCode: coupon || 'NOT_REQUIRED'
            })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('paradoxUser', JSON.stringify(result.user));
            showNotification('✅ Account created! Redirecting...', 'success');

            setTimeout(() => {
                const redirectUrl = (result.user.userType === 'admin' || result.user.userType === 'vendor') 
                    ? '/vendor.html' 
                    : '/dashboard.html';
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            showNotification(result.error || 'Signup failed', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('Network error. Please check your connection.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const phone = formData.get('phone')?.trim();
    const password = formData.get('password');

    if (!phone || !password) {
        showNotification('Please enter phone and password', 'error');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Logging in...</span>';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('paradoxUser', JSON.stringify(result.user));
            showNotification('✅ Login successful! Redirecting...', 'success');

            setTimeout(() => {
                const redirectUrl = result.redirectTo || 
                    ((result.user.userType === 'admin' || result.user.userType === 'vendor') 
                        ? '/vendor.html' 
                        : '/dashboard.html');
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            showNotification(result.error || 'Invalid credentials', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error. Please check your connection.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Initialize authentication when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Authentication system initialized');

    const loginFormElement = document.getElementById('loginFormElement');
    const signupFormElement = document.getElementById('signupFormElement');
    
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', handleLogin);
        console.log('✅ Login form connected');
    } else {
        console.warn('⚠️ Login form not found');
    }
    
    if (signupFormElement) {
        signupFormElement.addEventListener('submit', handleSignup);
        console.log('✅ Signup form connected');
    } else {
        console.warn('⚠️ Signup form not found');
    }
});

// Make functions globally available
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;

function logout() {
    localStorage.removeItem('viprusUser');
    localStorage.removeItem('paradoxUser'); // Keep for backwards compatibility
    localStorage.removeItem('viprusToken');
    localStorage.removeItem('paradoxToken'); // Keep for backwards compatibility
    window.location.href = '/';
}

window.logout = logout;
