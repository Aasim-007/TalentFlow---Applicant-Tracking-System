(function(){
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  function setTab(which){
    if (which === 'login'){
      loginForm.style.display = '';
      signupForm.style.display = 'none';
      tabLogin.classList.add('active'); tabSignup.classList.remove('active');
    } else {
      loginForm.style.display = 'none';
      signupForm.style.display = '';
      tabSignup.classList.add('active'); tabLogin.classList.remove('active');
    }
  }
  tabLogin.addEventListener('click', ()=> setTab('login'));
  tabSignup.addEventListener('click', ()=> setTab('signup'));

  // Login
  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const err = document.getElementById('loginError'); err.style.display='none'; err.textContent='';
    try{
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') throw new Error(data.message || ('HTTP '+res.status));
      localStorage.setItem('tf_user', JSON.stringify({ id: data.userId, role: data.role }));
      window.location.href = data.redirect || '/';
    } catch(e){ err.textContent = 'Login failed: ' + e.message; err.style.display='block'; }
  });

  // Signup
  signupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const password = document.getElementById('suPassword').value;
    const role = document.getElementById('suRole').value;
    const payload = { name, email, password, role };

    const err = document.getElementById('signupError'); err.style.display='none'; err.textContent='';
    try{
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.status !== 201 || data.status !== 'ok') throw new Error(data.message || ('HTTP '+res.status));
      localStorage.setItem('tf_user', JSON.stringify({ id: data.userId, role: data.role }));
      window.location.href = data.redirect || '/';
    } catch(e){ err.textContent = 'Sign up failed: ' + e.message; err.style.display='block'; }
  });
})();
