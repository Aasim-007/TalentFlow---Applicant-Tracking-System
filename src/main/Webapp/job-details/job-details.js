(function(){
  // Theme utilities (consistent with index/add-job/hr-dashboard)
  function applyThemeToBody(body, themeControl){
    const themeLabel = document.getElementById('themeLabel');
    return function applyTheme(t){
      if(t === 'light') body.classList.add('theme-light'); else body.classList.remove('theme-light');
      if(themeLabel) themeLabel.textContent = (t === 'light') ? 'Light Mode' : 'Dark Mode';
      if(themeControl) themeControl.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
      body.style.backgroundAttachment = 'fixed';
      body.style.minHeight = '100vh';
      body.style.backgroundSize = 'cover';
    }
  }

  const body = document.body;
  const themeControl = document.getElementById('themeControl');
  const THEME_KEY = 'talentflow_theme';
  const applyTheme = applyThemeToBody(body, themeControl);
  const savedTheme = (function(){ try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch(e){ return 'dark'; } })();
  applyTheme(savedTheme);
  function toggleTheme(){
    const cur = body.classList.contains('theme-light') ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try{ localStorage.setItem(THEME_KEY, next); } catch(e){}
  }
  if(themeControl) themeControl.addEventListener('click', toggleTheme);
  if(themeControl) themeControl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleTheme(); }});

  // Elements
  const el = {
    jobTitle: document.getElementById('jobTitle'),
    jobId: document.getElementById('jobId'),
    jobLocation: document.getElementById('jobLocation'),
    jobDept: document.getElementById('jobDepartment'),
    jobPosted: document.getElementById('jobPostedDate'),
    jobStatus: document.getElementById('jobStatus'),
    applicants: document.getElementById('applicants'),
    applicantCount: document.getElementById('applicantCount'),
    searchBox: document.getElementById('searchBox'),
    statusFilter: document.getElementById('statusFilter'),
    stats: {
      total: document.getElementById('totalApplicants'),
      New: document.getElementById('newApplicants'),
      Review: document.getElementById('reviewApplicants'),
      Accepted: document.getElementById('acceptedApplicants'),
      Rejected: document.getElementById('rejectedApplicants')
    },
    backBtn: document.getElementById('backBtn'),
    moveNextBtn: document.getElementById('moveNextBtn')
  };

  function badgeForStatus(s){
    if(s === 'active') return 'badge b-active';
    if(s === 'pending') return 'badge b-pending';
    if(s === 'closed') return 'badge b-closed';
    return 'badge';
  }

  function chipForApplicantStatus(s){
    if(s === 'new') return 'app-status s-new';
    if(s === 'under-review') return 'app-status s-under-review';
    if(s === 'accepted') return 'app-status s-accepted';
    if(s === 'rejected') return 'app-status s-rejected';
    return 'app-status';
  }

  function formatDate(iso){
    if(!iso) return 'N/A';
    try { return new Date(iso).toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}); } catch(e){ return iso; }
  }

  // URL param
  const params = new URLSearchParams(window.location.search);
  const currentJobId = params.get('id');

  if(el.backBtn){ el.backBtn.addEventListener('click', ()=>{ window.location.href = '/hr-dashboard/dashboard.html'; }); }

  let allApplicants = [];

  async function loadJob(){
    if(!currentJobId) return;
    try{
      const resp = await fetch(`/api/jobs/${currentJobId}`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const job = await resp.json();
      renderJob(job);
    } catch(e){
      // fallback demo
      const job = { id: currentJobId, title: 'Job #' + currentJobId, department: '—', location: '—', status:'pending', postedDate: null };
      renderJob(job);
    }
  }

  function renderJob(job){
    if(el.jobTitle) el.jobTitle.textContent = job.title || 'Untitled Role';
    if(el.jobId) el.jobId.textContent = `Job ID: ${job.id ?? '—'}`;
    if(el.jobLocation) el.jobLocation.textContent = job.location || '—';
    if(el.jobDept) el.jobDept.textContent = job.department || '—';
    if(el.jobPosted) el.jobPosted.textContent = formatDate(job.postedDate);
    if(el.jobStatus){ el.jobStatus.textContent = (job.status||'').replace(/^./, m=>m.toUpperCase()); el.jobStatus.className = badgeForStatus(job.status); }
  }

  async function loadApplicants(){
    if(!currentJobId) return;
    try{
      const resp = await fetch(`/api/jobs/${currentJobId}/applicants`, { headers: { 'Accept':'application/json' }});
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allApplicants = Array.isArray(data) ? data : [];
      updateStats();
      renderApplicants();
    } catch(e){
      // Show empty state with demo fallback
      allApplicants = [];
      updateStats();
      renderApplicants();
    }
  }

  function updateStats(){
    const stats = {
      total: allApplicants.length,
      new: allApplicants.filter(a=>a.status==='new').length,
      review: allApplicants.filter(a=>a.status==='under-review').length,
      accepted: allApplicants.filter(a=>a.status==='accepted').length,
      rejected: allApplicants.filter(a=>a.status==='rejected').length
    };
    if(el.applicantCount) el.applicantCount.textContent = String(stats.total);
    if(el.stats.total) el.stats.total.textContent = String(stats.total);
    if(el.stats.New) el.stats.New.textContent = String(stats.new);
    if(el.stats.Review) el.stats.Review.textContent = String(stats.review);
    if(el.stats.Accepted) el.stats.Accepted.textContent = String(stats.accepted);
    if(el.stats.Rejected) el.stats.Rejected.textContent = String(stats.rejected);
  }

  function filteredApplicants(){
    const term = (el.searchBox?.value || '').toLowerCase();
    const status = el.statusFilter?.value || 'all';
    return allApplicants.filter(a => {
      const matchesTerm = !term || (String(a.name||'').toLowerCase().includes(term) || String(a.email||'').toLowerCase().includes(term));
      const matchesStatus = (status === 'all') || a.status === status;
      return matchesTerm && matchesStatus;
    });
  }

  function renderApplicants(){
    const list = filteredApplicants();
    if(!list.length){ el.applicants.innerHTML = '<div class="center">No applicants yet</div>'; return; }
    el.applicants.innerHTML = list.map(a => `
      <div class="app-card" data-app-id="${a.id}" data-applicant-id="${a.applicantId}">
        <div class="app-head">
          <div>
            <div class="app-name">${a.name || 'Unnamed Candidate'}</div>
            <div class="app-details">
              <span>📧 ${a.email || '—'}</span>
              <span>📱 ${a.phone || '—'}</span>
              <span>💼 Experience: ${a.experience || '—'}</span>
              <span>📅 Applied: ${formatDate(a.appliedDate)}</span>
            </div>
          </div>
          <span class="${chipForApplicantStatus(a.status)}">${(a.status||'').split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}</span>
        </div>
        <div class="actions">
          <button class="btn success" data-action="accept" ${a.status==='accepted' || a.status==='rejected' ? 'disabled' : ''}>✓ Accept</button>
          <button class="btn danger" data-action="reject" ${a.status==='accepted' || a.status==='rejected' ? 'disabled' : ''}>✗ Reject</button>
          <button class="btn" data-action="next" ${a.status!=='accepted' ? 'disabled' : ''}>Next Round →</button>
        </div>
      </div>
    `).join('');

    // wire actions
    el.applicants.querySelectorAll('.app-card').forEach(card => {
      const applicantId = Number(card.getAttribute('data-applicant-id'));
      card.querySelector('[data-action="accept"]').addEventListener('click', ()=> acceptApplicant(applicantId));
      card.querySelector('[data-action="reject"]').addEventListener('click', ()=> rejectApplicant(applicantId));
      card.querySelector('[data-action="next"]').addEventListener('click', ()=> moveOneToNext(applicantId));
    });
  }

  // Actions
  async function acceptApplicant(applicantId){
    try{
      const resp = await fetch(`/api/applicants/${applicantId}/accept?jobId=${encodeURIComponent(currentJobId)}`, { method:'POST', headers:{'Content-Type':'application/json'} });
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const a = allApplicants.find(x=>x.applicantId === applicantId);
      if(a){ a.status = 'accepted'; }
      updateStats();
      renderApplicants();
      alert('Applicant accepted successfully!');
    }catch(e){ alert('Failed to accept applicant.'); }
  }

  async function rejectApplicant(applicantId){
    if(!confirm('Are you sure you want to reject this applicant?')) return;
    try{
      const resp = await fetch(`/api/applicants/${applicantId}/reject?jobId=${encodeURIComponent(currentJobId)}`, { method:'POST', headers:{'Content-Type':'application/json'} });
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const a = allApplicants.find(x=>x.applicantId === applicantId);
      if(a){ a.status = 'rejected'; }
      updateStats();
      renderApplicants();
      alert('Applicant rejected.');
    }catch(e){ alert('Failed to reject applicant.'); }
  }

  function moveOneToNext(applicantId){
    window.location.href = `next-round.html?jobId=${encodeURIComponent(currentJobId)}&applicantId=${encodeURIComponent(applicantId)}`;
  }

  if(el.moveNextBtn){
    el.moveNextBtn.addEventListener('click', ()=>{
      const accepted = allApplicants.filter(a=>a.status==='accepted');
      if(!accepted.length){ alert('No accepted applicants to move to next round.'); return; }
      const ids = accepted.map(a=>a.applicantId).join(',');
      window.location.href = `next-round.html?jobId=${encodeURIComponent(currentJobId)}&applicantIds=${encodeURIComponent(ids)}`;
    });
  }

  // search/filter
  if(el.searchBox) el.searchBox.addEventListener('input', renderApplicants);
  if(el.statusFilter) el.statusFilter.addEventListener('change', renderApplicants);

  // init
  if(!currentJobId){
    el.applicants.innerHTML = '<div class="center">No job ID provided.</div>';
  } else {
    loadJob();
    loadApplicants();
  }
})();
