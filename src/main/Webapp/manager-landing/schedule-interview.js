(function(){
  const $ = (sel) => document.querySelector(sel);
  const jobsSection = $('#jobsSection');
  const applicantsSection = $('#applicantsSection');
  const formSection = $('#interviewFormSection');
  const jobsContainer = $('#jobsContainer');
  const applicantsContainer = $('#applicantsContainer');
  const msgBox = $('#msg');

  const THEME_KEY = 'talentflow_theme';

  const state = { job: null, applicant: null, managerId: null };

  // Theme management
  const body = document.body;
  const themeControl = $('#themeControl');
  const themeLabel = $('#themeLabel');

  function applyTheme(t){
    if(t === 'light') body.classList.add('theme-light'); else body.classList.remove('theme-light');
    if(themeLabel) themeLabel.textContent = (t === 'light') ? 'Light Mode' : 'Dark Mode';
    if(themeControl) themeControl.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
    body.style.backgroundAttachment = 'fixed';
    body.style.minHeight = '100vh';
    body.style.backgroundSize = 'cover';
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
  if(themeControl) themeControl.addEventListener('keydown', (e)=> { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleTheme(); }});

  function show(section) {
    for (const el of document.querySelectorAll('.form-section')) el.classList.remove('active');
    section.classList.add('active');
  }

  function showMsg(text, kind, autoHide = true) {
    if(!msgBox) return;
    msgBox.style.display = 'block';
    msgBox.className = ''; // Clear existing classes
    msgBox.classList.add(kind); // Add 'error' or 'success' class
    msgBox.textContent = text;
    if (autoHide) setTimeout(()=>{ msgBox.style.display='none'; msgBox.className=''; }, 4000);
  }

  function escapeHtml(text){
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }

  // Get session and load manager's jobs
  async function init(){
    try {
      // Get current user (manager) from session
      const userResp = await fetch('/api/auth/current-user');
      if(!userResp.ok) {
        showMsg('Please login as a manager to schedule interviews', 'error', false);
        jobsContainer.innerHTML = '<div class="center error">Not authenticated. Please <a href="/login/login.html" style="color:var(--accent1);">login</a>.</div>';
        return;
      }

      const userData = await userResp.json();
      state.managerId = userData.userId;

      if(userData.role !== 'hiring_manager') {
        showMsg('Only hiring managers can schedule interviews', 'error', false);
        jobsContainer.innerHTML = '<div class="center error">Access denied. Only hiring managers can access this page.</div>';
        return;
      }

      // Load manager's jobs (published jobs they manage)
      await loadJobs(state.managerId);

    } catch(err){
      console.error('Initialization error:', err);
      showMsg('Failed to initialize: ' + err.message, 'error', false);
      jobsContainer.innerHTML = '<div class="center error">Failed to load. Please try again.</div>';
    }
  }

  async function loadJobs(managerId) {
    jobsContainer.innerHTML = '<div class="center">Loading your jobs…</div>';

    try {
      // Get jobs managed by this manager with status 'published'
      const resp = await fetch(`/api/jobs/manager/${managerId}?status=published`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const jobs = await resp.json();

      if(!jobs || jobs.length === 0){
        jobsContainer.innerHTML = '<div class="center">No published jobs found. Only published jobs with applicants can have interviews scheduled.</div>';
        return;
      }

      renderJobs(jobs);

    } catch(err){
      console.error('Failed to load jobs:', err);
      jobsContainer.innerHTML = '<div class="center error">Failed to load jobs. Please try again.</div>';
    }
  }

  function renderJobs(list){
    jobsContainer.innerHTML = '';
    list.forEach(job => {
      const div = document.createElement('div');
      div.className = 'job-item';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:700;font-size:16px;">${escapeHtml(job.title || 'Untitled job')}</div>
            <div class="muted" style="margin-top:4px;">${escapeHtml(job.department || '')} — ${escapeHtml(job.location || '')}</div>
          </div>
          <div class="muted" style="font-size:13px;">Published</div>
        </div>
      `;
      div.addEventListener('click', () => selectJob(job));
      jobsContainer.appendChild(div);
    });
  }

  async function selectJob(job) {
    state.job = job;
    await loadApplicants(job.id);
    show(applicantsSection);
  }

  async function loadApplicants(jobId) {
    applicantsContainer.innerHTML = '<div class="center">Loading applicants…</div>';

    try {
      // Get shortlisted and interview_invite applicants for this job
      const resp = await fetch(`/api/interviews/jobs/${jobId}/shortlisted-applicants`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const applicants = await resp.json();

      if(!applicants || applicants.length === 0){
        applicantsContainer.innerHTML = '<div class="center">No applicants available for interviews yet.<br><br>Applicants must have one of these statuses: <strong>Under Review</strong>, <strong>Shortlisted</strong>, or <strong>Interview Invited</strong>.<br><br>Please check the HR Dashboard to review and update applicant statuses.</div>';
        return;
      }

      renderApplicants(applicants);

    } catch(err){
      console.error('Failed to load applicants:', err);
      applicantsContainer.innerHTML = '<div class="center error">Failed to load applicants. Please try again.</div>';
    }
  }

  function renderApplicants(list){
    applicantsContainer.innerHTML = '';
    list.forEach(ap => {
      const div = document.createElement('div');
      div.className = 'applicant-item';

      // Determine status badge class and text
      let statusBadge = 'b-under_review';
      let statusText = 'Under Review';

      if (ap.status === 'interview_invite') {
        statusBadge = 'b-interview_invite';
        statusText = 'Interview Invited';
      } else if (ap.status === 'shortlisted') {
        statusBadge = 'b-shortlisted';
        statusText = 'Shortlisted';
      } else if (ap.status === 'under_review') {
        statusBadge = 'b-under_review';
        statusText = 'Under Review';
      }

      const hasInterview = ap.hasInterview ? ' ✓ Interview Scheduled' : '';

      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:700;font-size:16px;">${escapeHtml(ap.name || ap.email || 'Applicant')}</div>
            <div class="muted" style="margin-top:4px;">
              <div>📧 ${escapeHtml(ap.email || '')}</div>
              ${ap.phone ? `<div style="margin-top:2px;">📱 ${escapeHtml(ap.phone)}</div>` : ''}
              ${ap.matchScore ? `<div style="margin-top:4px;">🎯 Match Score: ${Math.round(ap.matchScore)}%</div>` : ''}
            </div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${statusBadge}">${statusText}</span>
            ${ap.hasInterview ? '<div class="muted" style="margin-top:6px;font-size:12px;">✓ Interview Scheduled</div>' : ''}
          </div>
        </div>
      `;
      div.addEventListener('click', () => selectApplicant(ap));
      applicantsContainer.appendChild(div);
    });
  }

  function selectApplicant(ap) {
    state.applicant = ap;
    const hdr = formSection.querySelector('h2');
    if (hdr) hdr.textContent = `Step 3: Interview Details — ${ap.name || ap.email || 'Applicant'}`;

    // Clear previous form data
    $('#interviewForm').reset();
    msgBox.style.display = 'none';

    show(formSection);
  }

  $('#backToJobs').addEventListener('click', (e) => {
    e.preventDefault();
    state.job = null;
    state.applicant = null;
    show(jobsSection);
  });

  $('#backToApplicants').addEventListener('click', (e) => {
    e.preventDefault();
    state.applicant = null;
    show(applicantsSection);
  });

  $('#cancelBtn').addEventListener('click', () => {
    state.applicant = null;
    show(applicantsSection);
  });

  $('#interviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.style.display = 'none';

    if (!state.job || !state.applicant) {
      showMsg('Select a job and applicant first', 'error');
      return;
    }

    const date = $('#interviewDate').value;
    const time = $('#interviewTime').value;
    const dur = parseInt($('#interviewDuration').value, 10);
    const location = $('#interviewLocation').value.trim();
    const notes = $('#interviewNotes').value.trim();

    if (!date || !time || !dur || !location) {
      showMsg('Please complete all required fields.', 'error');
      return;
    }

    // Build ISO offset datetime with timezone
    const startLocal = new Date(`${date}T${time}:00`);
    const tzOffsetMin = startLocal.getTimezoneOffset();
    const sign = tzOffsetMin > 0 ? '-' : '+';
    const pad2 = (n)=>String(Math.abs(n)).padStart(2,'0');
    const offset = `${sign}${pad2(Math.floor(Math.abs(tzOffsetMin)/60))}:${pad2(Math.abs(tzOffsetMin)%60)}`;
    const isoLocal = `${date}T${time}:00${offset}`;

    const payload = {
      application_id: state.applicant.applicationId,
      job_id: state.job.id,
      scheduled_start: isoLocal,
      duration_minutes: dur,
      location: location,
      notes: notes
    };

    const submitBtn = $('#interviewForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scheduling...';

    try {
      const resp = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (resp.ok && data.status === 'success') {
        showMsg('Interview scheduled successfully! Notification sent to applicant.', 'success', false);
        $('#interviewForm').reset();

        // Return to jobs list after 2 seconds
        setTimeout(() => {
          msgBox.style.display = 'none';
          msgBox.className = '';
          state.applicant = null;
          state.job = null;
          show(jobsSection);
        }, 2000);
      } else {
        showMsg(data.reason || 'Failed to schedule interview', 'error');
      }

    } catch (err) {
      console.error('Failed to schedule interview:', err);
      showMsg('Network error: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Initialize on page load
  init();

})();

