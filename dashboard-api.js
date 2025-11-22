// Real Dashboard Data Loading from API

const user = JSON.parse(localStorage.getItem('viprusUser') || localStorage.getItem('paradoxUser') || 'null');

if (!user || !user.id) {
    console.warn('No valid user session found, redirecting to home');
    window.location.href = '/';
} else {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }
    
    function initializeDashboard() {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            const firstName = (user.fullname || user.email || 'User').split(' ')[0];
            userNameEl.textContent = firstName;
            console.log('✅ Username set:', firstName);
        } else {
            console.error('❌ userName element not found');
        }
        
        const planBadge = document.getElementById('planBadge');
        if (planBadge) {
            planBadge.textContent = (user.plan || 'free').toUpperCase();
            planBadge.className = `plan-badge ${user.plan || 'free'}`;
        }
        
        // Load data with error handling
        loadDashboardData().catch(err => {
            console.error('Failed to load dashboard data:', err);
            showOfflineContent();
        });
        loadAvailableTasks().catch(err => {
            console.error('Failed to load tasks:', err);
        });
    }
    
    // Load real earnings and tasks
    async function loadDashboardData() {
        try {
            const res = await fetch('/api/dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Save to window for access in dashboard.js
                window.realUserData = data;
                console.log('✅ Dashboard data loaded:', data);
                // Update UI with real earnings, tasks, referrals
                if (document.getElementById('totalEarnings')) {
                    document.getElementById('totalEarnings').textContent = 
                        '₦' + (data.user.totalEarnings || 0).toLocaleString();
                }
                if (document.getElementById('currentBalance')) {
                    document.getElementById('currentBalance').textContent = 
                        '₦' + (data.user.currentBalance || 0).toLocaleString();
                }
                if (document.getElementById('tasksCompleted')) {
                    document.getElementById('tasksCompleted').textContent = 
                        data.user.tasksCompleted || 0;
                }
            } else {
                console.error('Dashboard error:', data.error);
                showOfflineContent();
            }
        } catch (e) {
            console.error('Dashboard load error:', e);
            showOfflineContent();
        }
    }
    
    function showOfflineContent() {
        if (document.getElementById('totalEarnings')) {
            document.getElementById('totalEarnings').textContent = '₦' + (user.totalEarnings || 0).toLocaleString();
        }
        if (document.getElementById('currentBalance')) {
            document.getElementById('currentBalance').textContent = '₦' + (user.currentBalance || 0).toLocaleString();
        }
    }

    // Load available tasks for user
    async function loadAvailableTasks() {
        try {
            const res = await fetch('/api/tasks/available', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, userPlan: user.plan })
            });
            
            const data = await res.json();
            if (data.success) {
                console.log('✅ Available tasks:', data.tasks);
            }
        } catch (e) {
            console.error('Tasks load error:', e);
        }
    }
}
