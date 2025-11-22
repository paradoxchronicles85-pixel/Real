
// Email and Phone Verification Handler

async function sendEmailVerification() {
    const email = document.querySelector('input[name="email"]').value.trim();
    const fullname = document.querySelector('input[name="fullname"]').value.trim();
    
    if (!email || !fullname) {
        showNotification('Please enter your name and email first', 'error');
        return;
    }

    const emailBtn = document.getElementById('verifyEmailBtn');
    const originalText = emailBtn.innerHTML;
    emailBtn.innerHTML = '⏳ Sending...';
    emailBtn.disabled = true;

    try {
        const response = await fetch('/api/verify/send-email-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullname })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('✅ Verification code sent to your email!', 'success');
            document.getElementById('emailCodeSection').style.display = 'block';
            emailBtn.innerHTML = '✓ Code Sent';
            emailBtn.style.background = '#10b981';
        } else {
            showNotification(result.error || 'Failed to send code', 'error');
            emailBtn.innerHTML = originalText;
            emailBtn.disabled = false;
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        emailBtn.innerHTML = originalText;
        emailBtn.disabled = false;
    }
}

async function verifyEmailCode() {
    const email = document.querySelector('input[name="email"]').value.trim();
    const code = document.getElementById('emailCodeInput').value.trim();

    if (!code) {
        showNotification('Please enter the verification code', 'error');
        return;
    }

    const verifyBtn = document.getElementById('confirmEmailBtn');
    const originalText = verifyBtn.innerHTML;
    verifyBtn.innerHTML = '⏳ Verifying...';
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/api/verify/check-email-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });

        const result = await response.json();

        if (result.success) {
            emailVerified = true;
            showNotification('✅ Email verified successfully!', 'success');
            document.getElementById('emailCodeSection').style.display = 'none';
            document.getElementById('emailVerifiedBadge').style.display = 'inline-block';
            verifyBtn.innerHTML = '✓ Verified';
            verifyBtn.style.background = '#10b981';
        } else {
            showNotification(result.error || 'Invalid code', 'error');
            verifyBtn.innerHTML = originalText;
            verifyBtn.disabled = false;
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        verifyBtn.innerHTML = originalText;
        verifyBtn.disabled = false;
    }
}

async function sendPhoneOTP() {
    const phone = document.querySelector('input[name="phone"]').value.trim();
    
    if (!phone) {
        showNotification('Please enter your phone number first', 'error');
        return;
    }

    const phoneBtn = document.getElementById('verifyPhoneBtn');
    const originalText = phoneBtn.innerHTML;
    phoneBtn.innerHTML = '⏳ Sending...';
    phoneBtn.disabled = true;

    try {
        const response = await fetch('/api/verify/send-phone-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('✅ OTP sent to your phone!', 'success');
            document.getElementById('phoneOtpSection').style.display = 'block';
            phoneBtn.innerHTML = '✓ OTP Sent';
            phoneBtn.style.background = '#10b981';
        } else {
            showNotification(result.error || 'Failed to send OTP', 'error');
            phoneBtn.innerHTML = originalText;
            phoneBtn.disabled = false;
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        phoneBtn.innerHTML = originalText;
        phoneBtn.disabled = false;
    }
}

async function verifyPhoneOTP() {
    const phone = document.querySelector('input[name="phone"]').value.trim();
    const code = document.getElementById('phoneOtpInput').value.trim();

    if (!code) {
        showNotification('Please enter the OTP code', 'error');
        return;
    }

    const verifyBtn = document.getElementById('confirmPhoneBtn');
    const originalText = verifyBtn.innerHTML;
    verifyBtn.innerHTML = '⏳ Verifying...';
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/api/verify/check-phone-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code })
        });

        const result = await response.json();

        if (result.success) {
            phoneVerified = true;
            showNotification('✅ Phone verified successfully!', 'success');
            document.getElementById('phoneOtpSection').style.display = 'none';
            document.getElementById('phoneVerifiedBadge').style.display = 'inline-block';
            verifyBtn.innerHTML = '✓ Verified';
            verifyBtn.style.background = '#10b981';
        } else {
            showNotification(result.error || 'Invalid OTP', 'error');
            verifyBtn.innerHTML = originalText;
            verifyBtn.disabled = false;
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
        verifyBtn.innerHTML = originalText;
        verifyBtn.disabled = false;
    }
}

// Check if user is admin/vendor (auto-verified)
function isAdminOrVendor(phone) {
    const adminPhones = ['+13124202900', '+2348146417776'];
    const vendorPhones = [
        '+2347084174994', '+2347040759259', '+2348143662936',
        '+2347044035084', '+2347089902875', '+2347048787493',
        '+2349163483144', '+2349046428186', '+2347071401650',
        '+2348132725834'
    ];
    return adminPhones.includes(phone) || vendorPhones.includes(phone);
}

// Auto-verify admin/vendor accounts
function autoVerifyIfNeeded() {
    const phoneInput = document.querySelector('input[name="phone"]');
    const emailInput = document.querySelector('input[name="email"]');
    
    if (phoneInput && isAdminOrVendor(phoneInput.value.trim())) {
        // Auto-mark as verified
        emailVerified = true;
        phoneVerified = true;
        
        const emailBadge = document.getElementById('emailVerifiedBadge');
        const phoneBadge = document.getElementById('phoneVerifiedBadge');
        const emailBtn = document.getElementById('verifyEmailBtn');
        const phoneBtn = document.getElementById('verifyPhoneBtn');
        
        if (emailBadge) emailBadge.style.display = 'inline-block';
        if (phoneBadge) phoneBadge.style.display = 'inline-block';
        if (emailBtn) {
            emailBtn.innerHTML = '✓ Auto-Verified';
            emailBtn.style.background = '#10b981';
            emailBtn.disabled = true;
        }
        if (phoneBtn) {
            phoneBtn.innerHTML = '✓ Auto-Verified';
            phoneBtn.style.background = '#10b981';
            phoneBtn.disabled = true;
        }
        
        showNotification('✅ Admin/Vendor account - Auto-verified!', 'success');
    }
}

// Auto-attach event listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const verifyEmailBtn = document.getElementById('verifyEmailBtn');
    const confirmEmailBtn = document.getElementById('confirmEmailBtn');
    const verifyPhoneBtn = document.getElementById('verifyPhoneBtn');
    const confirmPhoneBtn = document.getElementById('confirmPhoneBtn');
    const phoneInput = document.querySelector('input[name="phone"]');

    if (verifyEmailBtn) verifyEmailBtn.addEventListener('click', sendEmailVerification);
    if (confirmEmailBtn) confirmEmailBtn.addEventListener('click', verifyEmailCode);
    if (verifyPhoneBtn) verifyPhoneBtn.addEventListener('click', sendPhoneOTP);
    if (confirmPhoneBtn) confirmPhoneBtn.addEventListener('click', verifyPhoneOTP);
    
    // Auto-verify on phone input change
    if (phoneInput) {
        phoneInput.addEventListener('blur', autoVerifyIfNeeded);
        phoneInput.addEventListener('change', autoVerifyIfNeeded);
    }
});
