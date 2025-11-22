// Password and coupon validation
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔌 App connections initialized');
    
    // Password validation for signup
    const password = document.querySelector('input[name="password"]');
    if (password) {
        password.addEventListener('input', () => {
            if (password.value.length < 8) {
                password.setCustomValidity('Password must be at least 8 characters');
            } else {
                password.setCustomValidity('');
            }
        });
    }

    // Coupon validation
    const validateBtn = document.getElementById('validateCouponBtn');
    if (validateBtn) {
        validateBtn.addEventListener('click', async () => {
            const code = document.getElementById('couponInput').value?.trim();
            const plan = document.getElementById('planSelect').value;
            
            if (!code || !plan) {
                showNotification('Please enter coupon code and select a plan', 'error');
                return;
            }

            try {
                const res = await fetch('/api/validate-coupon', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, plan })
                });
                
                const data = await res.json();
                const msg = document.getElementById('couponMessage');
                
                if (data.valid) {
                    msg.textContent = `✅ ${data.discount}% discount applied!`;
                    msg.style.color = '#10b981';
                } else {
                    msg.textContent = `❌ ${data.error}`;
                    msg.style.color = '#ef4444';
                }
            } catch (e) {
                alert('Validation failed');
            }
        });
    }
});
