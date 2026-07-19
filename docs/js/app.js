// ==========================================
//  SUPABASE CONFIGURATION
// ==========================================
// Load from config.js or use empty defaults (to be set via environment)
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

let supabaseClient = null;
let currentUser = null;
let isUserAuthenticated = false;

const THEMES = ['midnight', 'peach', 'mint', 'lavender'];

// Pixel-sky state (declared early — refreshSkyColors runs during first applyTheme)
let clouds = [];
let sparkles = [];
let hearts = [];
let skyColors = { cloud: '#fff7f0', spark: '#ffd98a', heart: '#ff9db0' };

// Pixel cat palette — fur/outline come from theme CSS vars (refreshed per theme).
let CAT_PALETTE = { d: '#cdbb98', o: '#efe4cf', p: '#ff9db0', e: '#332f47', w: '#ffffff', b: '#332f47' };
// Sitting kitten (3/4 view): pink-inner ears, dot eyes, whiskers, white chest+paws, tail curling up the right.
const CAT_ROWS = [
    "      d       d        ",
    "     dd      dd        ",
    "    dod     dod        ",
    "   dpoodddddoopd       ",
    "   dppoooooooppd       ",
    "   doooooooooood       ",
    "   doooooooooood       ",
    "   dooowooowoood       ",
    " dddoooeoeoeoooddd     ",
    "   doooooooooood       ",
    "ddddooooooooooodddd    ",
    "    ddooooooodd    ddd ",
    "      doooood     doood",
    "      dooooood   dooood",
    "      doooooood dooddd ",
    "      doooooooodood    ",
    "      dooooooooood     ",
    "      doodoodooddd     ",
    "       dddddddddd      ",
];

// Apply saved theme immediately to avoid a flash (authed users re-apply after load)
applyTheme(localStorage.getItem('theme') || 'midnight');

// Initialize Supabase if credentials are available (guard: CDN may fail to load)
if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Returning from a reset-password email → let the user set a new password.
    // Password recovery: ask for a new password via the custom dialog.
    supabaseClient.auth.onAuthStateChange(async (event) => {
        if (event !== 'PASSWORD_RECOVERY') return;
        const pw = await showPrompt('Enter your new password (at least 6 characters):', { type: 'password', placeholder: '••••••••' });
        if (!pw || pw.length < 6) { showAlert('Password must be at least 6 characters.'); return; }
        const { error } = await supabaseClient.auth.updateUser({ password: pw });
        showAlert(error ? error.message : 'Password updated — you are now logged in.');
    });
}

// ==========================================
//  CUSTOM DIALOG  (in-page replacement for alert/confirm/prompt)
//  JS-injected so all pages get it from this shared script — no per-page HTML.
// ==========================================
// Front-facing "questioning" cat — eyes look straight at the user. Colors reuse CAT_PALETTE.
const THINK_CAT_ROWS = [
    "                ",
    "   d         d   ",
    "  dwd       dwd ",
    "  dowd     dwod ",
    " dopowdddddwopod",
    " doppowwwwwoppod",
    " doooooooooooood",
    " doooooooooooood ",
    "doobbbooooobbbood ",
    "dobwwbbooobwwbbod",
    "dobwbbbooobwbbbod",
    "dobbbwbooobbbwbod",
    "doobbbooooobbbood",
    "dooooooopoooooood",
    " dooooopopoooood ",
    "  doooooooooood  ",
    "   ddddddddddd   "               
];
function pixelSprite(rows, palette, widthPx) {
    const w = Math.max(...rows.map(r => r.length));  // tolerate ragged rows so hand-edits don't clip
    let rects = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c === ' ') continue;
            rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[c]}"/>`;
        }
    });
    return `<svg viewBox="0 0 ${w} ${rows.length}" width="${widthPx}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">${rects}</svg>`;
}

function showDialog({ title = '', message = '', input = null, okText = 'OK', cancelText = null, cat = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';

        const box = document.createElement('div');
        box.className = 'modal-content modal-small';

        if (title) {
            const h = document.createElement('h2');
            h.textContent = title;
            box.appendChild(h);
        }
        if (message) {
            const p = document.createElement('p');
            p.style.margin = '10px 0 18px';
            p.textContent = message;
            box.appendChild(p);
        }

        if (cat) {
            refreshCatColors();  // pull theme fur/outline into CAT_PALETTE
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;justify-content:center;margin:2px 0 16px;';
            wrap.innerHTML = pixelSprite(THINK_CAT_ROWS, CAT_PALETTE, 120);
            box.appendChild(wrap);
        }

        let field = null;
        if (input) {
            const group = document.createElement('div');
            group.className = 'input-group';           // reuse existing input styling
            field = document.createElement('input');
            field.type = input.type || 'text';
            field.placeholder = input.placeholder || '';
            group.appendChild(field);
            box.appendChild(group);
        }

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '10px';

        const close = (val) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(val); };

        if (cancelText) {
            const cancel = document.createElement('button');
            cancel.className = 'btn';
            cancel.style.flex = '1';
            cancel.textContent = cancelText;
            cancel.onclick = () => close(input ? null : false);
            row.appendChild(cancel);
        }
        const ok = document.createElement('button');
        ok.className = 'btn btn-start';
        ok.style.flex = '1';
        ok.style.width = 'auto';
        ok.textContent = okText;
        ok.onclick = () => close(input ? field.value : true);
        row.appendChild(ok);

        box.appendChild(row);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const onKey = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
            else if (e.key === 'Escape') { close(input ? null : false); }
        };
        document.addEventListener('keydown', onKey);
        (field || ok).focus();
    });
}

// alert → showAlert (await optional); confirm → await showConfirm; prompt → await showPrompt
const showAlert   = (message, title = '') => showDialog({ title, message, okText: 'OK' });
const showConfirm = (message, title = '') => showDialog({ title, message, cat: true, okText: 'Yes', cancelText: 'Cancel' });
const showPrompt  = (message, opts = {})  => showDialog({ message, cat: true, input: { type: opts.type || 'text', placeholder: opts.placeholder || '' }, okText: 'OK', cancelText: 'Cancel' });

// ==========================================
//  AUTHENTICATION FUNCTIONS
// ==========================================
async function handleLoginWithEmailPassword(email, password, messageDiv = null) {
    if (!supabaseClient) {
        if (messageDiv) messageDiv.textContent = 'Supabase not configured. Please contact administrator.';
        else showAlert('Supabase not configured. Please contact administrator.');
        return;
    }

    if (!email || !password) {
        if (messageDiv) messageDiv.textContent = 'Please fill in all fields';
        else showAlert('Please fill in all fields');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        isUserAuthenticated = true;
        await loadUserData();
        showMainApp();
        updateNavButtons();
        closeLoginModal();

    } catch (error) {
        if (messageDiv) messageDiv.textContent = error.message;
        else showAlert(error.message);
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('authMessage');
    await handleLoginWithEmailPassword(email, password, messageDiv);
}

function handleLoginFromModal() {
    const email = document.getElementById('loginEmailModal').value;
    const password = document.getElementById('loginPasswordModal').value;
    handleLoginWithEmailPassword(email, password, null);
}

async function handleSignupWithEmailPassword(email, password, messageDiv = null) {
    if (!supabaseClient) {
        if (messageDiv) messageDiv.textContent = 'Supabase not configured. Please contact administrator.';
        else showAlert('Supabase not configured. Please contact administrator.');
        return;
    }

    if (!email || !password) {
        if (messageDiv) messageDiv.textContent = 'Please fill in all fields';
        else showAlert('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        if (messageDiv) messageDiv.textContent = 'Password must be at least 6 characters';
        else showAlert('Password must be at least 6 characters');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        // Create default preferences
        await supabaseClient
            .from('user_preferences')
            .insert([{
                user_id: data.user.id,
                salary: 0,
                hours_per_day: 8,
                days_per_month: 26,
                theme: 'midnight'
            }]);

        currentUser = data.user;
        isUserAuthenticated = true;
        await loadUserData();
        showMainApp();
        updateNavButtons();
        closeLoginModal();

    } catch (error) {
        if (messageDiv) messageDiv.textContent = error.message;
        else showAlert(error.message);
    }
}

async function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const messageDiv = document.getElementById('authMessage');
    await handleSignupWithEmailPassword(email, password, messageDiv);
}

function handleSignupFromModal() {
    const email = document.getElementById('signupEmailModal').value;
    const password = document.getElementById('signupPasswordModal').value;
    handleSignupWithEmailPassword(email, password, null);
}

async function handleGoogleLogin() {
    if (!supabaseClient) { showAlert('Supabase not configured. Please contact administrator.'); return; }
    // Redirect to Google, then back to this page — getSession() picks up the session on return.
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) showAlert(error.message);
}

async function handleForgotPassword() {
    if (!supabaseClient) { showAlert('Supabase not configured. Please contact administrator.'); return; }
    const email = document.getElementById('loginEmailModal').value;
    if (!email) { showAlert('Type your email above first, then tap "Forgot password".'); return; }

    // Send a 6-digit code (not a reset link). shouldCreateUser:false so an
    // unknown email can't be signed up or enumerated via this flow.
    const { error: sendErr } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
    });
    if (sendErr) { showAlert(sendErr.message); return; }

    const code = await showPrompt('Enter the 6-digit code sent to your email:', { placeholder: '123456' });
    if (!code) return;
    const { error: verifyErr } = await supabaseClient.auth.verifyOtp({
        email, token: code.trim(), type: 'email',
    });
    if (verifyErr) { showAlert(verifyErr.message); return; }

    const pw = await showPrompt('Enter your new password (at least 6 characters):', { type: 'password', placeholder: '••••••••' });
    if (!pw || pw.length < 6) { showAlert('Password must be at least 6 characters.'); return; }
    const { error: updErr } = await supabaseClient.auth.updateUser({ password: pw });
    showAlert(updErr ? updErr.message : 'Password updated — you are now logged in.');
}

async function handleLogout() {
    if (!await showConfirm('Log out of your account?')) return;
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = null;
    isUserAuthenticated = false;
    updateNavButtons();
    location.reload();
}

// Timer screens only exist on index.html — safe no-op elsewhere.
function showMainApp() {
    if (!document.getElementById('inputScreen')) return;
    document.getElementById('historyScreen').style.display = 'none';
    document.getElementById('timerScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('inputScreen').style.display = 'block';
}

async function checkAuthState() {
    if (!supabaseClient) {
        // Supabase not configured, show main app
        const inp = document.getElementById('inputScreen');
        if (inp) inp.style.display = 'block';
        updateNavButtons();
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        currentUser = session.user;
        isUserAuthenticated = true;
        await loadUserData();
        showMainApp();
    } else {
        const inp = document.getElementById('inputScreen');
        if (inp) inp.style.display = 'block';
    }
    updateNavButtons();
}

// ==========================================
//  SUPABASE DATA FUNCTIONS
// ==========================================
async function loadUserData() {
    if (!supabaseClient || !currentUser) return;

    try {
        const { data: prefs } = await supabaseClient
            .from('user_preferences')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (prefs && prefs.salary > 0 && document.getElementById('salary')) {
            document.getElementById('salary').value = prefs.salary || '';
            document.getElementById('hoursPerDay').value = prefs.hours_per_day || '';
            document.getElementById('daysPerMonth').value = prefs.days_per_month || '';
        }

        if (prefs && prefs.theme) {
            applyTheme(prefs.theme);
        }

        // Query all and filter in JS to avoid 406 error
        const { data: allActiveSessions } = await supabaseClient
            .from('active_sessions')
            .select('*');

        const activeSession = allActiveSessions?.find(s => s.user_id === currentUser.id);

        if (activeSession && document.getElementById('timerScreen')) {
            startTime = new Date(activeSession.start_time).getTime();
            ratePerSecond = activeSession.rate_per_second;

            document.getElementById('inputScreen').style.display = 'none';
            document.getElementById('timerScreen').style.display = 'block';

            timerInterval = setInterval(updateTimer, 100);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function saveUserPreferences(salary, hours, days) {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('user_preferences')
            .upsert({
                user_id: currentUser.id,
                salary: salary,
                hours_per_day: hours,
                days_per_month: days,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

async function saveWorkSessionToSupabase(durationSeconds, earnedAmount) {
    if (!supabaseClient || !currentUser) return;

    try {
        const today = new Date();
        const dateString = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

        await supabaseClient
            .from('work_sessions')
            .insert([{
                user_id: currentUser.id,
                start_time: new Date(startTime).toISOString(),
                end_time: new Date().toISOString(),
                duration_seconds: Math.floor(durationSeconds),
                rate_per_second: ratePerSecond,
                amount_earned: earnedAmount,
                session_date: dateString
            }]);
    } catch (error) {
        console.error('Error saving work session:', error);
    }
}

async function saveActiveSessionToSupabase() {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('active_sessions')
            .upsert({
                user_id: currentUser.id,
                start_time: new Date(startTime).toISOString(),
                rate_per_second: ratePerSecond
            }, { onConflict: 'user_id' });
    } catch (error) {
        console.error('Error saving active session:', error);
    }
}

async function clearActiveSessionFromSupabase() {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('active_sessions')
            .delete()
            .eq('user_id', currentUser.id);
    } catch (error) {
        console.error('Error clearing active session:', error);
    }
}

async function loadWorkSessionsFromSupabase() {
    if (!supabaseClient || !currentUser) return [];

    try {
        const { data, error } = await supabaseClient
            .from('work_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(session => ({
            date: session.session_date,
            duration: session.duration_seconds,
            earned: session.amount_earned,
            id: session.id
        }));
    } catch (error) {
        console.error('Error loading sessions:', error);
        return [];
    }
}

async function deleteWorkSessionFromSupabase(sessionId) {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('work_sessions')
            .delete()
            .eq('id', sessionId);
    } catch (error) {
        console.error('Error deleting session:', error);
    }
}

async function clearAllWorkSessionsFromSupabase() {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('work_sessions')
            .delete()
            .eq('user_id', currentUser.id);
    } catch (error) {
        console.error('Error clearing sessions:', error);
    }
}

async function saveThemeToSupabase(theme) {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('user_preferences')
            .update({ theme: theme, updated_at: new Date().toISOString() })
            .eq('user_id', currentUser.id);
    } catch (error) {
        console.error('Error saving theme:', error);
    }
}

// ==========================================
//  ORIGINAL APP VARIABLES
// ==========================================
let timerInterval;
let startTime;
let ratePerSecond;
let totalEarned = 0;

function startWork() {
    const salary = parseFloat(document.getElementById('salary').value);
    const hoursPerDay = parseFloat(document.getElementById('hoursPerDay').value);
    const daysPerMonth = parseFloat(document.getElementById('daysPerMonth').value);

    if (!salary || !hoursPerDay || !daysPerMonth) {
        showAlert('Please fill in ALL fields!');
        return;
    }

    // Save these inputs to the browser's memory (fallback) or Supabase
    if (isUserAuthenticated) {
        saveUserPreferences(salary, hoursPerDay, daysPerMonth);
    } else {
        localStorage.setItem('savedSalary', salary);
        localStorage.setItem('savedHours', hoursPerDay);
        localStorage.setItem('savedDays', daysPerMonth);
    }

    // Calculate rate per second
    const totalWorkSecondsPerMonth = daysPerMonth * hoursPerDay * 3600;
    ratePerSecond = salary / totalWorkSecondsPerMonth;

    // Switch screens
    document.getElementById('inputScreen').style.display = 'none';
    document.getElementById('timerScreen').style.display = 'block';

    // Start timer
    startTime = Date.now();
    totalEarned = 0;

    timerInterval = setInterval(updateTimer, 100);

    // Save the active session so it survives a refresh!
    if (isUserAuthenticated) {
        saveActiveSessionToSupabase();
    } else {
        localStorage.setItem('activeStartTime', startTime);
        localStorage.setItem('activeRate', ratePerSecond);
        localStorage.setItem('activeTotalEarned', totalEarned);
        localStorage.setItem('isWorking', 'true');
    }
}

// Settings & Dark Mode Functions
function openSettings() {
    // Show the modal
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
    // Hide the modal
    document.getElementById('settingsModal').style.display = 'none';
}

// Login Modal Functions
function openLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function showLoginInModal() {
    document.getElementById('loginFormInModal').style.display = 'block';
    document.getElementById('signupFormInModal').style.display = 'none';
}

function showSignupInModal() {
    document.getElementById('loginFormInModal').style.display = 'none';
    document.getElementById('signupFormInModal').style.display = 'block';
}

function updateNavButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (isUserAuthenticated) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

// Apply a theme (no save) — used on load and by setTheme.
function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'midnight';
    document.documentElement.setAttribute('data-theme', theme);

    // Highlight the active dot in settings
    document.querySelectorAll('.theme-dot').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeName === theme);
    });

    // Show the active theme name
    const nameEl = document.getElementById('themeName');
    if (nameEl) nameEl.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);

    // Recolor the sky sprites to match the new theme
    if (typeof refreshSkyColors === 'function') refreshSkyColors();

    // Recolor the cat to match the new theme
    if (typeof renderCat === 'function') renderCat();
}

// Apply + persist (called from the settings picker)
async function setTheme(theme) {
    applyTheme(theme);
    if (isUserAuthenticated) {
        await saveThemeToSupabase(theme);
    } else {
        localStorage.setItem('theme', theme);
    }
}

function updateTimer() {
    const elapsed = (Date.now() - startTime) / 1000;
    totalEarned = elapsed * ratePerSecond;

    // Update money display
    document.getElementById('moneyDisplay').textContent = totalEarned.toFixed(4);

    // Save totalEarned periodically for crash recovery (guest users only)
    if (!isUserAuthenticated && localStorage.getItem('isWorking') === 'true') {
        localStorage.setItem('activeTotalEarned', totalEarned);
    }

    // Update time display
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = Math.floor(elapsed % 60);
    document.getElementById('timeDisplay').textContent =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function stopWork() {
    clearInterval(timerInterval);

    // Clear the active session status
    if (isUserAuthenticated) {
        await clearActiveSessionFromSupabase();
    } else {
        localStorage.removeItem('activeStartTime');
        localStorage.removeItem('activeRate');
        localStorage.removeItem('activeTotalEarned');
        localStorage.removeItem('isWorking');
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = Math.floor(elapsed % 60);

    // Switch to result screen
    document.getElementById('timerScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'block';

    // Update result display
    document.getElementById('resultAmount').textContent = totalEarned.toFixed(2);
    document.getElementById('resultTime').textContent = `${hours}h ${minutes}m ${seconds}s`;
    document.getElementById('resultRate').textContent = ratePerSecond.toFixed(6);
    document.getElementById('resultEarned').textContent = totalEarned.toFixed(2);

    // Save data
    if (isUserAuthenticated) {
        await saveWorkSessionToSupabase(elapsed, totalEarned);
    } else {
        saveWorkSession(elapsed, totalEarned);
    }
}

async function resetTimer() {
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('inputScreen').style.display = 'block';
    totalEarned = 0;

    // Ensure memory is cleared if they reset
    if (isUserAuthenticated) {
        await clearActiveSessionFromSupabase();
    } else {
        localStorage.removeItem('activeStartTime');
        localStorage.removeItem('activeRate');
        localStorage.removeItem('activeTotalEarned');
        localStorage.removeItem('isWorking');
    }
}

function saveWorkSession(durationSeconds, earnedAmount) {
    let history = JSON.parse(localStorage.getItem('workHistory')) || [];

    const today = new Date();
    const dateString = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    history.push({
        date: dateString,
        duration: durationSeconds,
        earned: earnedAmount
    });

    localStorage.setItem('workHistory', JSON.stringify(history));
}

async function viewHistory() {
    document.getElementById('inputScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';
    document.getElementById('historyScreen').style.display = 'block';

    let history = [];

    if (isUserAuthenticated) {
        history = await loadWorkSessionsFromSupabase();
    } else {
        history = JSON.parse(localStorage.getItem('workHistory')) || [];
    }

    let totalSecs = 0;
    let totalMoney = 0;
    let uniqueDays = new Set();
    let historyHtml = '';

    // Reverse to show the newest entries at the top
    history.slice().reverse().forEach((session, reversedIndex) => {
        totalSecs += session.duration;
        totalMoney += session.earned;
        uniqueDays.add(session.date);

        const h = Math.floor(session.duration / 3600);
        const m = Math.floor((session.duration % 3600) / 60);

        // For Supabase, use session.id; for localStorage, use original index
        const deleteParam = isUserAuthenticated ? `'${session.id}'` : history.length - 1 - reversedIndex;

        historyHtml += `
            <div class="history-item">
                <span style="flex: 1.5; white-space: nowrap;">${pix('calendar')} ${session.date}</span>
                <span style="flex: 1; text-align: center; white-space: nowrap;">${pix('clock')} ${h}h ${m}m</span>
                <span style="flex: 1.1; text-align: right; white-space: nowrap; color:var(--accent); font-weight:bold;">RM ${session.earned.toFixed(4)}</span>
                <button class="delete-btn" onclick="deleteRecord(${deleteParam})" title="Delete this shift">${pix('cross')}</button>
            </div>
        `;
    });

    // Update the top stats boxes
    document.getElementById('totalDays').textContent = uniqueDays.size;

    const totalH = Math.floor(totalSecs / 3600);
    const totalM = Math.floor((totalSecs % 3600) / 60);
    document.getElementById('totalHours').textContent = `${totalH}h ${totalM}m`;

    document.getElementById('totalMoney').textContent = totalMoney.toFixed(4);

    // Populate the list
    const listContainer = document.getElementById('historyList');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if(historyHtml === '') {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #666;">No history yet</p>';
        clearAllBtn.style.display = 'none';
    } else {
        listContainer.innerHTML = historyHtml;
        clearAllBtn.style.display = 'block';
    }
}

function goHomeFromHistory() {
    document.getElementById('historyScreen').style.display = 'none';
    document.getElementById('inputScreen').style.display = 'block';
}

async function clearHistory() {
    if (await showConfirm("Are you sure you want to clear ALL history?")) {
        if (isUserAuthenticated) {
            await clearAllWorkSessionsFromSupabase();
        } else {
            localStorage.removeItem('workHistory');
        }
        viewHistory();
    }
}

// Function to delete a single specific record
async function deleteRecord(identifier) {
    if (await showConfirm("Are you sure you want to delete this specific shift?")) {
        if (isUserAuthenticated) {
            await deleteWorkSessionFromSupabase(identifier);
        } else {
            let history = JSON.parse(localStorage.getItem('workHistory')) || [];
            history.splice(identifier, 1);
            localStorage.setItem('workHistory', JSON.stringify(history));
        }
        viewHistory();
    }
}

// ==========================================
//  WARM PIXEL SKY  (drifting clouds + sparkles + rising hearts)
//  Colors come from CSS vars --cloud/--spark/--heart, so each
//  theme paints its own cozy sky.
// ==========================================
const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.zIndex = '-1';
canvas.style.pointerEvents = 'none';
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;               // crisp pixels
const PX = 4;                                     // pixel-grid size

// Read the current theme's sky palette from CSS variables.
function refreshSkyColors() {
    const s = getComputedStyle(document.documentElement);
    skyColors = {
        cloud: (s.getPropertyValue('--cloud') || '#fff').trim(),
        spark: (s.getPropertyValue('--spark') || '#ffd98a').trim(),
        heart: (s.getPropertyValue('--heart') || '#ff9db0').trim()
    };
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// snap a value to the pixel grid so everything looks blocky
function snap(v) { return Math.round(v / PX) * PX; }

// Blocky cloud sprite (rows of block-widths), drifts sideways
class Cloud {
    constructor(spawnLeft) {
        this.scale = Math.random() * 1.4 + 1.0;
        this.speed = (Math.random() * 0.25 + 0.12) * this.scale;
        this.y = Math.random() * canvas.height * 0.75;
        this.alpha = Math.random() * 0.25 + 0.35;
        // cloud shape: block widths per row (a fluffy lump)
        this.rows = [[2, 4], [1, 6], [0, 8], [1, 6]];
        this.w = 8 * PX * this.scale;
        this.x = spawnLeft ? -this.w : Math.random() * canvas.width;
    }
    update() {
        this.x += this.speed;
        if (this.x > canvas.width + this.w) { this.x = -this.w; this.y = Math.random() * canvas.height * 0.75; }
    }
    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = skyColors.cloud;
        const b = PX * this.scale;
        this.rows.forEach((row, r) => {
            const [off, len] = row;
            ctx.fillRect(snap(this.x + off * b), snap(this.y + r * b), len * b, b);
        });
    }
}

// Twinkling pixel sparkle (a little plus/diamond of blocks)
class Sparkle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.t = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.05 + 0.02;
        this.big = Math.random() < 0.4;
    }
    update() {
        this.t += this.speed;
        if (this.t > Math.PI * 2) { this.t = 0; this.reset(); }
    }
    draw() {
        const a = Math.sin(this.t);
        if (a <= 0) return;
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = skyColors.spark;
        const s = this.big ? PX : PX * 0.75;
        const x = snap(this.x), y = snap(this.y);
        // plus shape
        ctx.fillRect(x, y, s, s);
        ctx.fillRect(x - s, y, s, s);
        ctx.fillRect(x + s, y, s, s);
        ctx.fillRect(x, y - s, s, s);
        ctx.fillRect(x, y + s, s, s);
    }
}

// Rising pixel heart
class Heart {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 10;
        this.speed = Math.random() * 0.6 + 0.4;
        this.sway = Math.random() * Math.PI * 2;
        this.life = 1;
        this.scale = Math.random() * 0.6 + 0.7;
    }
    update() {
        this.y -= this.speed;
        this.sway += 0.05;
        this.x += Math.sin(this.sway) * 0.6;
        if (this.y < canvas.height * 0.15) this.life -= 0.01;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life) * 0.85;
        ctx.fillStyle = skyColors.heart;
        const b = PX * this.scale;
        const x = snap(this.x), y = snap(this.y);
        // 5x5-ish pixel heart
        const rows = ['01010', '11111', '11111', '01110', '00100'];
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                if (row[c] === '1') ctx.fillRect(snap(x + c * b), snap(y + r * b), b, b);
            }
        });
    }
}

function initSky() {
    refreshSkyColors();
    clouds = [];
    sparkles = [];
    const cloudCount = Math.min(10, Math.floor(canvas.width / 220));
    for (let i = 0; i < cloudCount; i++) clouds.push(new Cloud(false));
    const sparkCount = Math.min(70, Math.floor((canvas.width * canvas.height) / 22000));
    for (let i = 0; i < sparkCount; i++) sparkles.push(new Sparkle());
}

// ponytail: fixed per-frame heart odds; good enough, no scheduler needed
function animateSky() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const c of clouds) { c.update(); c.draw(); }
    for (const s of sparkles) { s.update(); s.draw(); }

    if (Math.random() < 0.015 && hearts.length < 6) hearts.push(new Heart());
    for (let i = hearts.length - 1; i >= 0; i--) {
        hearts[i].update();
        hearts[i].draw();
        if (hearts[i].life <= 0 || hearts[i].y < -20) hearts.splice(i, 1);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(animateSky);
}

window.addEventListener('resize', initSky);
initSky();
animateSky();

// ==========================================
//  PIXEL CAT SPRITE  (inline SVG, no external image)
// ==========================================
// Pull the cat's fur + outline from the active theme's CSS vars.
function refreshCatColors() {
    const s = getComputedStyle(document.documentElement);
    const fur = (s.getPropertyValue('--cat-fur') || '').trim();
    const dark = (s.getPropertyValue('--cat-dark') || '').trim();
    if (fur) CAT_PALETTE.o = fur;
    if (dark) CAT_PALETTE.d = dark;
}

function renderCat() {
    const el = document.getElementById('catSprite');
    if (!el) return;
    refreshCatColors();
    let rects = '';
    CAT_ROWS.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c === ' ') continue;
            rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${CAT_PALETTE[c]}"/>`;
        }
    });
    el.innerHTML = `<svg viewBox="0 0 ${CAT_ROWS[0].length} ${CAT_ROWS.length}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
renderCat();

// ==========================================
//  PIXEL NAV ICONS  (currentColor, theme-tinted)
// ==========================================
// Color palette for pixel glyphs. 'c' = currentColor (theme accent), '.'/' ' = transparent.
const PALETTE = {
    y: '#ffcf4d', o: '#ff8a3d', r: '#ff5a6e', g: '#5fd08a', b: '#5db0ff',
    p: '#ff9db0', w: '#fff3e6', k: '#4a3b52', n: '#ffb066',
};
const ICONS = {
    settings: ["........","..c.....","cccccccc","..c.....","........","....c...","cccccccc","....c..."],
    login:    ["..yyyy..","..y..y..","..y..y..","..yyyy..","...y....","...y....","...yy...","...y...."],
    logout:   ["c.......","c...c...","c....c..","c.ccccc.","c....c..","c...c...","c.......","c......."],
    coin:     ["..yyyy..",".ywwyyy.","yyyyyyyy","yyy..yyy","yyy..yyy","yyyyyyyy",".yyyyyy.","..yyyy.."],
    moneybag: ["...kk...","..yyyy..",".yyyyyy.","yyygggyy","yyyggyyy","yyyyggyy","yyygggyy",".yyyyyy."],
    clock:    ["..kkkk..",".kwwwwk.","kwwkwwwk","kwwkwwwk","kwwkkwwk","kwwwwwwk",".kwwwwk.","..kkkk.."],
    calendar: [".k....k.","rrrrrrrr","rrrrrrrr","wwwwwwww","wkkwkkww","wwwwwwww","wkkwkkww","wwwwwwww"],
    star:     ["...y....","..yyy...",".yyyyy..","yyyyyyyy",".yyyyy..","..yyy...","...y....","........"],
    fire:     ["...r....","...o....","..oo....","..ooo...",".ooyyo..",".oyyyo..","..ooo...","........"],
    cat:      ["n......n","np....pn","nnnnnnnn","nknnnnkn","nnnnnnnn","nnnppnnn","nnnnnnnn",".n....n."],
    chart:    ["........","......y.","....g.y.","....g.y.","..b.g.y.","..b.g.y.","p.b.g.y.","kkkkkkkk"],
    book:     [".rrrrrr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.",".rrrrrr."],
    check:    [".......g","......gg",".....gg.","g...gg..","gg.gg...",".ggg....","..g.....","........"],
    cone:     ["...oo...","...yy...","..oooo..","..yyyy..",".oooooo.",".yyyyyy.","oooooooo","yyyyyyyy"],
    mail:     ["kkkkkkkk","kwwwwwwk","kkwwwwkk","kwkkkkwk","kwwwwwwk","kwwwwwwk","kkkkkkkk","........"],
    lock:     ["..kkk...",".k...k..",".k...k..","yyyyyyy.","yyykyyy.","yyykyyy.","yyyyyyy.","........"],
    list:     ["wwwwwwww","wkkkkkkw","wwwwwwww","wkkkkkww","wwwwwwww","wkkkkkkw","wwwwwwww","wkkkkkww"],
    rocket:   ["...r....","..rrr...","..rbr...","..www...","..www...",".rwwwr..",".r.w.r..","..o.o..."],
    cross:    ["r......r","rr....rr",".rr..rr.","..rrrr..","..rrrr..",".rr..rr.","rr....rr","r......r"],
    paw:      ["pp.pp.pp","pp.pp.pp","........",".pppppp.","pppppppp","pppppppp",".pppppp.","..pppp.."],
    google:   ["..bbbb..",".b....r.",".b......",".b..yyy.",".b....y.",".g....y.","..gggg..","........"],
};
function iconSvg(name) {
    const rows = ICONS[name];
    if (!rows) return '';
    let rects = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.' || ch === ' ') continue;
            const fill = ch === 'c' ? 'currentColor' : (PALETTE[ch] || 'currentColor');
            rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
        }
    });
    return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
// inline sprite for use inside generated HTML strings
function pix(name) { return `<span class="pix">${iconSvg(name)}</span>`; }
function renderIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
        const s = iconSvg(el.dataset.icon);
        if (s) el.innerHTML = s;
    });
}

// ==========================================
//  BONUS SCENE — click the logo: it pops + coins shower down
// ==========================================
function coinShower() {
    const layer = document.createElement('div');
    layer.className = 'coin-shower';
    const coin = iconSvg('coin');
    for (let i = 0; i < 46; i++) {
        const c = document.createElement('div');
        c.className = 'coin-drop';
        c.innerHTML = coin;
        c.style.left = (Math.random() * 100) + 'vw';
        c.style.width = (Math.random() * 18 + 18) + 'px';
        c.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's';
        c.style.animationDuration = (Math.random() * 1.4 + 1.6).toFixed(2) + 's';
        layer.appendChild(c);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 3600);
}

let bonusActive = false;
function triggerBonus(e) {
    if (e) e.stopPropagation();          // don't also fire the "go home" click
    if (bonusActive) return;             // ignore clicks while a bonus is running
    bonusActive = true;

    // Big logo pops out to the centre of the screen for ~3s
    const big = document.createElement('img');
    big.src = 'assets/favicon.png';
    big.className = 'logo-bonus';
    big.alt = '';
    document.body.appendChild(big);

    coinShower();

    setTimeout(() => { big.remove(); bonusActive = false; }, 3000);
}

// ==========================================
//  SHARED CHROME  (nav buttons + modals injected on pages that lack them,
//  so sub-pages reuse the same login/settings without duplicating markup)
// ==========================================
const CHROME_MODALS = `
<div id="settingsModal" class="modal-overlay">
    <div class="modal-content settings-panel">
        <span class="close-btn" onclick="closeSettings()">&times;</span>
        <div class="settings-header"><h2><span class="pix" data-icon="settings"></span> Settings</h2><p class="settings-sub">Make the grind yours</p></div>
        <section class="settings-section">
            <div class="section-head">Appearance</div>
            <div class="setting-row">
                <div class="setting-text"><span class="setting-label">Theme</span><span class="setting-hint" id="themeName">Midnight</span></div>
                <div class="theme-dots" id="themeDots">
                    <button class="theme-dot dot-midnight" data-theme-name="midnight" onclick="setTheme('midnight')" title="Midnight" aria-label="Midnight theme"></button>
                    <button class="theme-dot dot-peach" data-theme-name="peach" onclick="setTheme('peach')" title="Peach" aria-label="Peach theme"></button>
                    <button class="theme-dot dot-mint" data-theme-name="mint" onclick="setTheme('mint')" title="Mint" aria-label="Mint theme"></button>
                    <button class="theme-dot dot-lavender" data-theme-name="lavender" onclick="setTheme('lavender')" title="Lavender" aria-label="Lavender theme"></button>
                </div>
            </div>
        </section>
        <p class="settings-foot">Meow-ney Maker · v1</p>
    </div>
</div>
<div id="loginModal" class="modal-overlay">
    <div class="modal-content modal-small">
        <span class="close-btn" onclick="closeLoginModal()">&times;</span>
        <div id="loginFormInModal">
            <h2><span class="pix" data-icon="login"></span> Login</h2>
            <button class="btn btn-google" onclick="handleGoogleLogin()"><span class="pix" data-icon="google"></span> Sign in with Google</button>
            <p class="or-divider">— or —</p>
            <div class="input-group"><label><span class="pix" data-icon="mail"></span> Email</label><input type="email" id="loginEmailModal" placeholder="your@email.com"></div>
            <div class="input-group"><label><span class="pix" data-icon="lock"></span> Password</label><input type="password" id="loginPasswordModal" placeholder="••••••••"></div>
            <button class="btn btn-start" onclick="handleLoginFromModal()">Login</button>
            <p style="margin-top:12px;"><a href="#" class="link-accent" onclick="handleForgotPassword()">Forgot password?</a></p>
            <p style="margin-top:8px;">Don't have an account? <a href="#" class="link-accent" onclick="showSignupInModal()">Sign Up</a></p>
        </div>
        <div id="signupFormInModal" style="display:none;">
            <h2><span class="pix" data-icon="star"></span> Sign Up</h2>
            <div class="input-group"><label><span class="pix" data-icon="mail"></span> Email</label><input type="email" id="signupEmailModal" placeholder="your@email.com"></div>
            <div class="input-group"><label><span class="pix" data-icon="lock"></span> Password</label><input type="password" id="signupPasswordModal" placeholder="••••••••"></div>
            <button class="btn btn-start" onclick="handleSignupFromModal()">Sign Up</button>
            <p style="margin-top:15px;">Already have an account? <a href="#" class="link-accent" onclick="showLoginInModal()">Login</a></p>
        </div>
    </div>
</div>`;

function ensureChrome() {
    const right = document.querySelector('.nav-right');
    if (right && right.children.length === 0) {
        right.innerHTML =
            '<button id="loginBtn" class="nav-btn-icon" data-icon="login" onclick="openLoginModal()" style="display:none" title="Login" aria-label="Login"></button>' +
            '<button id="logoutBtn" class="nav-btn-icon" data-icon="logout" onclick="handleLogout()" style="display:none" title="Logout" aria-label="Logout"></button>' +
            '<button class="nav-btn-icon" data-icon="settings" onclick="openSettings()" title="Settings" aria-label="Settings"></button>';
    }
    if (!document.getElementById('settingsModal')) {
        document.body.insertAdjacentHTML('beforeend', CHROME_MODALS);
    }
}

ensureChrome();
renderIcons();

// ==========================================
//  PIXEL TOOLTIP  (one floating element; replaces native title= on hover)
//  Delegation + lazy title→data-tip swap covers static, injected, and dynamic elements.
// ==========================================
(function () {
    const tip = document.createElement('div');
    tip.className = 'pixel-tip';
    document.body.appendChild(tip);

    function place(el) {
        const r = el.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        let left = r.left + r.width / 2 - t.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));  // clamp to viewport
        let top = r.top - t.height - 8;
        if (top < 8) top = r.bottom + 8;                                      // flip below if no room above
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    document.addEventListener('mouseover', (e) => {
        const el = e.target.closest('[data-tip], [title]');
        if (!el) return;
        if (el.hasAttribute('title')) {          // move native title so the browser stops showing its own tooltip
            el.setAttribute('data-tip', el.getAttribute('title'));
            el.removeAttribute('title');
        }
        tip.textContent = el.getAttribute('data-tip');
        tip.classList.add('show');
        place(el);
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('[data-tip]')) tip.classList.remove('show');
    });
    document.addEventListener('click', () => tip.classList.remove('show'));   // dismiss after a button press
})();

// ==========================================
//  TIMER TITLE — cycle playful phrases while the clock runs
// ==========================================
const GRIND_PHRASES = [
    "Grinding... 🧱", "Making bank 🤑", "Cha-ching! 💸", "Stacking coins 🪙",
    "Get that bag 💰", "Meow-ney rising 📈", "Hustle mode 🔥", "Counting pennies 🐾",
    "Still slaving 😹", "To the moon 🚀",
];
let phraseIdx = 0;
setInterval(() => {
    const el = document.getElementById('timerTitle');
    const screen = document.getElementById('timerScreen');
    if (!el || !screen || screen.style.display !== 'block') return;
    phraseIdx = (phraseIdx + 1) % GRIND_PHRASES.length;
    el.textContent = GRIND_PHRASES[phraseIdx];
}, 2500);

// ==========================================
//  AUTO-LOAD SAVED INPUTS
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    // Check authentication state first
    await checkAuthState();

    // Only load localStorage data if not authenticated
    if (!isUserAuthenticated) {
        // Load saved theme
        applyTheme(localStorage.getItem('theme') || 'midnight');

        // Load saved inputs (timer page only)
        const salaryEl = document.getElementById('salary');
        if (salaryEl) {
            if (localStorage.getItem('savedSalary')) salaryEl.value = localStorage.getItem('savedSalary');
            if (localStorage.getItem('savedHours')) document.getElementById('hoursPerDay').value = localStorage.getItem('savedHours');
            if (localStorage.getItem('savedDays')) document.getElementById('daysPerMonth').value = localStorage.getItem('savedDays');
        }

        // Auto-resume if the browser refreshed while working!
        if (document.getElementById('timerScreen') && localStorage.getItem('isWorking') === 'true') {
            startTime = parseInt(localStorage.getItem('activeStartTime'));
            ratePerSecond = parseFloat(localStorage.getItem('activeRate'));
            totalEarned = parseFloat(localStorage.getItem('activeTotalEarned')) || 0;

            document.getElementById('inputScreen').style.display = 'none';
            document.getElementById('timerScreen').style.display = 'block';

            timerInterval = setInterval(updateTimer, 100);
        }
    }
});
