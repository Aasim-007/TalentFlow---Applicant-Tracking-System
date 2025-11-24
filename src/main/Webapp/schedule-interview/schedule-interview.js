(() => {
  const $ = (sel) => document.querySelector(sel);
  const jobsSection = $('#jobsSection');
  const applicantsSection = $('#applicantsSection');
  const formSection = $('#interviewFormSection');
  const jobsContainer = $('#jobsContainer');
  const applicantsContainer = $('#applicantsContainer');
  const msgBox = $('#msg');

  const state = { job: null, applicant: null, onlineApis: { jobs: false, applicants: false, createInterview: false } };

  // --- Theme toggle (unchanged) ---
  const themeControl = $('#themeControl');
  if (themeControl) {
    themeControl.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      try { localStorage.setItem('theme', document.body.classList.contains('theme-light') ? 'light' : 'dark'); } catch (e) {}
    });
  }

  // New: mock toggle + data source indicator
  const useMockToggleEl = $('#useMockToggle');
  const dataSourceEl = $('#dataSource');
  function updateDataSourceLabel(){
    if (useMockToggleEl && useMockToggleEl.checked){
      if (dataSourceEl) dataSourceEl.textContent = 'Data: mock';
    } else {
      if (dataSourceEl) dataSourceEl.textContent = (state.onlineApis.jobs ? 'Data: server' : 'Data: mock');
    }
  }
  if (useMockToggleEl){
    useMockToggleEl.addEventListener('change', () => {
      updateDataSourceLabel();
      // reload jobs according to selection
      loadJobs();
    });
  }

  function show(section) {
    for (const el of document.querySelectorAll('.form-section')) el.classList.remove('active');
    section.classList.add('active');
  }

  function showMsg(text, kind, autoHide = true) {
    msgBox.style.display = 'block';
    msgBox.className = kind === 'error' ? 'center error' : 'center success';
    msgBox.textContent = text;
    if (autoHide) setTimeout(()=>{ msgBox.style.display='none'; }, 4000);
  }

  // --- Mock data fallback ---
  const MOCK_JOBS = [
    { id: 1, title: 'Senior Software Engineer', department: 'Engineering', location: 'Remote', status: 'published' },
    { id: 2, title: 'Product Manager', department: 'Product', location: 'London', status: 'published' },
    { id: 3, title: 'UX Designer', department: 'Design', location: 'NYC', status: 'published' }
  ];

  const MOCK_APPLICANTS_BY_JOB = {
    1: [
      { applicationId: 1001, applicantUserId: 201, name: 'John Smith', email: 'applicant.john@example.com', status: 'shortlisted' },
      { applicationId: 1002, applicantUserId: 202, name: 'Sarah Johnson', email: 'applicant.sarah@example.com', status: 'shortlisted' }
    ],
    2: [
      { applicationId: 2001, applicantUserId: 203, name: 'Emily Davis', email: 'applicant.emily@example.com', status: 'shortlisted' }
    ],
    3: [
      { applicationId: 3001, applicantUserId: 204, name: 'Lisa Anderson', email: 'applicant.lisa@example.com', status: 'shortlisted' },
      { applicationId: 3002, applicantUserId: 205, name: 'James Taylor', email: 'applicant.james@example.com', status: 'shortlisted' }
    ]
  };

  function getStoredMockInterviews(){
    try { return JSON.parse(localStorage.getItem('mock_interviews') || '[]'); } catch(e){ return []; }
  }
  function saveStoredMockInterviews(arr){ try{ localStorage.setItem('mock_interviews', JSON.stringify(arr)); }catch(e){} }

  // --- Load jobs: prefer real API unless mock toggle is set ---
  async function loadJobs() {
    jobsContainer.innerHTML = '<div class="center">Loading jobs…</div>';

    // If user forces mock, use mock immediately
    if (useMockToggleEl && useMockToggleEl.checked){
      state.onlineApis.jobs = false;
      updateDataSourceLabel();
      renderJobs(MOCK_JOBS);
      return;
    }

    // Try real API first
    try {
      const res = await fetch('/api/jobs?status=active');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        state.onlineApis.jobs = true;
        updateDataSourceLabel();
        renderJobs(data);
        return;
      }
      // If API returned empty list, fall through to mock
      state.onlineApis.jobs = false;
      updateDataSourceLabel();
    } catch (e) {
      // API not available or error — fallback
      state.onlineApis.jobs = false;
      console.warn('Jobs API unavailable, using mock jobs:', e && e.message);
      updateDataSourceLabel();
    }
    renderJobs(MOCK_JOBS);
  }

  function renderJobs(list){
    if (!Array.isArray(list) || list.length === 0) { jobsContainer.innerHTML = '<div class="center">No active jobs found.</div>'; return; }
    jobsContainer.innerHTML = '';
    list.forEach(job => {
      const div = document.createElement('div');
      div.className = 'job-item';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div style="font-weight:700">${escapeHtml(job.title ?? 'Untitled job')}</div>
              <div class="muted">${escapeHtml(job.department ?? '')} — ${escapeHtml(job.location ?? '')}</div>
            </div>
            <div class="muted">${escapeHtml(job.status ?? '')}</div>
        </div>`;
      div.addEventListener('click', () => selectJob(job));
      jobsContainer.appendChild(div);
    });
  }

  async function selectJob(job) {
    state.job = job;
    await loadApplicants(job.id);
    show(applicantsSection);
  }

  // --- Load applicants: try API, fallback to mock data stored/memory ---
  async function loadApplicants(jobId) {
    applicantsContainer.innerHTML = '<div class="center">Loading applicants…</div>';

    // If forced mock data, use that
    if (useMockToggleEl && useMockToggleEl.checked){
      const stored = (JSON.parse(localStorage.getItem('mock_applicants_by_job') || 'null') || {});
      const list = stored[jobId] || MOCK_APPLICANTS_BY_JOB[jobId] || [];
      updateDataSourceLabel();
      renderApplicants(list);
      return;
    }

    // Try API
    try {
      const res = await fetch(`/api/interviews/jobs/${encodeURIComponent(jobId)}/accepted-applicants`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        state.onlineApis.applicants = true;
        renderApplicants(data);
        updateDataSourceLabel();
        return;
      }
      state.onlineApis.applicants = false;
      updateDataSourceLabel();
    } catch (e) {
      state.onlineApis.applicants = false;
      console.warn('Applicants API unavailable or returned none, using mock data:', e && e.message);
      updateDataSourceLabel();
    }
    // fallback: check localStorage for mock applications for this job, else use default
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('mock_applicants_by_job') || 'null'); } catch(e){ stored = null; }
    const list = (stored && stored[jobId]) ? stored[jobId] : (MOCK_APPLICANTS_BY_JOB[jobId] || []);
    renderApplicants(list);
  }

  function renderApplicants(list){
    if (!Array.isArray(list) || list.length === 0) { applicantsContainer.innerHTML = '<div class="center">No accepted/shortlisted applicants for this job yet.</div>'; return; }
    applicantsContainer.innerHTML = '';
    list.forEach(ap => {
      const div = document.createElement('div');
      div.className = 'applicant-item';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div style="font-weight:700">${escapeHtml(ap.name ?? ap.email ?? 'Applicant')}</div>
              <div class="muted">${escapeHtml(ap.email ?? '')}</div>
            </div>
            <div class="muted">${escapeHtml(ap.status ?? '')}</div>
        </div>`;
      div.addEventListener('click', () => selectApplicant(ap));
      applicantsContainer.appendChild(div);
    });
  }

  function selectApplicant(ap) {
    state.applicant = ap;
    // show interview details with applicant info in header
    const hdr = formSection.querySelector('h2');
    if (hdr) hdr.textContent = `Step 3: Interview Details — ${ap.name || ap.email || 'Applicant'}`;
    show(formSection);
  }

  $('#backToJobs').addEventListener('click', (e) => { e.preventDefault(); show(jobsSection); });
  $('#backToApplicants').addEventListener('click', (e) => { e.preventDefault(); show(applicantsSection); });
  $('#cancelBtn').addEventListener('click', () => { show(applicantsSection); });

  // --- Form submit: attempt to call real API; if unavailable, simulate and store in localStorage ---
  $('#interviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.style.display = 'none';
    if (!state.job || !state.applicant) { showMsg('Select a job and applicant first', 'error'); return; }

    const date = $('#interviewDate').value;
    const time = $('#interviewTime').value;
    const dur = parseInt($('#interviewDuration').value, 10);
    const location = $('#interviewLocation').value.trim();
    const interviewerName = $('#interviewerName').value.trim();
    const notes = $('#interviewNotes').value.trim();

    if (!date || !time || !dur || !location) { showMsg('Please complete all required fields.', 'error'); return; }

    // Build ISO offset datetime
    const startLocal = new Date(`${date}T${time}:00`);
    const tzOffsetMin = startLocal.getTimezoneOffset();
    const sign = tzOffsetMin > 0 ? '-' : '+';
    const pad2 = (n)=>String(Math.abs(n)).padStart(2,'0');
    const offset = `${sign}${pad2(Math.floor(Math.abs(tzOffsetMin)/60))}:${pad2(Math.abs(tzOffsetMin)%60)}`;
    const isoLocal = `${date}T${time}:00${offset}`;

    const payload = {
      application_id: state.applicant.applicationId ?? state.applicant.application_id ?? null,
      job_id: state.job.id,
      scheduled_start: isoLocal,
      duration_minutes: dur,
      location: location,
      notes: [interviewerName ? `Interviewer: ${interviewerName}` : null, notes ? `Notes: ${notes}` : null].filter(Boolean).join('\n')
    };

    // Try real API if available
    if (state.onlineApis.createInterview !== false) {
      try {
        // Probe with a short request; we will attempt actual POST but catch failures
        const res = await fetch('/api/interviews', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json().catch(()=>({}));
          if (data && data.status === 'success') {
            showMsg('Interview scheduled successfully (server).', 'success');
            // clear form
            $('#interviewNotes').value = '';
            // optionally redirect/show interviews
            return;
          }
          // server returned not-success; fall back to client-side
          console.warn('Server returned non-success for interview creation', data);
        } else {
          console.warn('Server interview POST failed', res.status);
        }
      } catch (e) {
        console.warn('Interview POST failed, falling back to client simulation:', e && e.message);
      }
      // mark that create API likely unavailable so subsequent saves skip probing
      state.onlineApis.createInterview = false;
    }

    // --- Client-side simulation: store interview in localStorage ---
    const stored = getStoredMockInterviews();
    const newid = Date.now();
    const interview = {
      id: newid,
      application_id: payload.application_id,
      job_id: payload.job_id,
      scheduled_start: payload.scheduled_start,
      duration_minutes: payload.duration_minutes,
      location: payload.location,
      notes: payload.notes,
      created_at: new Date().toISOString(),
      status: 'scheduled'
    };
    stored.push(interview);
    saveStoredMockInterviews(stored);

    // Update mock applicant status in localStorage if used
    try {
      let storedApps = JSON.parse(localStorage.getItem('mock_applicants_by_job') || 'null') || {};
      const list = storedApps[state.job.id] || MOCK_APPLICANTS_BY_JOB[state.job.id] || [];
      for (let a of list) { if ((a.applicationId==payload.application_id) || (a.application_id==payload.application_id)) { a.status = 'interview_invite'; } }
      storedApps[state.job.id] = list;
      localStorage.setItem('mock_applicants_by_job', JSON.stringify(storedApps));
    } catch(e){ console.warn('Failed to update mock applicant status', e); }

    showMsg('Interview scheduled (locally).', 'success');
    // reset form minimally
    $('#interviewNotes').value = '';
    // return to applicants list so manager sees updated status
    await loadApplicants(state.job.id);
    show(applicantsSection);
  });

  // escape helper
  function escapeHtml(text){ if (!text) return ''; return String(text).replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }

  // initial probe for APIs: quick parallel probe to set onlineApis flags
  (async function probeApis(){
    try {
      const [jobsRes, applicantsRes] = await Promise.allSettled([
        fetch('/api/jobs?status=active'),
        fetch('/api/interviews/jobs/1/accepted-applicants')
      ]);
      if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) state.onlineApis.jobs = true; else state.onlineApis.jobs = false;
      if (applicantsRes.status === 'fulfilled' && applicantsRes.value.ok) state.onlineApis.applicants = true; else state.onlineApis.applicants = false;
      // we don't probe create endpoint; will attempt on demand
    } catch(e){ console.warn('API probe failed', e); }
    // load UI after probe
    loadJobs();
  })();

})();
