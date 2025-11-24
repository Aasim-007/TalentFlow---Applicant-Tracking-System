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
  if(themeControl) themeControl.addEventListener('keydown', (e)=> { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleTheme(); }});

  const applicationsEl = document.getElementById('applications');
  const errorEl = document.getElementById('errorBox');

  function formatDate(iso){
    if(!iso) return 'N/A';
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch(e){ return iso; }
  }

  function formatEmploymentType(type) {
    if (!type) return 'N/A';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  function mapStatusDisplay(status) {
    const statusMap = {
      'submitted': 'Submitted',
      'under_review': 'Under Review',
      'shortlisted': 'Shortlisted',
      'rejected': 'Rejected',
      'interview_invite': 'Interview Invite',
      'offered': 'Offered',
      'hired': 'Hired'
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function statusBadgeClass(status) {
    return `badge b-${status}`;
  }

  async function loadApplications(){
    try{
      errorEl.style.display = 'none';
      applicationsEl.innerHTML = '<div class="center">Loading your applications…</div>';

      // Get current user from session
      const userResp = await fetch('/api/auth/current-user');
      if(!userResp.ok) {
        throw new Error('Not authenticated. Please login to view your applications.');
      }

      const userData = await userResp.json();
      const applicantId = userData.userId;

      if(!applicantId) {
        throw new Error('User ID not found. Please login again.');
      }

      // Fetch applications for this applicant
      const resp = await fetch(`/api/applicant/${applicantId}`);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const applications = await resp.json();

      if(!applications || applications.length === 0){
        applicationsEl.innerHTML = '<div class="center">You haven\'t applied to any jobs yet. <a href="/applicant-landing/jobs-list.html" style="color:var(--accent1);text-decoration:none;font-weight:600;">Browse Jobs</a></div>';
        return;
      }

      applicationsEl.innerHTML = applications.map(app => {
        const job = app.job || {};
        const hasScore = app.matchScore !== null && app.matchScore !== undefined;

        return `
          <div class="application">
            <div class="app-header">
              <div>
                <div class="app-title">${job.title || 'Job Title Unavailable'}</div>
                <div style="color:var(--muted);font-size:13px;margin-top:4px;">
                  Ref: ${app.applicationRef || app.id}
                </div>
              </div>
              <span class="${statusBadgeClass(app.status)}">${mapStatusDisplay(app.status)}</span>
            </div>
            
            <div class="app-meta">
              <div class="meta-row">
                <span>🏢</span>
                <span><strong>Department:</strong> ${job.department || 'N/A'}</span>
              </div>
              <div class="meta-row">
                <span>📍</span>
                <span><strong>Location:</strong> ${job.location || 'N/A'}</span>
              </div>
              <div class="meta-row">
                <span>💼</span>
                <span><strong>Type:</strong> ${formatEmploymentType(job.employmentType)}</span>
              </div>
              <div class="meta-row">
                <span>📅</span>
                <span><strong>Applied:</strong> ${formatDate(app.submittedAt)}</span>
              </div>
              ${hasScore ? `
              <div class="meta-row">
                <span class="score">
                  <span>🎯</span>
                  <span>Match Score: ${Math.round(app.matchScore)}%</span>
                </span>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

    }catch(err){
      console.error('Failed to load applications', err);
      errorEl.textContent = err.message || 'Failed to load applications. Please try again later.';
      errorEl.style.display = 'block';
      applicationsEl.innerHTML = '<div class="center">Unable to load applications</div>';
    }
  }

  loadApplications();
})();

