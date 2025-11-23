document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const themeControl = document.getElementById('themeControl');
    const themeLabel = document.getElementById('themeLabel');
    const uploadArea = document.getElementById('uploadArea');
    const cvInput = document.getElementById('cvInput');
    const fileName = document.getElementById('fileName');
    const applicationForm = document.getElementById('applicationForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');
    const errorBox = document.getElementById('errorBox');
    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');

    // Theme management
    const THEME_KEY = 'talentflow_theme';
    function applyTheme(t){
        if(t === 'light') body.classList.add('theme-light'); else body.classList.remove('theme-light');
        themeLabel.textContent = (t === 'light') ? 'Light Mode' : 'Dark Mode';
    }
    const savedTheme = (function(){ try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch(e){ return 'dark'; } })();
    applyTheme(savedTheme);
    function toggleTheme(){
        const cur = body.classList.contains('theme-light') ? 'light' : 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try{ localStorage.setItem(THEME_KEY, next); } catch(e){}
    }
    if(themeControl) themeControl.addEventListener('click', toggleTheme);

    // Get job ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('jobId');

    if (!jobId) {
        showError('Invalid job link. Missing job ID.');
        return;
    }

    // Load job details
    loadJobDetails(jobId);

    // File upload handling
    uploadArea.addEventListener('click', () => cvInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            cvInput.files = files;
            displayFileName(files[0].name);
        }
    });

    cvInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            displayFileName(e.target.files[0].name);
        }
    });

    function displayFileName(name) {
        fileName.textContent = '✓ ' + name;
        fileName.style.display = 'block';
    }

    // Form submission
    applicationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitApplication();
    });

    async function loadJobDetails(jobId) {
        try {
            const response = await fetch(`/api/jobs/${jobId}`);

            // Check if job is not live (HTTP 410 Gone) or cannot be edited (HTTP 403 Forbidden)
            // For apply form, we only care about 410 (not published)
            if (response.status === 410) {
                const data = await response.json();
                showJobNotLiveError(data.reason || 'This job is not live anymore');
                return;
            }

            const data = await response.json();

            if (data.status === 'error') {
                showError(data.reason || 'Failed to load job details');
                return;
            }

            // Display job details
            document.getElementById('jobTitleHint').textContent = data.title;

            const jobDetailsEl = document.getElementById('jobDetails');
            jobDetailsEl.innerHTML = `
                <div class="detail-item">
                    <div class="detail-label">Department</div>
                    <div class="detail-value">${data.department || '—'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${data.location || '—'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Employment Type</div>
                    <div class="detail-value">${formatEmploymentType(data.employmentType)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Salary Range</div>
                    <div class="detail-value">${formatSalaryRange(data.salaryMin, data.salaryMax)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Application Deadline</div>
                    <div class="detail-value">${formatDate(data.applicationDeadline)}</div>
                </div>
            `;

            const jobDescEl = document.getElementById('jobDescription');
            let descHtml = '';
            if (data.descriptionSummary) {
                descHtml += `<p style="margin:0 0 12px 0;">${escapeHtml(data.descriptionSummary)}</p>`;
            }
            if (data.jobDescriptions && data.jobDescriptions.length > 0) {
                data.jobDescriptions.forEach(jd => {
                    descHtml += `
                        <div style="margin-bottom:12px;">
                            <strong style="color:var(--accent1);">${escapeHtml(jd.title)}</strong>
                            <p style="margin:4px 0 0 0;color:var(--muted);">${escapeHtml(jd.description)}</p>
                        </div>
                    `;
                });
            }
            jobDescEl.innerHTML = descHtml;

            document.getElementById('jobDetailsCard').style.display = 'block';
            document.getElementById('applicationFormCard').style.display = 'block';

        } catch (error) {
            showError('Failed to load job details: ' + error.message);
        }
    }

    async function submitApplication() {
        clearError();
        statusEl.textContent = '';

        const formData = new FormData(applicationForm);
        formData.append('jobId', jobId);

        // Validate CV file
        const cvFile = cvInput.files[0];
        if (!cvFile) {
            showError('Please upload your CV/Resume');
            return;
        }

        // Check file size (10MB max)
        if (cvFile.size > 10 * 1024 * 1024) {
            showError('CV file size must be less than 10MB');
            return;
        }

        showProgress();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch('/api/applications/submit', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'success') {
                setProgressDone();
                showSuccessPage(data.applicationRef);
            } else {
                showError(data.reason || 'Failed to submit application');
            }

        } catch (error) {
            showError('Network error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application';
            hideProgress();
        }
    }

    function showSuccessPage(appRef) {
        document.getElementById('mainContent').innerHTML = `
            <section class="card" style="text-align:center;padding:40px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">✓</div>
                <h2 style="margin:0 0 12px 0;color:var(--success);">Application Submitted Successfully!</h2>
                <p class="muted" style="margin:0 0 20px 0;">Your application reference: <strong style="color:var(--accent1);">${appRef}</strong></p>
                <p class="muted">We've received your application and will review it shortly. You'll hear from us soon!</p>
            </section>
        `;
    }

    function showProgress() {
        progressWrap.style.display = 'block';
        progressBar.style.width = '30%';
    }

    function setProgressDone() {
        progressBar.style.width = '100%';
    }

    function hideProgress() {
        setTimeout(() => {
            progressWrap.style.display = 'none';
            progressBar.style.width = '0%';
        }, 500);
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }

    function clearError() {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
    }

    function showJobNotLiveError(message) {
        document.getElementById('mainContent').innerHTML = `
            <section class="card" style="text-align:center;padding:40px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">⚠️</div>
                <h2 style="margin:0 0 12px 0;color:var(--danger);">Job Not Available</h2>
                <p class="muted" style="margin:0 0 20px 0;">${escapeHtml(message)}</p>
                <p class="muted">This job posting is either closed, in draft status, or has been removed.</p>
                <button onclick="window.location.href='/index.html'" class="btn" style="margin-top:20px;">← Back to Dashboard</button>
            </section>
        `;
    }

    function formatEmploymentType(type) {
        if (!type) return '—';
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function formatSalaryRange(min, max) {
        if (!min && !max) return '—';
        if (!min) return `Up to $${max.toLocaleString()}`;
        if (!max) return `From $${min.toLocaleString()}`;
        return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

