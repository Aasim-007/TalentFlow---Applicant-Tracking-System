/* Login/Signup Script - TalentFlow ATS */
(function(){
    'use strict';

    // Theme management (matching add-job.js)
    const THEME_KEY = 'talentflow_theme';
    const body = document.body;
    const themeControl = document.getElementById('themeControl');
    const themeLabel = document.getElementById('themeLabel');

    function applyTheme(t) {
        if (t === 'light') {
            body.classList.add('theme-light');
        } else {
            body.classList.remove('theme-light');
        }
        if (themeLabel) {
            themeLabel.textContent = (t === 'light') ? 'Light Mode' : 'Dark Mode';
        }
        if (themeControl) {
            themeControl.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
        }
        body.style.backgroundAttachment = 'fixed';
        body.style.minHeight = '100vh';
        body.style.backgroundSize = 'cover';
    }

    const savedTheme = (function(){
        try {
            return localStorage.getItem(THEME_KEY) || 'dark';
        } catch(e) {
            return 'dark';
        }
    })();
    applyTheme(savedTheme);

    function toggleTheme() {
        const cur = body.classList.contains('theme-light') ? 'light' : 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch(e) {
            console.warn('Could not save theme preference:', e);
        }
    }

    if (themeControl) {
        themeControl.addEventListener('click', toggleTheme);
        themeControl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme();
            }
        });
    }

    // Tab switching
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    function setTab(which) {
        if (which === 'login') {
            loginForm.style.display = '';
            signupForm.style.display = 'none';
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            clearErrors();
        } else {
            loginForm.style.display = 'none';
            signupForm.style.display = '';
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            clearErrors();
        }
    }

    if (tabLogin) tabLogin.addEventListener('click', () => setTab('login'));
    if (tabSignup) tabSignup.addEventListener('click', () => setTab('signup'));

    // Progress bar management
    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');
    let progressTimer = null;

    function showProgress() {
        if (!progressWrap) return;
        progressWrap.style.display = 'block';
        progressBar.style.width = '10%';
        clearTimeout(progressTimer);
        progressTimer = setTimeout(() => progressBar.style.width = '40%', 100);
        progressTimer = setTimeout(() => progressBar.style.width = '70%', 500);
    }

    function hideProgress() {
        if (!progressWrap) return;
        progressBar.style.width = '100%';
        clearTimeout(progressTimer);
        setTimeout(() => {
            progressWrap.style.display = 'none';
            progressBar.style.width = '0%';
        }, 300);
    }

    function hideProgressInstant() {
        if (!progressWrap) return;
        clearTimeout(progressTimer);
        progressWrap.style.display = 'none';
        progressBar.style.width = '0%';
    }

    // Error management
    function showError(errorEl, message) {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearErrors() {
        const loginError = document.getElementById('loginError');
        const signupError = document.getElementById('signupError');
        if (loginError) {
            loginError.style.display = 'none';
            loginError.textContent = '';
        }
        if (signupError) {
            signupError.style.display = 'none';
            signupError.textContent = '';
        }
    }

    // Login functionality
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const err = document.getElementById('loginError');

            clearErrors();

            if (!email || !password) {
                showError(err, 'Please enter both email and password');
                return;
            }

            showProgress();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
            }

            try {
                console.log('Attempting login for:', email);

                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                console.log('Login response status:', res.status);

                const data = await res.json();
                console.log('Login response data:', data);

                hideProgress();

                if (!res.ok || data.status !== 'ok') {
                    const errorMsg = data.message || `Login failed (HTTP ${res.status})`;
                    showError(err, errorMsg);
                    return;
                }

                // Success - store user data and redirect
                try {
                    localStorage.setItem('tf_user', JSON.stringify({
                        id: data.userId,
                        role: data.role
                    }));
                } catch(e) {
                    console.warn('Could not save user data:', e);
                }

                // Redirect to role-specific page
                const redirect = data.redirect || '/';
                console.log('Redirecting to:', redirect);
                window.location.href = redirect;

            } catch(e) {
                console.error('Login error:', e);
                hideProgressInstant();
                showError(err, `Login failed: ${e.message}`);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                }
            }
        });
    }

    // Signup functionality
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('suName').value.trim();
            const email = document.getElementById('suEmail').value.trim();
            const password = document.getElementById('suPassword').value;
            const role = document.getElementById('suRole').value;
            const err = document.getElementById('signupError');

            clearErrors();

            // Validation
            if (!name || !email || !password || !role) {
                showError(err, 'Please fill in all fields');
                return;
            }

            if (password.length < 6) {
                showError(err, 'Password must be at least 6 characters');
                return;
            }

            if (role === '') {
                showError(err, 'Please select a role');
                return;
            }

            showProgress();
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';
            }

            const payload = { name, email, password, role };

            try {
                console.log('Attempting signup for:', email, 'as role:', role);

                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                console.log('Signup response status:', res.status);

                const data = await res.json();
                console.log('Signup response data:', data);

                hideProgress();

                if (res.status !== 201 || data.status !== 'ok') {
                    const errorMsg = data.message || `Signup failed (HTTP ${res.status})`;
                    showError(err, errorMsg);
                    return;
                }

                // Success - store user data and redirect
                try {
                    localStorage.setItem('tf_user', JSON.stringify({
                        id: data.userId,
                        role: data.role
                    }));
                } catch(e) {
                    console.warn('Could not save user data:', e);
                }

                // Redirect to role-specific page
                const redirect = data.redirect || '/';
                console.log('Redirecting to:', redirect);
                window.location.href = redirect;

            } catch(e) {
                console.error('Signup error:', e);
                hideProgressInstant();
                showError(err, `Sign up failed: ${e.message}`);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account';
                }
            }
        });
    }

    // Check if already logged in
    try {
        const userData = localStorage.getItem('tf_user');
        if (userData) {
            const user = JSON.parse(userData);
            console.log('User already logged in:', user);
        }
    } catch(e) {
        console.warn('Could not check login status:', e);
    }

})();

