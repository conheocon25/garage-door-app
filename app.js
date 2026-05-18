/* app.js */
const FIREBASE_DATABASE_URL = "https://mycardoor-fa2df.firebaseio.com";
const RUN_ENDPOINT = `${FIREBASE_DATABASE_URL}/run.json`;

const get = id => document.getElementById(id);
const statusText = get('status-text'), statusIndicator = get('status-indicator'),
      btnOpen = get('btn-open'), btnClose = get('btn-close'),
      infoIp = get('info-ip'), infoStrnote = get('info-strnote'),
      loginOverlay = get('login-overlay'), loginPasswordInput = get('login-password'),
      btnLogin = get('btn-login'), btnBiometric = get('btn-biometric'),
      loginError = get('login-error'), appContainer = get('app-container');

let serverPassword = null, realtimeUpdateListener = false, currentStatus = null;

function updateUI(status) {
    currentStatus = status;
    const isOpen = status === '1', isClosed = status === '0';
    statusText.textContent = isOpen ? 'Cửa đang mở' : (isClosed ? 'Cửa đang đóng' : 'Trạng thái không xác định');
    statusText.className = `status-text ${isOpen ? 'open' : (isClosed ? 'closed' : '')}`;
    statusIndicator.className = `status-indicator ${isOpen ? 'open' : (isClosed ? 'closed' : '')}`;
}

async function setDoorStatus(status) {
    if (currentStatus === status) return;
    try {
        btnOpen.disabled = btnClose.disabled = true;
        const note = status === '1' ? 'Đã_Mở_Cửa' : 'Đã_Đóng_Cửa';
        const res = await fetch(RUN_ENDPOINT, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ state: status, strnote: note })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        updateUI(status);
        infoStrnote.textContent = `Trạng thái: ${note}`;
        
        const getRes = await fetch(RUN_ENDPOINT);
        if (getRes.ok) {
            const data = await getRes.json();
            if (data?.ip) infoIp.textContent = `IP: ${data.ip}`;
            if (data?.strnote) infoStrnote.textContent = `Trạng thái: ${data.strnote}`;
        }
    } catch (e) {
        alert("Lỗi kết nối Firebase.");
    } finally {
        btnOpen.disabled = btnClose.disabled = false;
    }
}

btnOpen.addEventListener('click', () => setDoorStatus('1'));
btnClose.addEventListener('click', () => setDoorStatus('0'));

function listenForRealtimeUpdates() {
    const es = new EventSource(RUN_ENDPOINT);
    const handleData = (e) => {
        try {
            const { path, data } = JSON.parse(e.data);
            if (data !== undefined && data !== null) {
                if (path === '/') {
                    if (data.state !== undefined) updateUI(data.state);
                    if (data.ip) infoIp.textContent = `IP: ${data.ip}`;
                    if (data.strnote) infoStrnote.textContent = `Trạng thái: ${data.strnote}`;
                } else if (path === '/state') updateUI(data);
                else if (path === '/ip') infoIp.textContent = `IP: ${data}`;
                else if (path === '/strnote') infoStrnote.textContent = `Trạng thái: ${data}`;
            } else if (data === null && path === '/') {
                updateUI('0'); infoIp.textContent = 'IP: --'; infoStrnote.textContent = 'Trạng thái: --';
            }
        } catch (err) {}
    };
    es.addEventListener('put', handleData);
    es.addEventListener('patch', handleData);
}

document.addEventListener('DOMContentLoaded', checkLoginState);

async function fetchPassword() {
    try {
        const res = await fetch(`${FIREBASE_DATABASE_URL}/run/config/10.json`);
        if (res.ok) {
            const val = await res.json();
            if (val !== null) serverPassword = String(val).replace(/^"|"$/g, '').trim();
        }
    } catch (err) {}
}

async function checkLoginState() {
    if (localStorage.getItem('biometricCredentialId') && window.PublicKeyCredential) btnBiometric.classList.remove('hidden');
    if (sessionStorage.getItem('isAuthenticated') === 'true') {
        showApp();
    } else {
        await fetchPassword();
        loginOverlay.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
}

function showApp() {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    if (!realtimeUpdateListener) {
        listenForRealtimeUpdates();
        realtimeUpdateListener = true;
    }
}

btnLogin.addEventListener('click', async () => {
    if (!serverPassword) await fetchPassword();
    if (loginPasswordInput.value === serverPassword) {
        loginError.classList.add('hidden');
        sessionStorage.setItem('isAuthenticated', 'true');
        showApp();
        if (window.PublicKeyCredential && !localStorage.getItem('biometricCredentialId')) {
             setTimeout(async () => {
                 if (confirm("Bật đăng nhập bằng Vân tay / Face ID?")) await registerBiometric();
             }, 500);
        }
    } else loginError.classList.remove('hidden');
});

loginPasswordInput.addEventListener('keypress', (e) => e.key === 'Enter' && btnLogin.click());

async function registerBiometric() {
    try {
        const challenge = new Uint8Array(32), userId = new Uint8Array(16);
        crypto.getRandomValues(challenge); crypto.getRandomValues(userId);
        const cred = await navigator.credentials.create({
            publicKey: {
                challenge, rp: { name: "Garage Door App" },
                user: { id: userId, name: "user", displayName: "User" },
                pubKeyCredParams: [{alg: -7, type: "public-key"}, {alg: -257, type: "public-key"}],
                authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                timeout: 60000, attestation: "none"
            }
        });
        localStorage.setItem('biometricCredentialId', btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
        alert("Đăng ký thành công!");
        btnBiometric.classList.remove('hidden');
    } catch (e) {
        alert("Lỗi đăng ký Sinh trắc học. Vui lòng đảm bảo thiết bị hỗ trợ và dùng HTTPS.");
    }
}

btnBiometric.addEventListener('click', async () => {
    const credIdBase64 = localStorage.getItem('biometricCredentialId');
    if (!credIdBase64) return;
    try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const binaryStr = atob(credIdBase64);
        const id = new Uint8Array([...binaryStr].map(c => c.charCodeAt(0)));
        const assertion = await navigator.credentials.get({
            publicKey: { challenge, allowCredentials: [{ id, type: 'public-key' }], userVerification: 'required', timeout: 60000 }
        });
        if (assertion) {
            sessionStorage.setItem('isAuthenticated', 'true');
            showApp();
        }
    } catch (e) {
        alert("Đăng nhập Sinh trắc học thất bại.");
    }
});
