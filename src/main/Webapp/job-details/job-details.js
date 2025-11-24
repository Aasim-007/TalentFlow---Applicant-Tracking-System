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
    if (s === 'shortlisted') return 'Accepted';
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
      accepted: allApplicants.filter(a=>a.status==='shortlisted').length,
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
          <button class="btn view-btn" data-action="view">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            View Details
          </button>
          <button class="btn reject-btn" data-action="reject" ${a.status==='rejected' ? 'disabled' : ''}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Reject
          </button>
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
    const isDark = !body.classList.contains('theme-light');

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease;';

    const bgColor = isDark ? '#0d1c31' : '#ffffff';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .modal-content { animation: slideUp 0.3s ease; }
        .detail-section { padding: 20px; border-radius: 10px; background: ${cardBg}; border: 1px solid ${borderColor}; margin-bottom: 16px; transition: all 0.2s ease; }
        .detail-section:hover { border-color: rgba(96,165,250,0.3); box-shadow: 0 4px 12px rgba(96,165,250,0.05); }
        .detail-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
        .detail-value { font-size: 15px; line-height: 1.6; }
        .info-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 14px; color: var(--text); }
        .info-row svg { width: 18px; height: 18px; opacity: 0.7; }
      </style>
      <div class="modal-content" style="background:${bgColor};border-radius:16px;max-width:950px;width:100%;max-height:92vh;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.4);display:flex;flex-direction:column;border:1px solid ${borderColor};">
        
        <!-- Header -->
        <div style="padding:28px 32px;border-bottom:1px solid ${borderColor};background:linear-gradient(135deg, ${isDark ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.06)'} 0%, transparent 100%);">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:20px;">
            <div style="flex:1;">
              <h2 style="margin:0 0 16px 0;font-size:26px;font-weight:700;background:linear-gradient(135deg,var(--accent1),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${escapeHtml(app.name)}</h2>
              <div style="display:grid;gap:8px;">
                <div class="info-row">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <span>${escapeHtml(app.email)}</span>
                </div>
                <div class="info-row">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  <span>${escapeHtml(app.phone || 'Not provided')}</span>
                </div>
                <div class="info-row">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>Applied ${formatDate(app.appliedDate)}</span>
                </div>
              </div>
            </div>
            <button id="closeModal" style="background:rgba(0,0,0,0.05);border:none;font-size:24px;cursor:pointer;color:var(--muted);padding:0;width:44px;height:44px;border-radius:10px;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;flex-shrink:0;" onmouseover="this.style.background='rgba(239,68,68,0.15)';this.style.color='#ef4444';" onmouseout="this.style.background='rgba(0,0,0,0.05)';this.style.color='var(--muted)';">×</button>
          </div>
        </div>
        
        <!-- Body -->
        <div style="padding:28px 32px;overflow-y:auto;flex:1;">
          
          <!-- Status & Score Row -->
          <div style="display:grid;grid-template-columns:${app.matchScore ? '1fr 1fr' : '1fr'};gap:16px;margin-bottom:24px;">
            <div class="detail-section" style="padding:18px;">
              <div class="detail-label">Application Status</div>
              <span class="${chipForApplicantStatus(app.status)}" style="display:inline-flex;margin-top:4px;font-size:13px;">${displayStatusName(app.status)}</span>
            </div>
            ${app.matchScore ? `
            <div class="detail-section" style="padding:18px;">
              <div class="detail-label">Match Score</div>
              <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;">
                <span style="font-size:36px;font-weight:800;background:linear-gradient(135deg,var(--accent1),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${Math.round(app.matchScore)}</span>
                <span style="font-size:18px;color:var(--muted);font-weight:600;">%</span>
              </div>
            </div>
            ` : ''}
          </div>
          
          <!-- Cover Letter -->
          <div class="detail-section">
            <div class="detail-label">Cover Letter</div>
            <div class="detail-value" style="padding-top:4px;white-space:pre-wrap;color:var(--text);">${escapeHtml(coverLetter)}</div>
          </div>
          
          <!-- CV -->
          ${cvPath ? `
          <div class="detail-section">
            <div class="detail-label">CV / Resume</div>
            <div style="margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid ${borderColor};">
              <embed src="/${cvPath}" type="application/pdf" width="100%" height="500px" style="display:block;" />
            </div>
            <a href="/${cvPath}" target="_blank" style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:${isDark ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.08)'};color:var(--accent1);border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid rgba(96,165,250,0.2);transition:all 0.2s ease;" onmouseover="this.style.background='rgba(96,165,250,0.18)';this.style.borderColor='rgba(96,165,250,0.4)';" onmouseout="this.style.background='${isDark ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.08)'}';this.style.borderColor='rgba(96,165,250,0.2)';">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:18px;height:18px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Open in New Tab
            </a>
          </div>
          ` : '<div class="detail-section"><div class="detail-label">CV / Resume</div><div style="color:var(--muted);padding-top:8px;">No CV uploaded</div></div>'}
          
        </div>
        
        <!-- Footer Actions -->
        ${app.status !== 'rejected' && (app.status !== 'shortlisted' || app.status === 'rejected') ? `
        <div style="padding:20px 32px;border-top:1px solid ${borderColor};display:flex;gap:12px;background:${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.01)'};">
          ${app.status !== 'rejected' && app.status !== 'shortlisted' ? `<button id="moveNext" style="flex:1;padding:14px 24px;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;border:none;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;transition:all 0.2s ease;box-shadow:0 4px 14px rgba(16,185,129,0.25);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.35)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 14px rgba(16,185,129,0.25)';">✓ Accept & Move to Next Round</button>` : ''}
          ${app.status !== 'rejected' ? `<button id="rejectApp" style="flex:1;padding:14px 24px;background:${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'};color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.borderColor='rgba(239,68,68,0.5)';" onmouseout="this.style.background='${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'}';this.style.borderColor='rgba(239,68,68,0.3)';">✕ Reject Application</button>` : ''}
        </div>
        ` : ''}
        
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
      if(a) a.status = 'shortlisted';

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

