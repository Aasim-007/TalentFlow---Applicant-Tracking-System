/* Edit Job Script */
const LOGO_PATH = '/mnt/data/768cd4e5-99cb-4c49-8d26-101d01b8b283.png';

/* Update endpoint for editing jobs */
const UPDATE_JOB_URL = '/api/jobs/update';

// Job ID from URL parameter
let CURRENT_JOB_ID = null;

// Global function for copying form link
window.copyFormLink = function() {
    const input = document.getElementById('formLinkInput');
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices
        try {
            document.execCommand('copy');
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = 'var(--accent1)';
            }, 2000);
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(input.value).then(() => {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                btn.style.background = 'var(--success)';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = 'var(--accent1)';
                }, 2000);
            }).catch(err => {
                alert('Failed to copy link. Please copy manually.');
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const themeControl = document.getElementById('themeControl');
    const themeLabel = document.getElementById('themeLabel');
    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');

    const jdList = document.getElementById('jdList');
    const departmentEl = document.getElementById('department');
    const locationEl = document.getElementById('location');
    const employmentTypeEl = document.getElementById('employmentType');
    const salaryMinEl = document.getElementById('salaryMin');
    const salaryMaxEl = document.getElementById('salaryMax');
    const applicationDeadlineEl = document.getElementById('applicationDeadline');
    const descriptionSummaryEl = document.getElementById('descriptionSummary');
    const jobStatusEl = document.getElementById('jobStatus');
    const managerSelectEl = document.getElementById('managerSelect');
    const addJDBtn = document.getElementById('addJD');
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusEl = document.getElementById('status');
    const errorListEl = document.getElementById('errorList');
    const jobTitleEl = document.getElementById('jobTitle');
    const mainContent = document.getElementById('mainContent');

    let managerLookup = {}; // cache id->name

    // theme
    const THEME_KEY = 'cv_addjob_theme_final_v2';
    function applyTheme(t){
        if(t === 'light') body.classList.add('theme-light'); else body.classList.remove('theme-light');
        themeLabel.textContent = (t === 'light') ? 'Light Mode' : 'Dark Mode';
        if(themeControl) themeControl.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
        body.style.backgroundAttachment = 'fixed';
        body.style.minHeight = '100vh';
        body.style.backgroundSize = 'cover';
    }
    const savedTheme = (function(){ try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch(e){ return 'dark'; } })();
    applyTheme(savedTheme);
    function toggleTheme(){ const cur = body.classList.contains('theme-light') ? 'light' : 'dark'; const next = cur === 'light' ? 'dark' : 'light'; applyTheme(next); try{ localStorage.setItem(THEME_KEY, next); } catch(e){} }
    if(themeControl) themeControl.addEventListener('click', toggleTheme);
    if(themeControl) themeControl.addEventListener('keydown', (e)=> { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTheme(); } });

    // Get job ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    CURRENT_JOB_ID = urlParams.get('jobId');

    console.log('Edit Job Page - Job ID from URL:', CURRENT_JOB_ID);

    if (!CURRENT_JOB_ID) {
        console.error('No job ID provided in URL');
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.innerHTML = `
                <section class="card" style="text-align:center;padding:60px 20px;">
                    <div style="font-size:64px;margin-bottom:20px;">⚠️</div>
                    <h2 style="margin:0 0 12px 0;color:var(--danger);">Invalid URL</h2>
                    <p class="muted">Missing job ID in URL. Please provide ?jobId=X</p>
                    <button onclick="window.location.href='/index.html'" class="btn" style="margin-top:20px;">← Back to Dashboard</button>
                </section>
            `;
        }
        return;
    }

    // Load existing job data
    async function loadJobData() {
        console.log('loadJobData() called for job ID:', CURRENT_JOB_ID);
        try {
            // Show loading screen
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) loadingScreen.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';

            console.log('Fetching job from:', `/api/jobs/${CURRENT_JOB_ID}`);
            const response = await fetch(`/api/jobs/${CURRENT_JOB_ID}`);
            console.log('Response status:', response.status);

            const data = await response.json();
            console.log('Response data:', data);

            if (data.status === 'error') {
                console.error('Server returned error:', data.reason);
                hideLoadingShowError('Failed to load job: ' + (data.reason || 'Unknown error'));
                return;
            }

            // Check if job can be edited (only draft jobs)
            const jobStatus = data.status ? data.status.toLowerCase() : '';
            if (jobStatus === 'published' || jobStatus === 'closed') {
                hideLoadingShowError(
                    `This job is ${jobStatus} and cannot be edited. Only draft jobs can be modified.`,
                    'Job Cannot Be Edited',
                    true
                );
                return;
            }

            // Hide loading screen and show form
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block';

            // Populate form fields
            if(jobTitleEl) jobTitleEl.value = data.title || '';
            if(departmentEl) departmentEl.value = data.department || '';
            if(locationEl) locationEl.value = data.location || '';
            if(employmentTypeEl && data.employmentType) employmentTypeEl.value = data.employmentType;
            if(salaryMinEl) salaryMinEl.value = data.salaryMin || '';
            if(salaryMaxEl) salaryMaxEl.value = data.salaryMax || '';
            if(applicationDeadlineEl && data.applicationDeadline) {
                // Convert ISO string to datetime-local format
                const dt = new Date(data.applicationDeadline);
                const year = dt.getFullYear();
                const month = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                const hours = String(dt.getHours()).padStart(2, '0');
                const minutes = String(dt.getMinutes()).padStart(2, '0');
                applicationDeadlineEl.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
            if(descriptionSummaryEl) descriptionSummaryEl.value = data.descriptionSummary || '';
            if(jobStatusEl && data.status) jobStatusEl.value = data.status;
            if(managerSelectEl && data.managedByManagerId) managerSelectEl.value = data.managedByManagerId;

            // Load JDs
            if(jdList) jdList.innerHTML = '';
            if(data.jobDescriptions && data.jobDescriptions.length > 0) {
                data.jobDescriptions.forEach(jd => {
                    addNewJD({ title: jd.title, description: jd.description, weight: jd.weightage }, true);
                });
            } else {
                addNewJD({}, true);
            }

            // Update page hint
            const pageHint = document.getElementById('pageHint');
            if(pageHint) pageHint.textContent = 'Edit job details and descriptions';

        } catch (error) {
            hideLoadingShowError('Error loading job: ' + error.message);
        }
    }

    function hideLoadingShowError(message, title = 'Error Loading Job', showBackButton = true) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';

        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.innerHTML = `
                <section class="card" style="text-align:center;padding:60px 20px;">
                    <div style="font-size:64px;margin-bottom:20px;">⚠️</div>
                    <h2 style="margin:0 0 12px 0;color:var(--danger);font-size:18px;font-weight:600;">${escapeHtml(title)}</h2>
                    <p class="muted" style="margin:0 0 20px 0;max-width:500px;margin-left:auto;margin-right:auto;">${escapeHtml(message)}</p>
                    ${showBackButton ? '<button onclick="window.location.href=\'/index.html\'" class="btn" style="margin-top:20px;">← Back to Dashboard</button>' : ''}
                </section>
            `;
        }
    }

    // JD management
    let jdCounter = 0;
    function createField(labelText, tag='input', attrs={}){
        const wrapper = document.createElement('div'); wrapper.className='field';
        const label = document.createElement('label'); label.className='small'; label.textContent = labelText;
        let el;
        if(tag === 'textarea'){ el = document.createElement('textarea'); el.rows = attrs.rows || 2; }
        else { el = document.createElement('input'); el.type = attrs.type || 'text'; }
        el.className = 'input';
        if(attrs.placeholder) el.placeholder = attrs.placeholder;
        if(attrs.min !== undefined) el.min = attrs.min;
        if(attrs.max !== undefined) el.max = attrs.max;
        wrapper.appendChild(label); wrapper.appendChild(el);
        return { wrapper, el };
    }

    function makeJD(initial = {}){
        jdCounter++;
        const container = document.createElement('div'); container.className='jd'; container.dataset.id = 'jd_' + jdCounter;
        const t = createField('Title','input',{placeholder:'e.g. Technical Skills'});
        const d = createField('Description','textarea',{placeholder:'Describe expectations for this JD', rows:2});
        const w = createField('Weight (0–10)','input',{type:'number',min:0,max:10});
        t.el.value = initial.title || ''; d.el.value = initial.description || ''; w.el.value = (typeof initial.weight === 'number') ? initial.weight : 5;
        container.appendChild(t.wrapper); container.appendChild(d.wrapper); container.appendChild(w.wrapper);
        const controls = document.createElement('div'); controls.className='controls';
        const removeBtn = document.createElement('button'); removeBtn.type='button'; removeBtn.className='ghost'; removeBtn.textContent='Remove';
        removeBtn.addEventListener('click', ()=> { container.remove(); if(!jdList.querySelector('.jd')) addNewJD(); });
        controls.appendChild(removeBtn); container.appendChild(controls);
        setTimeout(()=> t.el.focus(), 40);
        return { container, fields: { title: t.el, desc: d.el, weight: w.el } };
    }

    function addNewJD(initial = {}, skipScroll = false){
        if(!jdList) return;
        const { container } = makeJD(initial);
        jdList.appendChild(container);
        if(!skipScroll) container.scrollIntoView({ behavior:'smooth', block:'center' });
    }

    // build payload & validation
    function buildPayload(){
        const jds = [];
        if(!jdList) return { job_title: jobTitleEl ? jobTitleEl.value.trim() : '', jds };
        jdList.querySelectorAll('.jd').forEach(node => {
            const inputs = node.querySelectorAll('.input');
            const title = inputs[0] ? inputs[0].value.trim() : '';
            const description = inputs[1] ? inputs[1].value.trim() : '';
            const weightRaw = inputs[2] ? inputs[2].value : '';
            const weight = weightRaw === '' ? null : Number(weightRaw);
            jds.push({ title, description, weight });
        });
        // collect new fields
        const payload = {
            job_title: jobTitleEl ? jobTitleEl.value.trim() : '',
            department: departmentEl ? departmentEl.value.trim() : null,
            location: locationEl ? locationEl.value.trim() : null,
            employment_type: employmentTypeEl ? employmentTypeEl.value : null,
            salary_min: salaryMinEl && salaryMinEl.value ? Number(salaryMinEl.value) : null,
            salary_max: salaryMaxEl && salaryMaxEl.value ? Number(salaryMaxEl.value) : null,
            application_deadline: applicationDeadlineEl && applicationDeadlineEl.value ? new Date(applicationDeadlineEl.value).toISOString() : null,
            description_summary: descriptionSummaryEl ? descriptionSummaryEl.value.trim() : null,
            status: jobStatusEl ? jobStatusEl.value : null,
            managed_by_manager_id: managerSelectEl && managerSelectEl.value && managerSelectEl.value !== '' ? Number(managerSelectEl.value) : null,
            jds: jds
        };
        return payload;
    }

    // adjust validation to include all required fields except manager
    function validatePayload(payload){
        const errs = [];
        if(!payload.job_title) errs.push('Job title is required.');
        if(!payload.department) errs.push('Department is required.');
        if(!payload.location) errs.push('Location is required.');
        if(!payload.employment_type) errs.push('Employment type is required.');
        if(payload.salary_min === null || Number.isNaN(payload.salary_min)) errs.push('Salary min is required.');
        if(payload.salary_max === null || Number.isNaN(payload.salary_max)) errs.push('Salary max is required.');
        if(payload.salary_min != null && payload.salary_max != null && payload.salary_min > payload.salary_max) errs.push('Salary min cannot exceed salary max.');
        if(!payload.application_deadline) errs.push('Application deadline is required.');
        if(!payload.description_summary) errs.push('Description summary is required.');
        if(!payload.status) errs.push('Status is required.');
        if(!Array.isArray(payload.jds) || payload.jds.length === 0) errs.push('At least one Job Description is required.');
        payload.jds.forEach((jd,i) => {
            if(!jd.title) errs.push(`JD #${i+1}: Title required.`);
            if(!jd.description) errs.push(`JD #${i+1}: Description required.`);
            if(jd.weight === null || Number.isNaN(jd.weight)) errs.push(`JD #${i+1}: Weight required (0–10).`);
            else if(jd.weight < 0 || jd.weight > 10) errs.push(`JD #${i+1}: Weight must be 0–10.`);
        });
        return errs;
    }

    // progress helpers
    let progressTimer = null;
    function showProgress(){
        if(!progressWrap) return;
        progressWrap.style.display = 'block';
        progressBar.style.width = '4%';
        clearTimeout(progressTimer);
        progressTimer = setTimeout(()=> progressBar.style.width = '28%', 80);
        progressTimer = setTimeout(()=> progressBar.style.width = '60%', 700);
    }
    function setProgressDone(){
        if(!progressWrap) return;
        progressBar.style.width = '100%';
        clearTimeout(progressTimer);
        setTimeout(()=> { progressWrap.style.display='none'; progressBar.style.width='0%'; }, 420);
    }
    function hideProgressInstant(){
        if(!progressWrap) return;
        progressWrap.style.display='none';
        progressBar.style.width='0%';
    }

    // errors
    function showErrors(arr, isValidation = false){
        if(!errorListEl) return;
        errorListEl.style.display = 'block';
        let html = '';
        if(isValidation){
            html = '<div style="font-weight:700;margin-bottom:8px;font-size:15px;">• Validation Errors</div>';
        }
        html += '<ul>' + arr.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>';
        errorListEl.innerHTML = html;
        errorListEl.scrollIntoView({ behavior:'smooth', block:'center' });
    }
    function clearErrors(){ if(errorListEl){ errorListEl.style.display='none'; errorListEl.innerHTML=''; } }

    // send - updated for edit mode
    async function sendToWebhook(){
        clearErrors();
        statusEl.textContent = '';
        const payload = buildPayload();
        const validation = validatePayload(payload);
        if(validation.length){ showErrors(validation, true); statusEl.textContent = 'Validation error'; return; }

        // Add JobID to payload for update - ensure it's a number
        payload.JobID = Number(CURRENT_JOB_ID);

        console.log('Sending update payload:', JSON.stringify(payload, null, 2));

        showProgress();
        if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Updating...' }

        try {
            const res = await fetch(UPDATE_JOB_URL, {
                method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload)
            });

            console.log('Update response status:', res.status);

            // attempt to parse JSON safely
            let data = null;
            try {
                const responseText = await res.text();
                console.log('Update response text:', responseText);
                data = responseText ? JSON.parse(responseText) : null;
                console.log('Update response data:', data);
            } catch(e){
                console.error('Failed to parse response:', e);
                data = null;
            }

            // If server returned non-2xx, show reason if present
            if(!res.ok){
                const serverMsg = (data && (data.reason || data.error || data.message || data.details))
                    ? (data.reason || data.error || data.message || data.details)
                    : (res.statusText || ('Status ' + res.status));
                console.error('Update failed:', serverMsg);
                showErrors([`Update failed (${res.status}): ${serverMsg}`]);
                statusEl.textContent = 'Update failed';
                return;
            }

            // At this point res.ok. Check the returned JSON "status" property:
            if(!data){
                // 2xx but no JSON - treat as success
                setProgressDone();
                showUpdateSuccess(payload);
                return;
            }

            const lowerStatus = (typeof data.status === 'string') ? data.status.toLowerCase() : null;
            if(lowerStatus === 'error'){
                // show the server-provided reason
                const reason = data.reason || data.message || 'Unknown server error';
                showErrors([reason]);
                statusEl.textContent = 'Update failed';
                return;
            }
            if(lowerStatus === 'success'){
                // success
                setProgressDone();
                showUpdateSuccess(payload);
                return;
            }

            // If we get here: 2xx but status not provided — show error
            showErrors(['Update completed but server response was unclear. Please refresh to verify.']);
            statusEl.textContent = 'Update status unclear';
            return;

        } catch (err) {
            showErrors([`Network error: ${err.message || err}`]);
            statusEl.textContent = 'Update failed';
        } finally {
            if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Update Job' }
            setTimeout(()=> hideProgressInstant(), 800);
        }
    }

    // Summary view now shows all job fields
    function showSavedView(payload, jobId, formLink){
        const savedDiv = document.createElement('div'); savedDiv.className = 'saved-view';
        const title = document.createElement('h2'); title.textContent = payload.job_title || 'Untitled Job'; title.style.margin='0 0 12px 0';

        // Show form link prominently if available
        if(formLink) {
            const linkBox = document.createElement('div');
            linkBox.style.background='linear-gradient(135deg,rgba(96,165,250,0.12),rgba(110,231,183,0.12))';
            linkBox.style.border='1px solid rgba(96,165,250,0.25)';
            linkBox.style.borderRadius='10px';
            linkBox.style.padding='12px 14px';
            linkBox.style.marginBottom='18px';
            linkBox.innerHTML = `
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px;">Application Form Link</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="text" readonly value="${window.location.origin}${formLink}" id="formLinkInput" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);background:rgba(255,255,255,0.05);color:var(--text);font-size:13px;font-family:monospace;">
                    <button onclick="copyFormLink()" style="padding:8px 12px;border-radius:6px;border:0;background:var(--accent1);color:#fff;cursor:pointer;font-weight:600;font-size:13px;">Copy</button>
                </div>
            `;
            savedDiv.appendChild(linkBox);
        }

        const metaGrid = document.createElement('div'); metaGrid.style.display='grid'; metaGrid.style.gridTemplateColumns='repeat(auto-fit,minmax(220px,1fr))'; metaGrid.style.gap='12px'; metaGrid.style.marginBottom='18px';
        const addMeta = (label,val) => {
            const box = document.createElement('div'); box.style.background='rgba(255,255,255,0.03)'; box.style.border='1px solid rgba(0,0,0,0.06)'; box.style.borderRadius='10px'; box.style.padding='10px 12px'; box.style.minHeight='60px';
            const l = document.createElement('div'); l.style.fontSize='11px'; l.style.letterSpacing='.5px'; l.style.textTransform='uppercase'; l.style.color='var(--muted)'; l.textContent = label;
            const v = document.createElement('div'); v.style.marginTop='6px'; v.style.fontWeight='600'; v.style.wordBreak='break-word'; v.textContent = val ?? '—';
            box.appendChild(l); box.appendChild(v); metaGrid.appendChild(box);
        };
        savedDiv.appendChild(title);
        const formatDateTime = iso => { if(!iso) return '—'; try { const d = new Date(iso); if(isNaN(d.getTime())) return '—'; return d.toLocaleString(); } catch(e){ return '—'; } };
        addMeta('Department', payload.department);
        addMeta('Location', payload.location);
        addMeta('Employment Type', payload.employment_type?.replace('_',' ') );
        addMeta('Salary Min', payload.salary_min != null ? String(payload.salary_min) : '—');
        addMeta('Salary Max', payload.salary_max != null ? String(payload.salary_max) : '—');
        addMeta('Application Deadline', formatDateTime(payload.application_deadline));
        addMeta('Status', payload.status);
        addMeta('Manager', payload.managed_by_manager_id ? (managerLookup[payload.managed_by_manager_id] || ('ID ' + payload.managed_by_manager_id)) : '—');
        addMeta('Description Summary', payload.description_summary);
        if(jobId != null) addMeta('Job ID', jobId);

        const jdHeader = document.createElement('h3'); jdHeader.textContent='Job Descriptions'; jdHeader.style.margin='0 0 10px 0'; jdHeader.style.fontSize='15px'; jdHeader.style.fontWeight='600';
        const table = document.createElement('div'); table.style.display='grid'; table.style.gap='10px';
        payload.jds.forEach((jd, idx) => {
            const row = document.createElement('div'); row.style.display='grid'; row.style.gridTemplateColumns='1fr 90px'; row.style.gap='12px'; row.style.alignItems='start'; row.style.background='rgba(255,255,255,0.03)'; row.style.border='1px solid rgba(0,0,0,0.05)'; row.style.padding='10px 12px'; row.style.borderRadius='10px';
            const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(jd.title || 'JD #' + (idx+1))}</strong><div style="color:var(--muted);margin-top:6px;font-size:13px">${escapeHtml(jd.description || '')}</div>`;
            const right = document.createElement('div'); right.style.textAlign='right'; right.innerHTML = `<div style="font-weight:700">${jd.weight===null?'—':escapeHtml(String(jd.weight))}</div><div class="muted" style="font-size:11px;letter-spacing:.5px;text-transform:uppercase;margin-top:4px">Weight</div>`;
            row.appendChild(left); row.appendChild(right); table.appendChild(row);
        });

        const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='10px'; actions.style.marginTop='18px'; actions.style.justifyContent='flex-end';

        // Edit Job button
        const editBtn = document.createElement('button');
        editBtn.className='btn';
        editBtn.textContent='Edit Job';
        if(jobId !== null && jobId !== undefined) {
            editBtn.addEventListener('click', () => {
                window.location.href = '/edit-job/edit-job.html?jobId=' + jobId;
            });
        } else {
            editBtn.disabled = true;
        }

        // Back to Dashboard button
        const dashboardBtn = document.createElement('button');
        dashboardBtn.className='ghost';
        dashboardBtn.textContent='← Back to Dashboard';
        dashboardBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });

        actions.appendChild(editBtn);
        actions.appendChild(dashboardBtn);

        savedDiv.appendChild(title);
        savedDiv.appendChild(metaGrid);
        savedDiv.appendChild(jdHeader);
        savedDiv.appendChild(table);
        savedDiv.appendChild(actions);

        // replace main content with saved view
        mainContent.innerHTML = '';
        const wrapper = document.createElement('section'); wrapper.className='card'; wrapper.appendChild(savedDiv);
        mainContent.appendChild(wrapper);
    }

    function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

    // Show update success message
    function showUpdateSuccess(payload) {
        document.getElementById('mainContent').innerHTML = `
            <section class="card" style="text-align:center;padding:40px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">✓</div>
                <h2 style="margin:0 0 12px 0;color:var(--success);">Job Updated Successfully!</h2>
                <p class="muted" style="margin:0 0 20px 0;">Your changes have been saved.</p>
                <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;">
                    <button onclick="window.location.href='/index.html'" class="btn">← Back to Dashboard</button>
                    <button onclick="window.location.reload()" class="ghost">Edit Again</button>
                </div>
            </section>
        `;
    }

    // bindings
    if(addJDBtn) addJDBtn.addEventListener('click', ()=> addNewJD());
    if(saveBtn) saveBtn.addEventListener('click', ()=> sendToWebhook());

    // Cancel button - go back to dashboard
    const cancelBtn = document.getElementById('cancelBtn');
    if(cancelBtn) cancelBtn.addEventListener('click', ()=> {
        if(confirm('Cancel editing? Any unsaved changes will be lost.')) {
            window.location.href = '/index.html';
        }
    });

    // fetch enums and managers to populate selects
    async function fetchOptions(){
        try {
            const employmentTypes = ['full_time','part_time','contract','internship'];
            if(employmentTypeEl) employmentTypes.forEach(v => {
                const o = document.createElement('option');
                o.value = v;
                // Proper capitalization: "Full Time", "Part Time", "Contract", "Internship"
                o.textContent = v.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                employmentTypeEl.appendChild(o);
            });

            const statuses = ['draft','published','closed'];
            if(jobStatusEl) statuses.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v.charAt(0).toUpperCase() + v.slice(1); jobStatusEl.appendChild(o); });

            if(managerSelectEl){
                const ph = document.createElement('option'); ph.value=''; ph.textContent='-- Select manager --'; ph.selected = true; managerSelectEl.appendChild(ph);
                const res = await fetch('/api/jobs/managers');
                if(res.ok){
                    const data = await res.json();
                    if(Array.isArray(data) && data.length){
                        data.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; managerSelectEl.appendChild(o); managerLookup[m.id] = m.name; });
                    } else {
                        const none = document.createElement('option'); none.value=''; none.textContent='(no managers found)'; managerSelectEl.appendChild(none);
                    }
                } else {
                    const errOpt = document.createElement('option'); errOpt.value=''; errOpt.textContent='(failed to load managers)'; managerSelectEl.appendChild(errOpt);
                }
            }
        } catch(e){ console.warn('Failed to fetch options', e); }
    }

    // Fetch options and then load job data
    (async function init() {
        console.log('Initializing edit-job page...');
        try {
            console.log('Fetching dropdown options...');
            await fetchOptions();
            console.log('Options fetched, now loading job data...');
            await loadJobData();
            console.log('Job data loaded successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            hideLoadingShowError('Failed to load page: ' + error.message);
        }
    })();

    document.addEventListener('keydown', (e)=> { if((e.ctrlKey||e.metaKey) && e.key === 'Enter') sendToWebhook(); });


    // Make the visible calendar icon interactive: forward clicks on the wrapper to the input
    (function wireCalendarClick(){
        const deadlineInput = document.getElementById('applicationDeadline');
        if(!deadlineInput) return;
        const wrapper = deadlineInput.closest('.field');
        if(!wrapper) return;
        // show pointer over wrapper so users know it's clickable
        wrapper.style.cursor = 'text';

        // If a dedicated trigger button exists, wire it — easier to control event behavior
        const trigger = wrapper.querySelector('.calendar-trigger');
        const openPicker = () => {
            try{
                // Preferred modern API
                if(typeof deadlineInput.showPicker === 'function'){
                    deadlineInput.showPicker();
                    return;
                }
            } catch(e){ /* ignore */ }

            // Fallbacks: focus and synthesize user-like events. Some browsers only open picker on user gesture.
            try{ deadlineInput.focus(); } catch(e){}

            try{
                // Dispatch mousedown/mouseup/click sequence
                const mdown = new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true });
                const mup = new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true });
                const mclick = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                deadlineInput.dispatchEvent(mdown);
                setTimeout(() => {
                    try{ deadlineInput.dispatchEvent(mup); } catch(e){}
                    try{ deadlineInput.dispatchEvent(mclick); } catch(e){}
                }, 10);
            } catch(e) {
                // final fallback
                try{ deadlineInput.click(); } catch(err){}
            }
        };
        if(trigger){
            trigger.addEventListener('click', (e) => { e.preventDefault(); openPicker(); });
            trigger.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } });
        } else {
            wrapper.addEventListener('click', (e) => { if(e.target === deadlineInput) return; openPicker(); });
        }
    })();

});

