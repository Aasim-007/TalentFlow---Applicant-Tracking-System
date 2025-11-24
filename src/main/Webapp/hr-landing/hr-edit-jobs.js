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

  const jobsEl = document.getElementById('jobs');
  const errorEl = document.getElementById('errorBox');

  function formatDate(iso){
    if(!iso) return 'N/A';
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    } catch(e){ return iso; }
  }

  async function loadJobs(){
    try{
      errorEl.style.display = 'none';
      jobsEl.innerHTML = '<div class="center">Loading draft jobs…</div>';

      // Fetch ALL jobs (no user ID filtering needed for HR)
      const resp = await fetch('/api/jobs');
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const allJobs = await resp.json();

      // Filter only draft jobs on the frontend
      const draftJobs = allJobs.filter(job => job.status === 'draft');

      if(!draftJobs || draftJobs.length === 0){
        jobsEl.innerHTML = '<div class="center">No draft jobs found. All jobs are either published or closed.</div>';
        return;
      }

      jobsEl.innerHTML = draftJobs.map(j => `
        <div class="job" role="button" tabindex="0" data-id="${j.id}">
          <div>
            <div class="title">${j.title || 'Untitled Role'}</div>
            <div class="meta">
              <span>📍 ${j.location || 'Not specified'}</span>
              <span>🏢 ${j.department || 'General'}</span>
              <span>📅 Deadline: ${formatDate(j.applicationDeadline)}</span>
            </div>
          </div>
          <span class="badge b-pending">Pending</span>
        </div>
      `).join('');

      // Attach navigation handlers
      jobsEl.querySelectorAll('.job').forEach(el=>{
        const id = el.getAttribute('data-id');
        function nav(){ window.location.href = `/edit-job/edit-job.html?jobId=${id}`; }
        el.addEventListener('click', nav);
        el.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); nav(); }});
      });

    }catch(err){
      console.error('Failed to load jobs', err);
      errorEl.textContent = err.message || 'Failed to load jobs. Please try again later.';
      errorEl.style.display = 'block';
      jobsEl.innerHTML = '<div class="center">Unable to load jobs</div>';
    }
  }

  loadJobs();
})();

