(function(){
  // Theme utilities
  const body = document.body;
  const themeControl = document.getElementById('themeControl');
  const themeLabel = document.getElementById('themeLabel');
  const THEME_KEY = 'talentflow_theme';

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
      review: document.getElementById('reviewApplicants'),
      accepted: document.getElementById('acceptedApplicants'),
      rejected: document.getElementById('rejectedApplicants')
    },
    backBtn: document.getElementById('backBtn'),
    moveNextBtn: document.getElementById('moveNextBtn')
  };

  const params = new URLSearchParams(window.location.search);
  const currentJobId = params.get('id');
  let allApplicants = [];
  let selectedApplicants = new Set();

  // Utility functions
  function escapeHtml(text){
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }

  function formatDate(iso){
    if(!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch(e){
      return iso;
    }
  }

  function badgeForStatus(s){
    if(s === 'published') return 'badge b-active';
    if(s === 'draft') return 'badge b-pending';
    if(s === 'closed') return 'badge b-closed';
    return 'badge';
  }

  function mapStatusForDisplay(dbStatus){
    if(dbStatus === 'published') return 'Active';
    if(dbStatus === 'draft') return 'Pending';
    if(dbStatus === 'closed') return 'Closed';
    return (dbStatus || '').replace(/^./, m=>m.toUpperCase());
  }

  function chipForApplicantStatus(s){
    const normalized = (s || '').replace('-', '_');
    return 'app-status s-' + normalized;
  }

  function displayStatusName(s){
    if (!s) return 'Unknown';
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Back button
  if(el.backBtn){
    el.backBtn.addEventListener('click', ()=>{
      window.location.href = '/hr-dashboard/dashboard.html';
    });
  }

  // Load job details
  async function loadJob(){
    if(!currentJobId) return;
    try{
      const resp = await fetch(`/api/jobs/${currentJobId}`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const job = await resp.json();
      renderJob(job);
    } catch(e){
      console.error('Error loading job:', e);
      const job = { id: currentJobId, title: 'Job #' + currentJobId, department: '—', location: '—', status:'draft', createdAt: null };
      renderJob(job);
    }
  }

  function renderJob(job){
    if(el.jobTitle) el.jobTitle.textContent = job.title || 'Untitled Role';
    if(el.jobId) el.jobId.textContent = `Job ID: ${job.id ?? '—'}`;
    if(el.jobLocation) el.jobLocation.textContent = job.location || '—';
    if(el.jobDept) el.jobDept.textContent = job.department || '—';
    if(el.jobPosted) el.jobPosted.textContent = formatDate(job.createdAt);
    if(el.jobStatus){
      el.jobStatus.textContent = mapStatusForDisplay(job.status);
      el.jobStatus.className = badgeForStatus(job.status);
    }
  }

  // Load applicants
  async function loadApplicants(){
    if(!currentJobId) return;
    try{
      const resp = await fetch(`/api/applications/jobs/${currentJobId}/applicants`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allApplicants = Array.isArray(data) ? data : [];
      console.log('Loaded applicants:', allApplicants);
      updateStats();
      renderApplicants();
    } catch(e){
      console.error('Error loading applicants:', e);
      allApplicants = [];
      updateStats();
      el.applicants.innerHTML = '<div class="center">Failed to load applicants. Please try again.</div>';
    }
  }

  function updateStats(){
    const stats = {
      total: allApplicants.length,
      review: allApplicants.filter(a=>a.status==='under_review').length,
      accepted: allApplicants.filter(a=>a.status==='accepted').length,
      rejected: allApplicants.filter(a=>a.status==='rejected').length
    };
    if(el.applicantCount) el.applicantCount.textContent = String(stats.total);
    if(el.stats.total) el.stats.total.textContent = String(stats.total);
    if(el.stats.review) el.stats.review.textContent = String(stats.review);
    if(el.stats.accepted) el.stats.accepted.textContent = String(stats.accepted);
    if(el.stats.rejected) el.stats.rejected.textContent = String(stats.rejected);
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
    if(!list.length){
      el.applicants.innerHTML = '<div class="center">No applicants match your filters</div>';
      return;
    }

    el.applicants.innerHTML = list.map(a => `
      <div class="app-card" data-app-id="${a.id}">
        <div class="app-head">
          <div>
            <div class="app-name">${escapeHtml(a.name || 'Unnamed Candidate')}</div>
            <div class="app-details">
              <span>📧 ${escapeHtml(a.email || '—')}</span>
              <span>📱 ${escapeHtml(a.phone || '—')}</span>
              ${a.matchScore ? `<span>🎯 Match Score: ${Math.round(a.matchScore)}%</span>` : ''}
              <span>📅 Applied: ${formatDate(a.appliedDate)}</span>
            </div>
          </div>
          <span class="${chipForApplicantStatus(a.status)}">${displayStatusName(a.status)}</span>
        </div>
        <div class="actions">
          <button class="btn" data-action="view">View Details</button>
          <button class="btn danger" data-action="reject" ${a.status==='rejected' ? 'disabled' : ''}>✗ Reject</button>
        </div>
      </div>
    `).join('');

    // Wire actions
    el.applicants.querySelectorAll('.app-card').forEach(card => {
      const appId = Number(card.getAttribute('data-app-id'));
      const app = allApplicants.find(a => a.id === appId);

      card.querySelector('[data-action="view"]').addEventListener('click', ()=> viewApplicant(app));
      card.querySelector('[data-action="reject"]').addEventListener('click', ()=> rejectApplicant(appId));
    });
  }

  // View individual applicant
  function viewApplicant(app){
    const cvPath = app.cvPath || '';
    const coverLetter = app.coverLetter || 'No cover letter provided.';

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

    modal.innerHTML = `
      <div style="background:${body.classList.contains('theme-light') ? '#ffffff' : '#0d1c31'};border-radius:12px;max-width:900px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding:24px;border-bottom:1px solid rgba(0,0,0,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h2 style="margin:0 0 8px 0;font-size:24px;">${escapeHtml(app.name)}</h2>
              <div style="color:var(--muted);font-size:14px;">
                <div>📧 ${escapeHtml(app.email)}</div>
                <div>📱 ${escapeHtml(app.phone || 'N/A')}</div>
                <div>📅 Applied: ${formatDate(app.appliedDate)}</div>
              </div>
            </div>
            <button id="closeModal" style="background:transparent;border:none;font-size:28px;cursor:pointer;color:var(--muted);padding:0;width:40px;height:40px;">×</button>
          </div>
        </div>
        
        <div style="padding:24px;">
          <div style="margin-bottom:24px;">
            <h3 style="margin:0 0 12px 0;font-size:18px;">Status</h3>
            <span class="${chipForApplicantStatus(app.status)}" style="display:inline-block;">${displayStatusName(app.status)}</span>
          </div>
          
          ${app.matchScore ? `
          <div style="margin-bottom:24px;">
            <h3 style="margin:0 0 12px 0;font-size:18px;">Match Score</h3>
            <div style="font-size:32px;font-weight:700;color:var(--accent2);">${Math.round(app.matchScore)}%</div>
          </div>
          ` : ''}
          
          <div style="margin-bottom:24px;">
            <h3 style="margin:0 0 12px 0;font-size:18px;">Cover Letter</h3>
            <div style="padding:16px;background:rgba(0,0,0,0.05);border-radius:8px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(coverLetter)}</div>
          </div>
          
          ${cvPath ? `
          <div style="margin-bottom:24px;">
            <h3 style="margin:0 0 12px 0;font-size:18px;">CV / Resume</h3>
            <embed src="/${cvPath}" type="application/pdf" width="100%" height="600px" style="border-radius:8px;border:1px solid rgba(0,0,0,0.1);" />
            <a href="/${cvPath}" target="_blank" class="btn" style="margin-top:12px;display:inline-block;text-decoration:none;">📄 Open CV in New Tab</a>
          </div>
          ` : '<div style="color:var(--muted);">No CV uploaded</div>'}
          
          <div style="display:flex;gap:12px;margin-top:24px;">
            ${app.status !== 'rejected' && app.status !== 'accepted' ? `<button id="moveNext" class="btn success" style="flex:1;">Accept & Move to Next Round</button>` : ''}
            ${app.status !== 'rejected' ? `<button id="rejectApp" class="btn danger" style="flex:1;">Reject Application</button>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const moveNextBtn = modal.querySelector('#moveNext');
    const rejectBtn = modal.querySelector('#rejectApp');

    if (moveNextBtn) {
      moveNextBtn.addEventListener('click', async () => {
        await acceptApplicant(app.id);
        modal.remove();
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', async () => {
        await rejectApplicant(app.id);
        modal.remove();
      });
    }
  }

  // Actions
  async function acceptApplicant(appId){
    try{
      const resp = await fetch(`/api/applications/applications/${appId}/accept`, {
        method:'POST',
        headers:{'Content-Type':'application/json'}
      });

      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const a = allApplicants.find(x => x.id === appId);
      if(a) a.status = 'accepted';

      updateStats();
      renderApplicants();

      showToast('Applicant accepted', 'success');
    } catch(e){
      console.error('Error accepting:', e);
      showToast('Failed to accept applicant', 'error');
    }
  }

  async function rejectApplicant(appId){
    if(!confirm('Are you sure you want to reject this applicant? A rejection notification will be sent.')) return;

    try{
      const resp = await fetch(`/api/applications/applications/${appId}/reject`, {
        method:'POST',
        headers:{'Content-Type':'application/json'}
      });

      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const a = allApplicants.find(x => x.id === appId);
      if(a) a.status = 'rejected';

      updateStats();
      renderApplicants();

      showToast('Applicant rejected. Notification sent.', 'success');
    } catch(e){
      console.error('Error rejecting:', e);
      showToast('Failed to reject applicant', 'error');
    }
  }

  // "Move Selected to Next Round" button
  if(el.moveNextBtn){
    el.moveNextBtn.addEventListener('click', async ()=>{
      const toAccept = allApplicants.filter(a => a.status === 'under_review');

      if(toAccept.length === 0){
        showToast('No applicants in "Under Review" status to move', 'error');
        return;
      }

      if(!confirm(`Accept ${toAccept.length} applicant(s) from "Under Review"?`)) return;

      el.moveNextBtn.disabled = true;
      el.moveNextBtn.textContent = 'Accepting...';

      try{
        await Promise.all(toAccept.map(a => acceptApplicant(a.id)));
        showToast(`${toAccept.length} applicant(s) accepted`, 'success');
      } catch(e){
        showToast('Some applicants failed to move', 'error');
      } finally{
        el.moveNextBtn.disabled = false;
        el.moveNextBtn.textContent = 'Move Selected to Next Round →';
      }
    });
  }

  // Search and filter
  if(el.searchBox) el.searchBox.addEventListener('input', renderApplicants);
  if(el.statusFilter) el.statusFilter.addEventListener('change', renderApplicants);

  // Toast notification
  function showToast(msg, type){
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;border-radius:8px;font-weight:600;z-index:10000;box-shadow:0 10px 40px rgba(0,0,0,0.3);`;
    toast.style.background = type === 'success' ? 'linear-gradient(90deg, #22c55e, #60a5fa)' : 'linear-gradient(90deg, #ef4444, #f97316)';
    toast.style.color = '#fff';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Initialize
  if(currentJobId){
    loadJob();
    loadApplicants();
  } else {
    el.applicants.innerHTML = '<div class="center">No job ID provided</div>';
  }

})();

