// Shared helpers
const qs = (sel) => document.querySelector(sel);

// Toggle password visibility
const setupPeek = (btnId, inputId) => {
  const btn = qs(btnId), input = qs(inputId);
  if (btn && input) btn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });
};

// Remember-me (stores email only)
const rememberEmailKey = 'kb_email';
const emailInput = qs('#loginEmail');
const remember = qs('#rememberMe');

if (emailInput && remember) {
  const saved = localStorage.getItem(rememberEmailKey) || '';
  emailInput.value = saved;
  remember.checked = !!saved;

  const sync = () => {
    if (remember.checked) localStorage.setItem(rememberEmailKey, emailInput.value.trim());
    else localStorage.removeItem(rememberEmailKey);
  };
  remember.addEventListener('change', sync);
  emailInput.addEventListener('input', sync);
}

// Forgot password placeholder
const forgot = qs('#forgotLink');
if (forgot) forgot.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Forgot Password feature coming soon.');
});

// LOGIN
const loginForm = qs('#loginForm');
if (loginForm) {
  setupPeek('#togglePwdLogin', '#loginPassword');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#loginEmail').value.trim();
    const password = qs('#loginPassword').value;
    const msg = qs('#loginMsg');
    msg.textContent = 'Checking…';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      msg.textContent = data.message || 'Login successful';
      // TODO: redirect to /dashboard.html after we add it
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

// SIGNUP
const signupForm = qs('#signupForm');
if (signupForm) {
  setupPeek('#togglePwdSignup', '#signupPassword');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#signupEmail').value.trim();
    const password = qs('#signupPassword').value;
    const msg = qs('#signupMsg');
    msg.textContent = 'Creating account…';

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      msg.textContent = data.message || 'User registered successfully';
      // Optionally auto-redirect to login:
      // setTimeout(() => location.href = '/login.html', 800);
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}
