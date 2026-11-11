


const app = document.querySelector('#app');

let token = localStorage.getItem('mm_token') || '';
let user = null;
let recoverySession = null;
let lang = localStorage.getItem('mm_lang') || 'en';
let page = 'dashboard';
let allProfiles = [];

const supabaseAuth = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY,
    {
        auth: {
            flowType: 'pkce',
            autoRefreshToken: false,
            persistSession: true,
            detectSessionInUrl: false
        }
    }
);

const words = {
    en: {
        dashboard: 'Dashboard', profiles: 'Profiles',
        add: 'Add profile', matching: 'Find matches',
        members: 'Members', logout: 'Log out',
        login: 'Sign in', email: 'Email',
        password: 'Password', total: 'Total profiles',
        male: 'Male', female: 'Female',
        pending: 'Pending verification',
        name: 'Full name', gender: 'Gender',
        age: 'Age', height: 'Height',
        location: 'Location',
        gothram: 'Gothram', star: 'Star',
        job: 'Job', salary: 'Salary (LPA)',
        phone: 'Phone', source: 'WhatsApp group/source',
        sender: 'Sender', date: 'Source date',
        save: 'Save profile', choose: 'Choose profile',
        criteria: 'Choose exactly three criteria',
        run: 'Find matches', upload: 'OCR image intake',
        verify: 'OCR text (review before saving)',
        english: 'English', telugu: 'తెలుగు'
    },
    te: {
        dashboard: 'డ్యాష్‌బోర్డ్', profiles: 'ప్రొఫైల్స్',
        add: 'ప్రొఫైల్ జోడించండి', matching: 'మ్యాచెస్',
        members: 'సభ్యులు', logout: 'లాగ్ అవుట్',
        login: 'లాగిన్', email: 'ఈమెయిల్',
        password: 'పాస్‌వర్డ్', total: 'మొత్తం ప్రొఫైల్స్',
        male: 'పురుషులు', female: 'మహిళలు',
        pending: 'పెండింగ్ వెరిఫికేషన్',
        name: 'పేరు', gender: 'లింగం',
        age: 'వయస్సు', height: 'ఎత్తు',
        location: 'ప్రాంతం',
        gothram: 'గోత్రం', star: 'నక్షత్రం',
        job: 'ఉద్యోగం', salary: 'జీతం (LPA)',
        phone: 'ఫోన్', source: 'వాట్సాప్ గ్రూప్/సోర్స్',
        sender: 'పంపినవారు', date: 'సోర్స్ తేదీ',
        save: 'సేవ్', choose: 'ప్రొఫైల్ ఎంచుకోండి',
        criteria: 'మూడు ప్రమాణాలు ఎంచుకోండి',
        run: 'మ్యాచెస్ వెతకండి',
        upload: 'OCR ఫోటో ఇన్‌టేక్',
        verify: 'OCR టెక్స్ట్ (సరిచూసి సేవ్ చేయండి)',
        english: 'English', telugu: 'తెలుగు'
    }
};

const t = k => words[lang][k] || k;

function escapeHTML(value) {
    return String(value ?? '-').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
    })[ch]);
}

async function api(path, opts = {}) {
    const r = await fetch(window.APP_CONFIG.API_BASE + path, {
        ...opts,
        headers: {
            ...(opts.headers || {}),
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(opts.body instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' })
        }
    });

    let d;
    try {
        d = await r.json();
    } catch {
        d = {};
    }

    if (!r.ok) {
        throw Error(
            d.detail?.message || d.detail || d.error || 'Request failed'
        );
    }
    return d;
}

function notice(s) {
    alert(s);
}


function brandBanner() {
    return `
        <div class="wedding-banner">
            <img
                src="assets/banner.png"
                alt="Subba Rao Matching Services wedding banner"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            <div style="
                display:none;
                min-height:210px;
                flex-direction:column;
                justify-content:center;
                align-items:center;
                text-align:center;
                padding:20px;
                color:#fffaf0;
                background:linear-gradient(110deg,#57201f,#762d2a);
            ">
                <div style="font-size:38px">🕉️ 🪔</div>
                <h1 style="margin:8px 0;color:#fffaf0">
                    Subba Rao Matching Services
                </h1>
                <p style="margin:0;color:#f0d9a8">
                    Tradition • Trust • Togetherness
                </p>
            </div>
        </div>
    `;
}



// --------------------------------------------------
// LOGIN
// --------------------------------------------------



function login() {
    document.title = 'Subba Rao Matching Services';

    app.innerHTML = `
        ${brandBanner()}

        <form class="login" onsubmit="signin(event)">
            <h1>🪔 Subba Rao Matching Services</h1>
            <p class="muted">Tradition • Trust • Togetherness</p>
            <p class="muted">Private family matchmaking workspace</p>

            <div class="field">
                <label>${t('email')}</label>
                <input id="login-email" name="email" type="email" required>
            </div>

            <div class="field">
                <label>${t('password')}</label>
                <input name="password" type="password" required>
            </div>

            <button type="submit">${t('login')}</button>

            <p style="text-align:center;margin:14px 0">
                <a href="#" onclick="forgotPassword(event)">
                    Forgot Password?
                </a>
            </p>

            <button type="button" class="secondary" onclick="toggleLang()">
                ${lang === 'en' ? 'తెలుగు' : 'English'}
            </button>
        </form>
    `;
}


async function signin(e) {
    e.preventDefault();
    try {
        const d = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        token = d.access_token;
        localStorage.setItem('mm_token', token);
        await boot();
    } catch (x) {
        notice(x.message);
    }
}



async function forgotPassword(e) {
    if (e) e.preventDefault();

    const email = document.querySelector('#login-email')?.value.trim();

    if (!email) {
        return notice('Please enter your email address first.');
    }

    try {
        const { error } = await supabaseAuth.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: window.location.origin + window.location.pathname
            }
        );

        if (error) {
            throw error;
        }

        notice(
            'If an account exists for this email, a password recovery link has been sent. Please check your inbox.'
        );

    } catch (error) {
        notice(error.message || 'Unable to send recovery email. Please try again.');
    }
}



function showPasswordReset() {
    app.innerHTML = `
        ${brandBanner()}

        <form class="login" onsubmit="updatePassword(event)">
            <h1>Reset Password</h1>
            <p class="muted">
                Enter your new password below.
            </p>

            <div class="field">
                <label>New Password</label>
                <input
                    name="password"
                    type="password"
                    minlength="12"
                    autocomplete="new-password"
                    required
                >
            </div>

            <div class="field">
                <label>Confirm New Password</label>
                <input
                    name="confirm_password"
                    type="password"
                    minlength="12"
                    autocomplete="new-password"
                    required
                >
            </div>

            <button type="submit">Update Password</button>
        </form>
    `;
}


async function updatePassword(e) {
    e.preventDefault();

    if (!recoverySession) {
        return notice(
            'Recovery session is missing or expired. Please request a new recovery email.'
        );
    }

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    if (data.password !== data.confirm_password) {
        return notice('Passwords do not match.');
    }

    if (data.password.length < 12) {
        return notice('Password must contain at least 12 characters.');
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Updating...';

    try {
        await api('/api/auth/update-password', {
            method: 'POST',
            body: JSON.stringify({
                access_token: recoverySession.access_token,
                refresh_token: recoverySession.refresh_token,
                password: data.password
            })
        });

        recoverySession = null;
        token = '';
        localStorage.removeItem('mm_token');

        notice('Password updated successfully. Please sign in with your new password.');

        login();

    } catch (error) {
        notice(error.message);
        button.disabled = false;
        button.textContent = 'Update Password';
    }
}



async function checkPasswordRecovery() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    // New Supabase PKCE recovery flow
    if (code) {
        try {
            const { data, error } =
                await supabaseAuth.auth.exchangeCodeForSession(code);

            if (error) {
                throw error;
            }

            if (!data.session) {
                throw new Error('Recovery session could not be created.');
            }

            recoverySession = {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            };

            // Remove the recovery code from the browser address bar.
            url.searchParams.delete('code');
            history.replaceState(
                null,
                document.title,
                url.pathname + url.search
            );

            showPasswordReset();
            return true;

        } catch (error) {
            url.searchParams.delete('code');
            history.replaceState(
                null,
                document.title,
                url.pathname + url.search
            );

            notice(
                'Recovery link is invalid or expired. Please request a new recovery email.'
            );
            return true;
        }
    }

    // Handle recovery errors returned by Supabase.
    if (
        url.searchParams.has('error') ||
        url.searchParams.has('error_code')
    ) {
        const errorDescription =
            url.searchParams.get('error_description') ||
            url.searchParams.get('error_code') ||
            'Recovery link is invalid or expired.';

        url.searchParams.delete('error');
        url.searchParams.delete('error_code');
        url.searchParams.delete('error_description');

        history.replaceState(
            null,
            document.title,
            url.pathname + url.search
        );

        notice(errorDescription);
        return true;
    }

    // Backward compatibility with older hash-based recovery links.
    const hash = window.location.hash;

    if (hash) {
        const params = new URLSearchParams(hash.substring(1));

        if (params.get('type') === 'recovery') {
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (!accessToken || !refreshToken) {
                notice('Recovery link is incomplete. Please request a new link.');
                return true;
            }

            recoverySession = {
                access_token: accessToken,
                refresh_token: refreshToken
            };

            history.replaceState(
                null,
                document.title,
                url.pathname + url.search
            );

            showPasswordReset();
            return true;
        }

        if (params.has('error')) {
            notice(
                params.get('error_description') ||
                params.get('error_code') ||
                'Recovery link is invalid or expired.'
            );

            history.replaceState(
                null,
                document.title,
                url.pathname + url.search
            );

            return true;
        }
    }

    return false;
}


async function boot() {
    try {
        user = await api('/api/me');
        render();
    } catch {
        token = '';
        localStorage.removeItem('mm_token');
        login();
    }
}

function toggleLang() {
    lang = lang === 'en' ? 'te' : 'en';
    localStorage.setItem('mm_lang', lang);

    if (user) {
        render();
    } else {
        login();
    }
}




function render() {
    document.title = 'Subba Rao Matching Services';
    
    console.log("BANNER FUNCTION:", typeof brandBanner);
    console.log("BANNER HTML:", brandBanner());
    app.innerHTML = `
        ${brandBanner()}

        <div class="layout">
            <aside class="side">
                <h2>🪔 Subba Rao Matching Services</h2>
                <p class="muted">Tradition • Trust • Togetherness</p>

                ${[
                    ['dashboard', '▦'],
                    ['profiles', '▤'],
                    ['add', '＋'],
                    ['matching', '♡'],
                    ['upload', '▧'],
                    ...(user.role === 'admin' ? [['members', '♙']] : [])
                ].map(([p, i]) => `
                    <button class="${page === p ? 'active' : ''}"
                        onclick="go('${p}')">
                        ${i} ${t(p)}
                    </button>
                `).join('')}
            </aside>

            <section class="main">
                <header class="top">
                    <b>${t(page)}</b>

                    <span>
                        ${escapeHTML(user.full_name)} ·

                        <button class="secondary" onclick="toggleLang()">
                            ${lang === 'en' ? 'తెలుగు' : 'English'}
                        </button>

                        <button class="secondary" onclick="signout()">
                            ${t('logout')}
                        </button>
                    </span>
                </header>

                <div class="content" id="view"></div>
            </section>
        </div>
    `;

    load();
}


function go(p) {
    page = p;
    render();
}

async function signout() {
    try {
        await api('/api/auth/logout', { method: 'POST' });
    } catch {}
    token = '';
    user = null;
    localStorage.removeItem('mm_token');
    login();
}


// --------------------------------------------------
// PAGE LOAD
// --------------------------------------------------

async function load() {
    const v = document.querySelector('#view');

    try {
        
        if (page === 'dashboard') {
            const d = await api('/api/dashboard');

            v.innerHTML = `
                <div class="wedding-welcome">
                    <div style="
                        display:flex;
                        align-items:center;
                        gap:16px;
                        flex-wrap:wrap;
                    ">
                        <div style="font-size:42px">🕉️</div>
                        <div>
                            <h2>Welcome to Subba Rao Matching Services</h2>
                            <p>
                                Tradition • Trust • Togetherness
                            </p>
                            <p style="margin-top:6px">
                                A trusted family space to find meaningful
                                marriage alliances.
                            </p>
                        </div>
                        <div style="margin-left:auto;font-size:34px">
                            🪔
                        </div>
                    </div>
                    <div style="
                        text-align:center;
                        margin-top:14px;
                        padding-top:12px;
                        border-top:1px solid var(--gold-light);
                        color:var(--maroon);
                    ">
                        <span>🌸</span>
                        <span style="margin:0 12px">🙏 శుభమస్తు 🙏</span>
                        <span>🌸</span>
                    </div>
                </div>

                <h1>${t('dashboard')}</h1>

                <div class="cards">
                    ${[
                        [t('total'), d.total],
                        [t('male'), d.male],
                        [t('female'), d.female],
                        [t('pending'), d.pending]
                    ].map(x => `
                        <div class="card stat">
                            ${x[0]}
                            <strong>${x[1]}</strong>
                        </div>
                    `).join('')}
                </div>

                <div class="card">
                    <h3>🪔 Family Matchmaking Workspace</h3>
                    <p>
                        Use Add Profile to register a candidate.
                        Use OCR Image Intake to read a shared image,
                        then verify all extracted details before saving.
                    </p>
                    <p class="muted">
                        May every profile lead to a happy and compatible alliance.
                    </p>
                    <div style="text-align:center;font-size:24px;margin-top:12px">
                        🌺 🪔 🌺
                    </div>
                </div>
            `;
        }

        

        if (page === 'profiles') {
            const d = await api('/api/profiles');
            allProfiles = Array.isArray(d) ? d : [];
            renderProfiles(allProfiles);
        }

        if (page === 'add') {
            v.innerHTML = `
                <h1>${t('add')}</h1>
                <form class="card" onsubmit="saveProfile(event)">
                    <div class="grid2">
                        ${fld('gender', t('gender'),
                            '<option>Male</option><option>Female</option>', 'select')}
                        ${fld('full_name', t('name'))}
                        ${fld('age', t('age'), '', 'number')}
                        ${fld('height', 'Height (e.g. 5 ft 6 in)')}
                        ${fld('location', t('location'))}
                        ${fld('gothram', t('gothram'))}
                        ${fld('star', t('star'))}
                        ${fld('job', t('job'))}
                        ${fld('salary_lpa', t('salary'), '', 'number')}
                        ${fld('phone', t('phone'))}
                        ${fld('source_group', t('source'))}
                        ${fld('source_sender', t('sender'))}
                        ${fld('source_date', t('date'), '', 'date')}
                    </div>
                    <button type="submit">${t('save')}</button>
                </form>
            `;
        }

        if (page === 'upload') {
            const ps = await api('/api/profiles');
            v.innerHTML = `
                <h1>${t('upload')}</h1>
                <div class="card">
                    <p>
                        Upload a profile image shared/exported from WhatsApp.
                        OCR provides a draft only; verify before creating a profile.
                    </p>
                    <div class="field">
                        <label>Image</label>
                        <input type="file" id="ocrfile" accept="image/*">
                    </div>
                    <div class="grid2">
                        ${fld('source_group', t('source'))}
                        ${fld('source_sender', t('sender'))}
                        ${fld('source_date', t('date'), '', 'date')}
                    </div>
                    <button type="button" onclick="doOCR()">
                        Extract text with OCR
                    </button>
                    <div class="field">
                        <label>${t('verify')}</label>
                        <textarea id="ocrtext" rows="9"></textarea>
                    </div>
                    <div id="ocrhint" class="notice"></div>
                </div>

                <div class="card">
                    <h3>Attach image to saved profile</h3>
                    <p class="muted">
                        Upload the candidate's original photo.
                        It will remain in private cloud storage.
                    </p>
                    <div class="field">
                        <label>Profile</label>
                        <select id="imageprofile">
                            ${ps.map(x => `
                                <option value="${escapeHTML(x.id)}">
                                    ${escapeHTML(x.profile_code)} —
                                    ${escapeHTML(x.full_name || 'Unnamed')}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="field">
                        <label>Original photo</label>
                        <input type="file" id="attachfile"
                            accept="image/jpeg,image/png,image/webp,image/gif">
                    </div>
                    <button type="button" onclick="attachImage()">
                        Upload securely
                    </button>
                    <p class="muted">Maximum image size: 12 MB.</p>
                </div>
            `;
        }

        if (page === 'matching') {
            const ps = await api('/api/profiles');
            v.innerHTML = `
                <h1>${t('matching')}</h1>
                <div class="card">
                    <div class="field">
                        <label>${t('choose')}</label>
                        <select id="src">
                            ${ps.map(x => `
                                <option value="${escapeHTML(x.id)}">
                                    ${escapeHTML(x.profile_code)} —
                                    ${escapeHTML(x.full_name || 'Unnamed')}
                                    (${escapeHTML(x.gender)})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <p>${t('criteria')}</p>
                    ${[
                        'location', 'salary_lpa', 'job',
                        'age', 'gothram', 'star'
                    ].map(x => `
                        <label style="margin-right:14px">
                            <input class="crit" type="checkbox" value="${x}">
                            ${x}
                        </label>
                    `).join('')}
                    <p>
                        <button type="button" onclick="match()">
                            ${t('run')}
                        </button>
                    </p>
                </div>
                <div id="matches" class="card"></div>
            `;
        }

        if (page === 'members') {
            const d = await api('/api/members');
            v.innerHTML = `
                <h1>${t('members')}</h1>
                <div class="card tablewrap">
                    <table>
                        <tr>
                            <th>Name</th><th>Role</th>
                            <th>Active</th><th>Language</th>
                        </tr>
                        ${d.map(x => `
                            <tr>
                                <td>${escapeHTML(x.full_name)}</td>
                                <td>${escapeHTML(x.role)}</td>
                                <td>${escapeHTML(x.active)}</td>
                                <td>${escapeHTML(x.language)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        }
    } catch (e) {
        v.innerHTML = `<div class="notice">${escapeHTML(e.message)}</div>`;
    }
}


// =====================================================
// PROFILE SEARCH AND FILTERS
// =====================================================

function renderProfiles(profiles) {
    const v = document.querySelector('#view');

    const uniqueValues = field => [
        ...new Set(allProfiles
            .map(p => String(p[field] ?? '').trim())
            .filter(Boolean))
    ].sort((a, b) => a.localeCompare(b));

    const options = (field, label) => `
        <div class="field">
            <label>${label}</label>
            <select id="filter_${field}" onchange="applyProfileFilters()">
                <option value="">All ${label}</option>
                ${uniqueValues(field).map(value => `
                    <option value="${escapeHTML(value)}">
                        ${escapeHTML(value)}
                    </option>
                `).join('')}
            </select>
        </div>
    `;

    v.innerHTML = `
        <h1>${t('profiles')}</h1>
        <p class="muted">
            Click any profile row to view complete details and submission history.
        </p>
        <div class="card">
            <h3>Search & Filters</h3>
            <div class="field">
                <label>Search Name / Profile Code / Phone</label>
                <input id="filter_search" type="search"
                    placeholder="Enter name, code or phone..."
                    oninput="applyProfileFilters()">
            </div>
            <div class="grid2">
                ${options('gender', 'Gender')}
                <div class="field">
                    <label>Minimum Age</label>
                    <input id="filter_age_min" type="number" min="0"
                        placeholder="From" oninput="applyProfileFilters()">
                </div>
                <div class="field">
                    <label>Maximum Age</label>
                    <input id="filter_age_max" type="number" min="0"
                        placeholder="To" oninput="applyProfileFilters()">
                </div>
                ${options('height', 'Height')}
                ${options('location', 'Location')}
                ${options('gothram', 'Gothram')}
                ${options('star', 'Nakshatram')}
                ${options('source_group', 'Source Group')}
                <div class="field">
                    <label>Minimum Salary (LPA)</label>
                    <input id="filter_salary_min" type="number" min="0"
                        placeholder="Minimum" oninput="applyProfileFilters()">
                </div>
                <div class="field">
                    <label>Maximum Salary (LPA)</label>
                    <input id="filter_salary_max" type="number" min="0"
                        placeholder="Maximum" oninput="applyProfileFilters()">
                </div>
            </div>
            <button type="button" class="secondary"
                onclick="clearProfileFilters()">Clear Filters</button>
            <p id="profile_count" class="muted"></p>
        </div>
        <div class="card tablewrap">
            <table>
                <thead>
                    <tr>
                        <th>Code</th><th>Name</th><th>Gender</th>
                        <th>Age</th><th>Location</th><th>Source group</th>
                        <th>First submitter</th><th>Status</th>
                    </tr>
                </thead>
                <tbody id="profile_rows"></tbody>
            </table>
        </div>
    `;
    displayProfileRows(profiles);
}

function displayProfileRows(profiles) {
    const rows = document.querySelector('#profile_rows');
    const count = document.querySelector('#profile_count');
    if (!rows || !count) return;

    count.textContent =
        `Showing ${profiles.length} of ${allProfiles.length} profiles`;

    if (!profiles.length) {
        rows.innerHTML = `
            <tr><td colspan="8">No profiles found. Try changing your filters.</td></tr>
        `;
        return;
    }

    rows.innerHTML = profiles.map(x => `
        <tr onclick="viewProfile('${escapeHTML(x.id)}')"
            style="cursor:pointer" title="Click to view profile details">
            <td>${escapeHTML(x.profile_code)}</td>
            <td>${escapeHTML(x.full_name)}</td>
            <td>${escapeHTML(x.gender)}</td>
            <td>${escapeHTML(x.age)}</td>
            <td>${escapeHTML(x.location)}</td>
            <td>${escapeHTML(x.source_group)}</td>
            <td>${escapeHTML(x.first_member?.full_name)}</td>
            <td>${escapeHTML(x.verification_status)}</td>
        </tr>
    `).join('');
}

function applyProfileFilters() {
    const getValue = id =>
        document.getElementById(id)?.value.trim() || '';

    const search = getValue('filter_search').toLowerCase();
    const gender = getValue('filter_gender').toLowerCase();
    const height = getValue('filter_height').toLowerCase();
    const location = getValue('filter_location').toLowerCase();
    const gothram = getValue('filter_gothram').toLowerCase();
    const star = getValue('filter_star').toLowerCase();
    const source = getValue('filter_source_group').toLowerCase();

    const ageMin = getValue('filter_age_min');
    const ageMax = getValue('filter_age_max');
    const salaryMin = getValue('filter_salary_min');
    const salaryMax = getValue('filter_salary_max');

    const filtered = allProfiles.filter(p => {
        const searchText = [p.full_name, p.profile_code, p.phone]
            .map(x => String(x ?? '').toLowerCase()).join(' ');

        if (search && !searchText.includes(search)) return false;
        if (gender && String(p.gender ?? '').toLowerCase() !== gender) return false;
        if (height && String(p.height ?? '').trim().toLowerCase() !== height) return false;
        if (location && String(p.location ?? '').toLowerCase() !== location) return false;
        if (gothram && String(p.gothram ?? '').toLowerCase() !== gothram) return false;
        if (star && String(p.star ?? '').toLowerCase() !== star) return false;
        if (source && String(p.source_group ?? '').toLowerCase() !== source) return false;

        const age = Number(p.age);
        const salary = Number(p.salary_lpa);

        if (ageMin !== '' && (!Number.isFinite(age) || age < Number(ageMin))) return false;
        if (ageMax !== '' && (!Number.isFinite(age) || age > Number(ageMax))) return false;
        if (salaryMin !== '' && (!Number.isFinite(salary) || salary < Number(salaryMin))) return false;
        if (salaryMax !== '' && (!Number.isFinite(salary) || salary > Number(salaryMax))) return false;

        return true;
    });

    displayProfileRows(filtered);
}

function clearProfileFilters() {
    [
        'filter_search', 'filter_gender', 'filter_age_min',
        'filter_age_max', 'filter_height', 'filter_location',
        'filter_gothram', 'filter_star', 'filter_source_group',
        'filter_salary_min', 'filter_salary_max'
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    displayProfileRows(allProfiles);
}


// =====================================================
// FORM FIELD HELPER AND SAVE PROFILE
// =====================================================

function fld(n, l, opts = '', type = 'text') {
    return `
        <div class="field">
            <label>${l}</label>
            ${type === 'select'
                ? `<select name="${n}">${opts}</select>`
                : `<input name="${n}" type="${type}"
                    ${type === 'number' ? 'min="0"' : ''}>`
            }
        </div>
    `;
}

async function saveProfile(e) {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.submitting === 'true') return;

    form.dataset.submitting = 'true';
    const btn = form.querySelector('button[type="submit"]');

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    const d = Object.fromEntries(new FormData(form));
    if (d.age) d.age = Number(d.age);
    if (d.salary_lpa) d.salary_lpa = Number(d.salary_lpa);

    try {
        const x = await api('/api/profiles', {
            method: 'POST',
            body: JSON.stringify(d)
        });
        notice('Saved ' + x.profile_code);
        go('profiles');
    } catch (x) {
        notice(x.message);
    } finally {
        form.dataset.submitting = 'false';
        if (btn) {
            btn.disabled = false;
            btn.textContent = t('save');
        }
    }
}


// =====================================================
// PROFILE DETAILS + ORIGINAL PHOTO GALLERY
// =====================================================

async function viewProfile(profileId) {
    const v = document.querySelector('#view');

    try {
        v.innerHTML = '<p>Loading profile details...</p>';

        const data = await api(
            '/api/profiles/' + encodeURIComponent(profileId)
        );

        const p = data.profile;
        const submissions = data.submissions || [];
        const images = data.images || [];

        const fields = [
            ['Profile Code', p.profile_code],
            ['Full Name', p.full_name],
            ['Gender', p.gender],
            ['Age', p.age],
            ['Height', p.height],
            ['Location', p.location],
            ['Gothram', p.gothram],
            ['Star', p.star],
            ['Education', p.education],
            ['Job', p.job],
            ['Salary (LPA)', p.salary_lpa],
            ['Phone', p.phone],
            ['WhatsApp Group', p.source_group],
            ['Source Sender', p.source_sender],
            ['Source Date', p.source_date],
            ['Verification Status', p.verification_status],
            ['Marriage Status', p.marriage_status]
        ];

        const imageGallery = images.length ? `
            <div style="display:grid;
                grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
                gap:16px;">
                ${images.map(img => {
                    const imageUrl = img.signed_url || img.url;
                    return `
                        <div style="border:1px solid #ddd;border-radius:10px;
                            padding:10px;min-width:0;">
                            ${imageUrl ? `
                                <a href="${escapeHTML(imageUrl)}"
                                    target="_blank" rel="noopener noreferrer">
                                    <img src="${escapeHTML(imageUrl)}"
                                        alt="Candidate original photo"
                                        loading="lazy"
                                        style="width:100%;height:230px;
                                        object-fit:contain;border-radius:8px;
                                        background:#f3f3f3;">
                                </a>
                            ` : `
                                <div class="notice">Photo link unavailable.</div>
                            `}
                            <p style="overflow-wrap:anywhere">
                                <strong>${escapeHTML(img.original_filename)}</strong>
                            </p>
                            <p class="muted">
                                ${escapeHTML(img.created_at
                                    ? new Date(img.created_at).toLocaleString()
                                    : '')}
                            </p>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `<p class="muted">No original photos uploaded for this profile yet.</p>`;

        v.innerHTML = `
            <button class="secondary" onclick="go('profiles')">
                ← Back to Profiles
            </button>
            <h1>Profile Details</h1>

            <div class="card">
                <div style="display:flex;justify-content:space-between;
                    align-items:center;gap:12px;flex-wrap:wrap;">
                    <h2>Candidate Original Photos</h2>
                    <button type="button"
                        onclick="goToPhotoUpload('${escapeHTML(p.id)}')">
                        + Add Photo
                    </button>
                </div>
                ${imageGallery}
            </div>

            <div class="card">
                <h2>Profile Sharing Card</h2>
                <p class="muted">
                    Create a professional candidate card and share it through WhatsApp
                    or download it as PDF or PNG.
                </p>
                <button type="button"
                    onclick="createSharingCard('${escapeHTML(p.id)}')">
                    Create Sharing Card
                </button>
            </div>

            <div class="card">
                <h2>Profile Information</h2>
                <div class="grid2">
                    ${fields.map(([label, value]) => `
                        <div class="field">
                            <label>${escapeHTML(label)}</label>
                            <p>${escapeHTML(value)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <h2>Submission History</h2>
            <div class="card tablewrap">
                <table>
                    <tr>
                        <th>Submitted By</th><th>Source Group</th>
                        <th>Sender</th><th>Submission Date</th><th>Type</th>
                    </tr>
                    ${submissions.map(s => `
                        <tr>
                            <td>${escapeHTML(s.user_profiles?.full_name)}</td>
                            <td>${escapeHTML(s.source_group)}</td>
                            <td>${escapeHTML(s.source_sender)}</td>
                            <td>${escapeHTML(s.submitted_at
                                ? new Date(s.submitted_at).toLocaleString()
                                : '-')}</td>
                            <td>${s.is_first
                                ? 'First submission'
                                : 'Duplicate submission'}</td>
                        </tr>
                    `).join('') || `
                        <tr><td colspan="5">No submission history found.</td></tr>
                    `}
                </table>
            </div>
        `;
    } catch (e) {
        v.innerHTML = `
            <div class="notice">${escapeHTML(e.message)}</div>
            <button onclick="go('profiles')">Back to Profiles</button>
        `;
    }
}

async function goToPhotoUpload(profileId) {
    page = 'upload';
    render();

    const waitForSelect = () => {
        const select = document.querySelector('#imageprofile');

        if (select) {
            select.value = profileId;
            return;
        }

        requestAnimationFrame(waitForSelect);
    };

    waitForSelect();
}


// =====================================================
// PROFILE SHARING CARD - WHATSAPP + PDF + PNG
// =====================================================

async function createSharingCard(profileId) {
    try {
        const data = await api(
            '/api/profiles/' + encodeURIComponent(profileId)
        );

        const p = data.profile;
        const images = data.images || [];

        const photo = images.find(x => x.signed_url || x.url);
        const photoUrl = photo ? (photo.signed_url || photo.url) : '';

        const area = document.querySelector('#view');
        const existing = document.querySelector('#sharing-card-area');
        if (existing) existing.remove();

        const cardArea = document.createElement('div');
        cardArea.id = 'sharing-card-area';
        cardArea.className = 'card';
        cardArea.style.marginTop = '20px';

        cardArea.innerHTML = `
            <h2>Candidate Profile Sharing Card</h2>
            <p class="muted">
                Phone number is hidden by default. Select the checkbox only
                if you want to include it in the downloaded or shared card.
            </p>

            <label style="display:flex;align-items:center;gap:8px;margin:15px 0;">
                <input type="checkbox" id="share-show-phone">
                Show phone number on sharing card
            </label>

            <div id="share-card-preview" style="
                width:100%;
                max-width:720px;
                box-sizing:border-box;
                margin:15px auto;
                padding:30px;
                background:#ffffff;
                color:#20252b;
                border:1px solid #dedede;
                border-radius:14px;
                font-family:Arial,sans-serif;
            ">
                <div style="text-align:center;border-bottom:3px solid #8b6b3d;
                    padding-bottom:16px;margin-bottom:20px;">
                    <div style="font-size:13px;letter-spacing:3px;
                        color:#8b6b3d;font-weight:bold;">
                        MATRIMONY PROFILE
                    </div>
                    <h1 style="margin:10px 0 4px;font-size:28px;">
                        ${escapeHTML(p.full_name)}
                    </h1>
                    <div style="color:#666;font-size:14px;">
                        ${escapeHTML(p.profile_code)}
                    </div>
                </div>

                <div style="display:flex;gap:22px;align-items:flex-start;
                    flex-wrap:wrap;">
                    ${photoUrl ? `
                        <img src="${escapeHTML(photoUrl)}"
                            crossorigin="anonymous"
                            alt="Candidate"
                            style="width:210px;height:250px;
                            object-fit:cover;border-radius:10px;
                            border:1px solid #ddd;">
                    ` : `
                        <div style="width:210px;height:250px;
                            display:flex;align-items:center;
                            justify-content:center;background:#f1f1f1;
                            border-radius:10px;color:#777;">
                            Photo not available
                        </div>
                    `}

                    <div style="flex:1;min-width:220px;">
                        <div style="font-size:20px;font-weight:bold;
                            margin-bottom:12px;color:#8b6b3d;">
                            Personal Details
                        </div>
                        ${shareField('Age', p.age)}
                        ${shareField('Height', p.height)}
                        ${shareField('Gender', p.gender)}
                        ${shareField('Location', p.location)}
                        ${shareField('Gothram', p.gothram)}
                        ${shareField('Nakshatram', p.star)}
                    </div>
                </div>

                <div style="margin-top:22px;padding-top:18px;
                    border-top:1px solid #ddd;">
                    <div style="font-size:20px;font-weight:bold;
                        margin-bottom:12px;color:#8b6b3d;">
                        Education & Career
                    </div>
                    ${shareField('Education', p.education)}
                    ${shareField('Profession', p.job)}
                    ${shareField('Annual Salary', p.salary_lpa
                        ? p.salary_lpa + ' LPA' : '')}
                    <div id="share-phone-row" style="display:none;">
                        ${shareField('Phone', p.phone)}
                    </div>
                </div>

                <div style="margin-top:22px;padding-top:12px;
                    border-top:1px solid #ddd;text-align:center;
                    color:#888;font-size:11px;">
                    Shared by Matchmaking Desk
                </div>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <button type="button" id="share-whatsapp">
                    Share to WhatsApp
                </button>
                <button type="button" id="download-share-png">
                    Download PNG
                </button>
                <button type="button" id="download-share-pdf">
                    Download PDF
                </button>
            </div>
        `;

        area.appendChild(cardArea);

        const phoneCheckbox = document.querySelector('#share-show-phone');
        const phoneRow = document.querySelector('#share-phone-row');

        phoneCheckbox.addEventListener('change', () => {
            phoneRow.style.display = phoneCheckbox.checked ? 'block' : 'none';
        });

        document.querySelector('#share-whatsapp')
            .addEventListener('click', shareToWhatsApp);

        document.querySelector('#download-share-png')
            .addEventListener('click', downloadSharingPNG);

        document.querySelector('#download-share-pdf')
            .addEventListener('click', downloadSharingPDF);

        cardArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (e) {
        notice('Could not create sharing card: ' + e.message);
    }
}

function shareField(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `
        <div style="display:flex;gap:8px;margin:8px 0;
            font-size:14px;line-height:1.5;">
            <strong style="min-width:115px;color:#555;">
                ${escapeHTML(label)}
            </strong>
            <span>${escapeHTML(value)}</span>
        </div>
    `;
}


// =====================================================
// SHARE CANDIDATE CARD TO WHATSAPP
// =====================================================

async function shareToWhatsApp() {
    const card = document.querySelector('#share-card-preview');
    const button = document.querySelector('#share-whatsapp');

    if (!card) {
        return notice('Create the sharing card first.');
    }

    if (!window.html2canvas) {
        return notice(
            'Sharing library did not load. Check your internet connection and refresh.'
        );
    }

    try {
        button.disabled = true;
        button.textContent = 'Preparing WhatsApp share...';

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/png')
        );

        if (!blob) {
            throw new Error('Could not create candidate image.');
        }

        const file = new File(
            [blob],
            'candidate-profile.png',
            { type: 'image/png' }
        );

        const shareText =
            'Candidate Matrimony Profile\n' +
            'Please find the attached candidate profile.';

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({ files: [file] })
        ) {
            await navigator.share({
                files: [file],
                title: 'Candidate Matrimony Profile',
                text: shareText
            });

        } else {
            const objectURL = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = objectURL;
            link.download = 'candidate-profile.png';
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectURL), 10000);

            const whatsappURL =
                'https://wa.me/?text=' + encodeURIComponent(shareText);

            window.open(whatsappURL, '_blank');

            notice(
                'Candidate image downloaded and WhatsApp opened. ' +
                'Please attach candidate-profile.png in the WhatsApp chat.'
            );
        }

    } catch (e) {
        if (e.name !== 'AbortError') {
            notice('WhatsApp sharing failed: ' + e.message);
            console.error(e);
        }
    } finally {
        button.disabled = false;
        button.textContent = 'Share to WhatsApp';
    }
}


// =====================================================
// DOWNLOAD SHARING CARD AS PNG
// =====================================================

async function downloadSharingPNG() {
    const card = document.querySelector('#share-card-preview');
    const button = document.querySelector('#download-share-png');

    if (!card) return notice('Create the sharing card first.');

    if (!window.html2canvas) {
        return notice(
            'PNG library did not load. Check your internet connection and refresh.'
        );
    }

    try {
        button.disabled = true;
        button.textContent = 'Creating PNG...';

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        const link = document.createElement('a');
        link.download = 'candidate-profile.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (e) {
        notice(
            'PNG creation failed. If the candidate photo is blocked by browser security, try again without the photo.'
        );
        console.error(e);
    } finally {
        button.disabled = false;
        button.textContent = 'Download PNG';
    }
}


// =====================================================
// DOWNLOAD SHARING CARD AS PDF
// =====================================================

async function downloadSharingPDF() {
    const card = document.querySelector('#share-card-preview');
    const button = document.querySelector('#download-share-pdf');

    if (!card) return notice('Create the sharing card first.');

    if (!window.html2canvas || !window.jspdf?.jsPDF) {
        return notice(
            'PDF/PNG libraries did not load. Check your internet connection and refresh.'
        );
    }

    try {
        button.disabled = true;
        button.textContent = 'Creating PDF...';

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        const imageData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        let width = maxWidth;
        let height = canvas.height * width / canvas.width;

        if (height > maxHeight) {
            height = maxHeight;
            width = canvas.width * height / canvas.height;
        }

        const x = (pageWidth - width) / 2;
        const y = margin;

        pdf.addImage(imageData, 'PNG', x, y, width, height);
        pdf.save('candidate-profile.pdf');

    } catch (e) {
        notice('PDF creation failed. Please try again.');
        console.error(e);
    } finally {
        button.disabled = false;
        button.textContent = 'Download PDF';
    }
}


// =====================================================
// OCR IMAGE INTAKE
// =====================================================

async function doOCR() {
    const f = document.querySelector('#ocrfile')?.files?.[0];
    if (!f) return notice('Choose an image');

    const d = new FormData();
    d.append('file', f);

    for (const k of ['source_group', 'source_sender', 'source_date']) {
        d.append(k, document.querySelector(`[name=${k}]`)?.value || '');
    }

    try {
        const x = await api('/api/intake/ocr', {
            method: 'POST',
            body: d
        });

        document.querySelector('#ocrtext').value = x.ocr_text;
        document.querySelector('#ocrhint').textContent =
            JSON.stringify(x.suggested_fields) + ' — ' + x.warning;
    } catch (e) {
        notice(e.message);
    }
}


// =====================================================
// ATTACH ORIGINAL PROFILE PHOTO
// =====================================================

async function attachImage() {
    const fileInput = document.querySelector('#attachfile');
    const profileSelect = document.querySelector('#imageprofile');

    const f = fileInput?.files?.[0];
    const profileId = profileSelect?.value;

    if (!profileId) return notice('Choose a profile first');
    if (!f) return notice('Choose an image');

    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ];

    if (!allowedTypes.includes(f.type)) {
        return notice('Please select a JPEG, PNG, WEBP or GIF image');
    }

    if (f.size > 12 * 1024 * 1024) {
        return notice('Image must be 12 MB or smaller');
    }

    const d = new FormData();
    d.append('file', f);
    d.append('profile_id', profileId);

    const uploadButton = [...document.querySelectorAll('#view button')]
        .find(b => b.textContent.includes('Upload securely'));

    if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
    }

    try {
        await api('/api/intake/image', {
            method: 'POST',
            body: d
        });

        notice('Original photo uploaded successfully.');
        await viewProfile(profileId);

    } catch (e) {
        notice(e.message);
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Upload securely';
        }
    }
}


// =====================================================
// FIND MATCHES + NAKSHATRA COMPATIBILITY
// =====================================================

async function match() {
    const criteria = [
        ...document.querySelectorAll('.crit:checked')
    ].map(x => x.value);

    if (criteria.length !== 3) {
        return notice('Select exactly three criteria');
    }

    const resultsDiv = document.querySelector('#matches');
    resultsDiv.innerHTML = '<p>Finding matches...</p>';

    try {
        const d = await api('/api/matching', {
            method: 'POST',
            body: JSON.stringify({
                profile_id: document.querySelector('#src').value,
                criteria
            })
        });

        if (!d.results || d.results.length === 0) {
            resultsDiv.innerHTML = '<h3>No matching profiles found</h3>';
            return;
        }

        resultsDiv.innerHTML = `
            <h2>Matching Profiles</h2>
            ${d.results.map(x => {
                const p = x.profile;
                const s = x.star_compatibility;
                const rules = s?.rules || {};

                const ruleLabels = {
                    tara: 'Tara', gana: 'Gana',
                    mahendra: 'Mahendra',
                    stree_deergha: 'Stree Deergha',
                    yoni: 'Yoni', rajju: 'Rajju',
                    vedha: 'Vedha', nadi: 'Nadi'
                };

                const ruleHTML = Object.entries(ruleLabels)
                    .map(([key, label]) => {
                        const rule = rules[key];
                        if (!rule) return '';

                        const status = rule.status || 'Review';
                        const passed = status.toLowerCase() === 'pass';
                        const color = passed ? '#16803c' : '#b7791f';

                        const details = [
                            rule.result,
                            rule.count !== undefined ? `Count: ${rule.count}` : null,
                            rule.boy && rule.girl
                                ? `Boy: ${rule.boy} | Girl: ${rule.girl}` : null,
                            rule.note
                        ].filter(Boolean).join(' · ');

                        return `
                            <div style="display:flex;justify-content:space-between;
                                align-items:flex-start;gap:12px;padding:10px 0;
                                border-bottom:1px solid #ddd;">
                                <div>
                                    <strong>${label}</strong>
                                    <div class="muted">${escapeHTML(details)}</div>
                                </div>
                                <strong style="color:${color}">
                                    ${escapeHTML(status)}
                                </strong>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="card" style="margin-top:18px">
                        <h2>
                            ${escapeHTML(p.profile_code)} —
                            ${escapeHTML(p.full_name)}
                        </h2>
                        <div class="grid2">
                            <div><strong>Gender:</strong> ${escapeHTML(p.gender)}</div>
                            <div><strong>Age:</strong> ${escapeHTML(p.age)}</div>
                            <div><strong>Location:</strong> ${escapeHTML(p.location)}</div>
                            <div><strong>Gothram:</strong> ${escapeHTML(p.gothram)}</div>
                            <div><strong>Star:</strong> ${escapeHTML(p.star)}</div>
                            <div><strong>Salary:</strong> ${escapeHTML(p.salary_lpa)} LPA</div>
                        </div>
                        <hr>
                        <h3>Match Score: ${escapeHTML(x.score)}%</h3>
                        <h3>Matching Criteria</h3>
                        <p>${escapeHTML((x.reasons || []).join(' · '))}</p>
                        <hr>
                        <h3>♥ Nakshatra Compatibility</h3>
                        ${s?.available ? `
                            <p><strong>Boy Star:</strong> ${escapeHTML(s.boy_star)}</p>
                            <p><strong>Girl Star:</strong> ${escapeHTML(s.girl_star)}</p>
                            <div style="padding:12px;border:1px solid #ddd;border-radius:8px;">
                                ${ruleHTML}
                            </div>
                            <h3 style="margin-top:15px">
                                Checks Passed: ${escapeHTML(s.passed_checks)}
                                / ${escapeHTML(s.total_checks)}
                            </h3>
                            ${s.major_flags?.length ? `
                                <div class="notice">
                                    <strong>Important Flags</strong>
                                    <ul>${s.major_flags.map(flag =>
                                        `<li>${escapeHTML(flag)}</li>`
                                    ).join('')}</ul>
                                </div>
                            ` : ''}
                            <div class="notice" style="margin-top:12px">
                                <strong>Important:</strong> ${escapeHTML(s.status)}
                                <p>${escapeHTML(s.note)}</p>
                            </div>
                        ` : `
                            <div class="notice">
                                Nakshatra compatibility unavailable:
                                ${escapeHTML(s?.message || 'Star details not recognized')}
                            </div>
                        `}
                    </div>
                `;
            }).join('')}
        `;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="notice">${escapeHTML(e.message)}</div>`;
    }
}


// --------------------------------------------------
// START APPLICATION
// --------------------------------------------------


(async function startApp() {
    const isRecovery = await checkPasswordRecovery();

    if (!isRecovery) {
        boot();
    }
})();
