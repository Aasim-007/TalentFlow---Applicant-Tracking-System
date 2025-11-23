/* Keep uploaded path (not shown) */
const LOGO_PATH = '/mnt/data/768cd4e5-99cb-4c49-8d26-101d01b8b283.png';

/* EDIT_WORKFLOW_URL: set this to the URL of your edit workflow where user should be redirected.
Example: https://your-n8n-host/webhook/edit-job-workflow
The final redirect will be: EDIT_WORKFLOW_URL?JobID=101
*/
const EDIT_WORKFLOW_URL = '/add-job/edit';

/* Replace with your n8n POST webhook that saves the job */
const HARDCODED_WEBHOOK_URL = '/api/jobs/create';

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
            managed_by_manager_id: managerSelectEl && managerSelectEl.value ? Number(managerSelectEl.value) : null,
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

    // send
    async function sendToWebhook(){
        clearErrors();
        statusEl.textContent = '';
        const payload = buildPayload();
        const validation = validatePayload(payload);
        if(validation.length){ showErrors(validation, true); statusEl.textContent = 'Validation error'; return; }

        if(!HARDCODED_WEBHOOK_URL || HARDCODED_WEBHOOK_URL.includes('YOUR_N8N_WEBHOOK_URL_HERE')){
            showErrors(['HARDCODED_WEBHOOK_URL is not set. Edit the HTML and update the webhook URL.']);
            return;
        }

        showProgress();
        if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Saving...' }

        try {
            const res = await fetch(HARDCODED_WEBHOOK_URL, {
                method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload)
            });

            // attempt to parse JSON safely
            let data = null;
            try { data = await res.clone().json(); } catch(e){ data = null; }

            // If server returned non-2xx, show reason if present
            if(!res.ok){
                const serverMsg = (data && (data.reason || data.error || data.message)) ? (data.reason||data.error||data.message) : (res.statusText || ('Status ' + res.status));
                showErrors([`Webhook returned ${res.status}: ${serverMsg}`]);
                statusEl.textContent = 'Save failed';
                return;
            }

            // At this point res.ok. But we must check the returned JSON "status" property:
            if(!data){
                // 2xx but no JSON - treat as unknown success; can't get JobID
                setProgressDone();
                showSavedView(payload, null);
                return;
            }

            const lowerStatus = (typeof data.status === 'string') ? data.status.toLowerCase() : null;
            if(lowerStatus === 'error'){
                // show the server-provided reason
                const reason = data.reason || data.message || 'Unknown server error';
                showErrors([reason]);
                statusEl.textContent = 'Save failed';
                return;
            }
            if(lowerStatus === 'success'){
                // success — require JobID to enable Edit redirect
                const jobId = data.JobID !== undefined ? data.JobID : (data.jobId !== undefined ? data.jobId : null);
                // show saved view only for explicit success
                setProgressDone();
                showSavedView(payload, jobId);
                return;
            }

            // If we get here: 2xx but status not provided — be conservative: show error
            showErrors([ 'Webhook returned unexpected response. Expected { "status": "success" | "error", ... }' ]);
            statusEl.textContent = 'Save failed';
            return;

        } catch (err) {
            showErrors([`Network error: ${err.message || err}`]);
            statusEl.textContent = 'Save failed';
        } finally {
            if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save Job' }
            setTimeout(()=> hideProgressInstant(), 800);
        }
    }

    // Summary view now shows all job fields
    function showSavedView(payload, jobId){
        const savedDiv = document.createElement('div'); savedDiv.className = 'saved-view';
        const title = document.createElement('h2'); title.textContent = payload.job_title || 'Untitled Job'; title.style.margin='0 0 12px 0';
        const metaGrid = document.createElement('div'); metaGrid.style.display='grid'; metaGrid.style.gridTemplateColumns='repeat(auto-fit,minmax(220px,1fr))'; metaGrid.style.gap='12px'; metaGrid.style.marginBottom='18px';
        const addMeta = (label,val) => {
            const box = document.createElement('div'); box.style.background='rgba(255,255,255,0.03)'; box.style.border='1px solid rgba(0,0,0,0.06)'; box.style.borderRadius='10px'; box.style.padding='10px 12px'; box.style.minHeight='60px';
            const l = document.createElement('div'); l.style.fontSize='11px'; l.style.letterSpacing='.5px'; l.style.textTransform='uppercase'; l.style.color='var(--muted)'; l.textContent = label;
            const v = document.createElement('div'); v.style.marginTop='6px'; v.style.fontWeight='600'; v.style.wordBreak='break-word'; v.textContent = val ?? '—';
            box.appendChild(l); box.appendChild(v); metaGrid.appendChild(box);
        };
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
        const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='Edit Job';
        const scanBtn = document.createElement('button'); scanBtn.className='ghost'; scanBtn.textContent='Scan CV for this job';
        if(jobId !== null && jobId !== undefined){
            editBtn.addEventListener('click', () => {
                const url = EDIT_WORKFLOW_URL + (EDIT_WORKFLOW_URL.includes('?') ? '&' : '?') + 'JobID=' + encodeURIComponent(String(jobId));
                window.location.href = url;
            });
        } else {
            editBtn.disabled = true;
        }
        scanBtn.addEventListener('click', () => {
            scanBtn.disabled = true; scanBtn.textContent = 'Starting scan...';
            fetch(HARDCODED_WEBHOOK_URL, {
                method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ action:'scan_cv', job_title: payload.job_title, JobID: jobId })
            }).then(r => r.json().catch(()=>({}))).then(d => {
                scanBtn.disabled = false; scanBtn.textContent = 'Scan CV for this job';
                if(d && (d.status === 'success' || d.status === 'ok')) alert('Scan started successfully.'); else alert('Scan request sent.');
            }).catch(e => { scanBtn.disabled = false; scanBtn.textContent = 'Scan CV for this job'; alert('Network error: ' + (e.message || e)); });
        });
        actions.appendChild(editBtn); actions.appendChild(scanBtn);

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

    // bindings
    if(addJDBtn) addJDBtn.addEventListener('click', ()=> addNewJD());
    if(saveBtn) saveBtn.addEventListener('click', ()=> sendToWebhook());
    if(clearBtn) clearBtn.addEventListener('click', ()=> {
        if(confirm('Clear the form? This will remove all data.')) {
            // Clear all input fields
            if(jobTitleEl) jobTitleEl.value='';
            if(departmentEl) departmentEl.value='';
            if(locationEl) locationEl.value='';
            if(employmentTypeEl) employmentTypeEl.value='';
            if(salaryMinEl) salaryMinEl.value='';
            if(salaryMaxEl) salaryMaxEl.value='';
            if(applicationDeadlineEl) applicationDeadlineEl.value='';
            if(descriptionSummaryEl) descriptionSummaryEl.value='';
            if(jobStatusEl) jobStatusEl.value='';
            if(managerSelectEl) managerSelectEl.value='';
            if(jdList) jdList.innerHTML='';
            clearErrors();
            if(statusEl) statusEl.textContent='';
            // Add one empty JD
            addNewJD();
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

    fetchOptions();
    document.addEventListener('keydown', (e)=> { if((e.ctrlKey||e.metaKey) && e.key === 'Enter') sendToWebhook(); });

    // Add one empty JD by default (without scrolling)
    addNewJD({}, true);

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

