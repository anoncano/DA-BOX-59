import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail, deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, serverTimestamp, addDoc,
  onSnapshot, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o",
  authDomain: "da-box-59.firebaseapp.com",
  projectId: "da-box-59",
  storageBucket: "da-box-59.appspot.com",
  messagingSenderId: "382682873063",
  appId: "1:382682873063:web:e240e1bf8e14527b277642",
  databaseURL: "https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const rtdb = getDatabase(app);

// --- Utilities ---
const $ = (id) => document.getElementById(id);
let toastTimeout;
const showToast = (message, duration = 3000) => {
    const el = $("toast");
    if (!el) return alert(message);
    clearTimeout(toastTimeout);
    el.textContent = message;
    el.classList.add('show');
    el.classList.remove('opacity-0');
    toastTimeout = setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('opacity-0');
    }, duration);
};

const openModal = (modalEl) => {
    const backdrop = $('modal-backdrop');
    if (backdrop) backdrop.classList.remove('opacity-0', 'pointer-events-none');
    if (modalEl) {
        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('open');
    }
};

const closeModal = (modalEl) => {
    const backdrop = $('modal-backdrop');
    if (backdrop) backdrop.classList.add('opacity-0', 'pointer-events-none');
    if(modalEl) {
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        modalEl.classList.remove('open');
    }
};

window.logout = async () => {
    await signOut(auth);
    window.location.href = "index.html";
};

// --- Page-specific Logic ---
document.addEventListener("DOMContentLoaded", () => {
    const pageId = document.body.id;
    switch (pageId) {
        case "login-page":
            initLoginPage();
            break;
        case "register-page":
            initRegisterPage();
            break;

        case "general-page":
            initGeneralPage();
            break;
        case "admin-page":
            initAdminPage();
            break;
    }
});


// --- LOGIN PAGE ---
function initLoginPage() {
    const loginBtn = $('loginBtn');
    const resetBtn = $('resetBtn');
    
    const performLogin = async () => {
        const email = $("email").value;
        const pass = $("password").value;
        const msgEl = $("msg");
        const loadingEl = $("loading");
        const btnText = $("loginBtnText");
        
        if (!email || !pass) {
            msgEl.textContent = "Email and password are required.";
            return;
        }

        loginBtn.disabled = true;
        loadingEl.classList.remove("hidden");
        btnText.classList.add("hidden");
        msgEl.textContent = "";

        try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            const snap = await getDoc(doc(db, "users", cred.user.uid));
            if (!snap.exists()) throw new Error("User data not found.");
            
            if (snap.data().locked) {
                await signOut(auth);
                msgEl.textContent = "This account has been locked.";
                return;
            }
            
            const role = snap.data().role;
            window.location.href = role === "admin" ? "admin.html" : "general.html";

        } catch (err) {
            msgEl.textContent = err.message.replace('Firebase: ', '');
        } finally {
            loginBtn.disabled = false;
            loadingEl.classList.add("hidden");
            btnText.classList.remove("hidden");
        }
    };
    
    loginBtn.addEventListener('click', performLogin);
    $('password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performLogin();
    });

    resetBtn.addEventListener('click', async () => {
        const email = $("email").value;
        if (!email) {
            showToast("Please enter your email address first.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            openModal($('resetModal'));
        } catch (err) {
            showToast(`Error: ${err.message}`);
        }
    });

    $('resetClose').addEventListener('click', () => closeModal($('resetModal')));
}


// --- REGISTER PAGE ---
function initRegisterPage() {
    const regBtn = $('regBtn');
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
        $('regMsg').textContent = "Registration token is missing or invalid.";
        regBtn.disabled = true;
        return;
    }

    regBtn.addEventListener('click', async () => {
        const name = $("name").value;
        const email = $("regEmail").value;
        const pass = $("regPassword").value;
        const msgEl = $("regMsg");

        if(!name || !email || !pass) {
            msgEl.textContent = "All fields are required.";
            return;
        }
        msgEl.textContent = "";
        regBtn.disabled = true;

        try {
            const tokSnap = await getDoc(doc(db, "registerTokens", token));
            if (!tokSnap.exists() || tokSnap.data().used) {
                throw new Error("This invitation is invalid or has already been used.");
            }

            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            const tokenData = tokSnap.data();
            const role = tokenData.role || "general";
            const roles = (role === "general" && tokenData.med) ? ["med"] : [];

            await setDoc(doc(db, "users", cred.user.uid), { name, role, roles, locked: false });
            await updateDoc(doc(db, "registerTokens", token), { used: true });

            showToast("Registration successful! Redirecting to login...");
            await signOut(auth);
            setTimeout(() => (window.location.href = "index.html"), 2000);

        } catch (err) {
            msgEl.textContent = err.message.replace('Firebase: ', '');
            regBtn.disabled = false;
        }
    });
}


// --- GENERAL PAGE ---
function initGeneralPage() {
    // State
    let state = { isLocked: true, isMedLocked: true, isBusy: false, isOnline: true, isActionsMenuOpen: false };
    const initialSimulatedDate = new Date(Date.UTC(2025, 5, 23, 12, 11, 0)); // 10:11 PM AEST
    state.simulatedTime = initialSimulatedDate;
    let holdMs = 3000;
    let offlinePin = "";
    
    // Elements
    const elements = {
        status: { dot: $('status-dot'), text: $('status-text') },
        clock: $('clock'),
        actions: { menuBtn: $('actions-menu-btn'), menu: $('actions-menu') },
        locks: {
            toggleBtn: $('toggleBtn'), toggleBtnIcon: $('toggleBtn-icon'), toggleBtnText: $('toggleBtn-text'),
            medToggle: $('medToggle'), medToggleIcon: $('medToggle-icon'), medToggleText: $('medToggle-text'),
            medLockCard: $('med-lock-card')
        },
        buttons: { copyBtn: $('copyBtn'), offlineBtn: $('offlineBtn'), errorBtn: $('errorBtn'), deleteBtn: $('deleteBtn'), logoutFab: $('logout-fab') },
        modals: {
            error: $('errorModal'), offline: $('offlineModal'),
            token: $('tokenModal'), delete: $('deleteModal')
        }
    };

    const ICONS = {
        LOCKED: `<svg class="w-20 h-20 sm:w-24 sm:h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
        UNLOCKED: `<svg class="w-20 h-20 sm:w-24 sm:h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v4"></path></svg>`,
    };

    const updateOnlineStatus = (online) => {
        state.isOnline = online;
        if (online) {
            elements.status.dot.className = 'w-2.5 h-2.5 rounded-full transition-colors duration-500 bg-green-400';
            elements.status.text.textContent = 'Online';
        } else {
            elements.status.dot.className = 'w-2.5 h-2.5 rounded-full transition-colors duration-500 bg-red-400';
            elements.status.text.textContent = 'Offline';
            if(!Object.values(elements.modals).some(m => m.classList.contains('open'))) {
                openModal(elements.modals.offline);
                $('offlineCodeInput').value = offlinePin;
            }
        }
    };
    
    const updateTimeDisplays = () => {
        state.simulatedTime.setSeconds(state.simulatedTime.getSeconds() + 1);
        const timeOptions = { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: true };
        elements.clock.textContent = state.simulatedTime.toLocaleTimeString('en-AU', timeOptions);
    };

    const updateLockButton = (isMed, isLocked) => {
        const btn = isMed ? elements.locks.medToggle : elements.locks.toggleBtn;
        const iconEl = isMed ? elements.locks.medToggleIcon : elements.locks.toggleBtnIcon;
        const textEl = isMed ? elements.locks.medToggleText : elements.locks.toggleBtnText;
        if(isLocked) {
            btn.className = btn.className.replace('bg-green-600', 'bg-red-600').replace('hover:bg-green-500', 'hover:bg-red-500');
            iconEl.innerHTML = ICONS.LOCKED;
            textEl.textContent = 'LOCKED';
        } else {
            btn.className = btn.className.replace('bg-red-600', 'bg-green-600').replace('hover:bg-red-500', 'hover:bg-green-500');
            iconEl.innerHTML = ICONS.UNLOCKED;
            textEl.textContent = 'UNLOCKED';
        }
        btn.disabled = !isLocked;
    };

    const handleLockToggle = async (isMed = false) => {
        if (state.isBusy) return;
        if (!state.isOnline) { showToast("Action failed: System is offline."); return; }
        state.isBusy = true;

        const btn = isMed ? elements.locks.medToggle : elements.locks.toggleBtn;
        const statePath = isMed ? "medRelaystate" : "relaystate";
        
        btn.classList.add('animate-pulse');
        try {
            await set(ref(rtdb, statePath), "unlocked");
            await set(ref(rtdb, "relayHoldTime/ms"), holdMs);
        } catch (err) {
            showToast('Failed to send command.');
        } finally {
            state.isBusy = false;
            btn.classList.remove('animate-pulse');
        }
    };
    
    const toggleActionsMenu = (forceClose = false) => {
        state.isActionsMenuOpen = forceClose ? false : !state.isActionsMenuOpen;
        const menu = elements.actions.menu;
        if (state.isActionsMenuOpen) {
            menu.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        } else {
            menu.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        }
    };

    const setupModal = (modalName, openBtn, closeSelectors, submitFn) => {
        const modalEl = elements.modals[modalName];
        if (!modalEl) return;
        
        // Dynamically create modal content if it doesn't exist
        if (!modalEl.innerHTML.trim()) {
            modalEl.innerHTML = getModalContent(modalName);
        }

        if (openBtn) openBtn.addEventListener('click', () => openModal(modalEl));
        
        closeSelectors.forEach(selector => {
            const closeBtn = modalEl.querySelector(selector);
            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modalEl));
        });
        
        if (submitFn) submitFn(modalEl);
        
        // Close on backdrop click
        $('modal-backdrop').addEventListener('click', () => closeModal(modalEl));
    };

    const getModalContent = (modalName) => {
        switch(modalName) {
            case 'error': return `<div class="card rounded-2xl p-8 space-y-4 w-full max-w-sm"><h3 class="text-lg font-semibold text-white">Report an Issue</h3><textarea id="errorText" rows="4" class="w-full p-2 bg-gray-900/50 border-gray-700 rounded-md" placeholder="Describe the issue..."></textarea><label class="flex items-center gap-2 text-sm"><input type="checkbox" id="errorAck">Power was cut, waited, still error</label><div class="flex gap-2"><button id="cancelError" class="w-full bg-gray-600 p-2 rounded">Cancel</button><button id="sendError" class="w-full bg-blue-600 p-2 rounded">Send</button></div></div>`;
            case 'offline': return `<div class="card rounded-2xl p-8 space-y-4 w-full max-w-sm text-center"><h3 class="text-lg font-semibold text-white">Offline Access</h3><p class="text-sm text-gray-400">Join 'da-box-59' WiFi and go to http://192.168.4.1</p><input id="offlineCodeInput" readonly class="w-full p-2 bg-gray-900/50 rounded text-center font-mono text-lg"><div class="flex gap-2"><button id="copyOffline" class="w-full bg-gray-600 p-2 rounded">Copy</button><button id="launchOffline" class="w-full bg-blue-600 p-2 rounded">Launch</button></div><button id="closeOffline" class="w-full bg-gray-700 p-2 rounded mt-2">Close</button></div>`;
            case 'token': return `<div class="card rounded-2xl p-8 w-full max-w-sm"><div id="tokenStep1"><h3 class="text-lg font-semibold text-white mb-4">Invite User</h3><div class="space-y-2"><label class="flex items-center gap-2"><input type="radio" name="uRole" value="general" class="roleRad" checked>General</label><label class="flex items-center gap-2"><input type="radio" name="uRole" value="sub" class="roleRad">Sub Admin</label><label id="medWrap" class="flex items-center gap-2"><input type="checkbox" id="medFlag">Med Button</label></div><div class="flex gap-2 mt-4"><button id="cancelToken" class="w-full bg-gray-600 p-2 rounded">Cancel</button><button id="nextToken" class="w-full bg-blue-600 p-2 rounded">Next</button></div></div><div id="tokenStep2" class="hidden text-center"><h3 class="text-lg font-semibold text-white mb-4">Share Link</h3><canvas id="qrCanvas" class="bg-white p-2 rounded-lg mx-auto mb-4"></canvas><input id="tokenLink" readonly class="w-full p-2 bg-gray-900/50 rounded text-sm text-center"><div class="flex gap-2 mt-4"><button id="copyTokenLink" class="w-full bg-gray-600 p-2 rounded">Copy</button><button id="doneToken" class="w-full bg-blue-600 p-2 rounded">Done</button></div></div></div>`;
            case 'delete': return `<div class="card rounded-2xl p-8 space-y-4 w-full max-w-sm text-center"><h3 class="text-lg font-semibold text-white">Delete Account?</h3><p class="text-gray-400">This action is permanent and cannot be undone.</p><div class="flex gap-2"><button id="cancelDel" class="w-full bg-gray-600 p-2 rounded">Cancel</button><button id="confirmDel" class="w-full bg-red-600 p-2 rounded">Delete</button></div></div>`;
            default: return '';
        }
    };
    
    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "index.html"; return; }
        
        // Initial setup
        updateTimeDisplays();
        setInterval(updateTimeDisplays, 1000);
        setInterval(() => updateOnlineStatus(!state.isOnline), 15000); // Demo status change

        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists()) { logout(); return; }

        const userData = uSnap.data();
        const userRole = userData.role;
        const userRolesArr = userData.roles || [];
        
        // UI permissions
        elements.locks.medLockCard.classList.toggle('hidden', !userRolesArr.includes("med"));
        elements.buttons.copyBtn.classList.toggle('hidden', userRole !== "sub");

        // Realtime Listeners
        onValue(ref(rtdb, "relayHoldTime/ms"), s => { holdMs = s.val() || 3000; });
        onValue(ref(rtdb, "relaystate"), s => { state.isLocked = s.val() !== "unlocked"; updateLockButton(false, state.isLocked); });
        onValue(ref(rtdb, "medRelaystate"), s => { state.isMedLocked = s.val() !== "unlocked"; updateLockButton(true, state.isMedLocked); });
        onValue(ref(rtdb, "heartbeat"), () => updateOnlineStatus(true));
        
        const pinPath = userRole === "sub" ? "offlinePinSub" : "offlinePinGeneral";
        onValue(ref(rtdb, pinPath), s => { offlinePin = s.val() || ""; });

        // Event Listeners
        elements.actions.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleActionsMenu(); });
        document.addEventListener('click', () => { if (state.isActionsMenuOpen) toggleActionsMenu(true); });
        elements.locks.toggleBtn.addEventListener('click', () => handleLockToggle(false));
        elements.locks.medToggle.addEventListener('click', () => handleLockToggle(true));
        elements.buttons.logoutFab.addEventListener('click', logout);
        [elements.buttons.copyBtn, elements.buttons.offlineBtn, elements.buttons.errorBtn, elements.buttons.deleteBtn].forEach(btn => {
            btn.addEventListener('click', () => toggleActionsMenu(true));
        });

        // Setup Modals
        setupModal('error', elements.buttons.errorBtn, ['#cancelError'], (modalEl) => {
            modalEl.querySelector('#sendError').onclick = async () => {
                const msg = modalEl.querySelector("#errorText").value.trim();
                if (!msg || !modalEl.querySelector("#errorAck").checked) return showToast("Please describe the issue and acknowledge.");
                await addDoc(collection(db, "errors"), { message: msg, user: user.uid, createdAt: serverTimestamp() });
                closeModal(modalEl);
                showToast("Issue reported. Thank you!");
            };
        });
        
        setupModal('offline', elements.buttons.offlineBtn, ['#closeOffline'], (modalEl) => {
            modalEl.querySelector('#offlineCodeInput').value = offlinePin;
            modalEl.querySelector('#copyOffline').onclick = () => navigator.clipboard.writeText(offlinePin).then(() => showToast('PIN copied'));
            modalEl.querySelector('#launchOffline').onclick = () => window.open(`http://192.168.4.1/?pin=${offlinePin}`, '_blank');
        });
        
        setupModal('delete', elements.buttons.deleteBtn, ['#cancelDel'], (modalEl) => {
            modalEl.querySelector('#confirmDel').onclick = async () => {
                try {
                    await httpsCallable(functions, 'deleteAccount')();
                    showToast('Account deleted');
                    setTimeout(logout, 1000);
                } catch (e) { showToast('Error deleting account.'); }
            };
        });
        
        setupModal('token', elements.buttons.copyBtn, ['#cancelToken', '#doneToken'], (modalEl) => {
             const step1 = modalEl.querySelector('#tokenStep1'), step2 = modalEl.querySelector('#tokenStep2');
             modalEl.querySelector('#nextToken').onclick = async () => {
                const roleSel = modalEl.querySelector('input[name="uRole"]:checked').value;
                const newToken = uuidv4();
                await setDoc(doc(db, 'registerTokens', newToken), { createdAt: serverTimestamp(), used: false, role: roleSel, med: modalEl.querySelector('#medFlag').checked });
                const url = `${window.location.origin}/register.html?token=${newToken}`;
                modalEl.querySelector('#tokenLink').value = url;
                new qrious({ element: modalEl.querySelector('#qrCanvas'), value: url, size: 160 });
                step1.classList.add('hidden'); step2.classList.remove('hidden');
             };
             modalEl.querySelector('#copyTokenLink').onclick = () => navigator.clipboard.writeText(modalEl.querySelector('#tokenLink').value).then(() => showToast('Link copied'));
        });
    });
}


// --- ADMIN PAGE ---
function initAdminPage() {
    // Elements
    const elements = {
        status: { dot: $('status-dot'), text: $('status-text') },
        logoutBtn: $('logout-btn'),
        settings: {
            inactivityTimeout: $('inactivityTimeout'), saveTimeout: $('saveTimeout'),
            relayHoldTime: $('relayHoldTime'), saveRelayHold: $('saveRelayHold')
        },
        actions: { generateToken: $('generateToken'), otaFile: $('otaFile'), uploadOTA: $('uploadOTA') },
        pins: { gen: $('pinGen'), sub: $('pinSub'), adm: $('pinAdm') },
        lists: { user: $('userList'), error: $('errorList') },
        kanban: {
            newTask: $('newTask'), addTask: $('addTask'),
            todoCol: $('todoCol'), doingCol: $('doingCol'), doneCol: $('doneCol')
        }
    };
    let espIp = "";

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "index.html"; return; }
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.data()?.role !== "admin") { window.location.href = "general.html"; return; }

        // Load initial values
        getDoc(doc(db, "config", "inactivity")).then(s => s.exists() && (elements.settings.inactivityTimeout.value = s.data().timeout || 300));
        getDoc(doc(db, "config", "relayHoldTime")).then(s => s.exists() && (elements.settings.relayHoldTime.value = s.data().ms || 3000));
        
        // Listeners
        onValue(ref(rtdb, "heartbeat"), s => {
            const v = s.val();
            espIp = v?.ip || "";
            elements.status.dot.classList.toggle("bg-green-400", !!v);
            elements.status.dot.classList.toggle("bg-red-400", !v);
            elements.status.text.textContent = v ? "Device Online" : "Device Offline";
        });

        onValue(ref(rtdb, "offlinePinGeneral"), s => elements.pins.gen.textContent = s.val() || "----");
        onValue(ref(rtdb, "offlinePinSub"), s => elements.pins.sub.textContent = s.val() || "----");
        onValue(ref(rtdb, "offlinePinAdmin"), s => elements.pins.adm.textContent = s.val() || "----");
        
        // Render lists
        onSnapshot(collection(db, "users"), snap => {
            elements.lists.user.innerHTML = '';
            snap.forEach(docSnap => {
                const u = docSnap.data();
                if (u.role === "admin") return;
                const row = document.createElement("div");
                row.className = "p-3 bg-gray-900/50 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3";
                row.innerHTML = `<div class="font-medium name">${u.name} (${u.role})</div><div class="flex items-center gap-4"><select class="bg-gray-800 text-white rounded px-2 py-1"><option value="general">general</option><option value="sub">sub</option></select><label class="flex items-center gap-1 text-sm"><input type="checkbox" class="medChk">Med</label><label class="flex items-center gap-1 text-sm"><input type="checkbox" class="lockChk">Locked</label></div>`;
                
                const sel = row.querySelector("select");
                const medChk = row.querySelector(".medChk");
                const lockChk = row.querySelector(".lockChk");
                sel.value = u.role;
                medChk.checked = (u.roles || []).includes("med");
                lockChk.checked = u.locked;
                
                const updateUser = () => {
                    const newRoles = medChk.checked ? ['med'] : [];
                    updateDoc(doc(db, "users", docSnap.id), { role: sel.value, roles: newRoles, locked: lockChk.checked }).then(() => showToast(`${u.name} updated`));
                };
                sel.onchange = updateUser;
                medChk.onchange = updateUser;
                lockChk.onchange = updateUser;
                elements.lists.user.appendChild(row);
            });
        });
        
        onSnapshot(collection(db, "errors"), snap => {
            elements.lists.error.innerHTML = '';
            snap.forEach(errSnap => {
                 const e = errSnap.data();
                 const item = document.createElement("div");
                 item.className = "p-2 bg-gray-900/50 rounded-lg flex justify-between items-start";
                 item.innerHTML = `<span>${e.createdAt?.toDate().toLocaleString() || ""} - ${e.message}</span><button class="text-red-400 hover:underline ml-2">Del</button>`;
                 item.querySelector('button').onclick = () => deleteDoc(doc(db, "errors", errSnap.id));
                 elements.lists.error.prepend(item);
            });
        });

        const renderTask = tSnap => {
            const t = tSnap.data();
            const div = document.createElement('div');
            div.className = 'kanban-item p-2 bg-gray-700 rounded flex justify-between items-center';
            div.draggable = true;
            div.dataset.id = tSnap.id;
            div.innerHTML = `<span class="taskText flex-1">${t.text}</span><button class="delTask text-red-400 ml-2">✖</button>`;
            div.querySelector('.delTask').onclick = () => deleteDoc(doc(db, 'kanban', tSnap.id));
            div.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', tSnap.id));
            const colId = { todo: 'todoCol', doing: 'doingCol', done: 'doneCol' }[t.status] || 'todoCol';
            $(colId).appendChild(div);
        };
        onSnapshot(collection(db, 'kanban'), snap => {
            ['todoCol', 'doingCol', 'doneCol'].forEach(id => $(id).innerHTML = '');
            snap.forEach(renderTask);
        });

        // Event Listeners
        elements.logoutBtn.onclick = logout;
        elements.settings.saveTimeout.onclick = () => {
            const val = parseInt(elements.settings.inactivityTimeout.value);
            if (!isNaN(val)) setDoc(doc(db, "config", "inactivity"), { timeout: val }).then(() => showToast("Inactivity timeout saved."));
        };
        elements.settings.saveRelayHold.onclick = () => {
            const val = parseInt(elements.settings.relayHoldTime.value);
            if (!isNaN(val)) Promise.all([ setDoc(doc(db, "config", "relayHoldTime"), { ms: val }), set(ref(rtdb, "relayHoldTime/ms"), val) ]).then(() => showToast("Relay hold time saved."));
        };
        elements.actions.generateToken.onclick = async () => {
            const newToken = uuidv4();
            await setDoc(doc(db, "registerTokens", newToken), { createdAt: serverTimestamp(), used: false, role: 'general' });
            const url = `${window.location.origin}/register.html?token=${newToken}`;
            await navigator.clipboard.writeText(url);
            showToast("General user invite token copied!");
        };
        elements.actions.uploadOTA.onclick = async () => {
            const file = elements.actions.otaFile.files[0];
            if (!file) return showToast("Choose a .bin file");
            if (!espIp) return showToast("Device is offline, cannot update.");
            const fd = new FormData();
            fd.append("firmware", file);
            try {
                const resp = await fetch(`http://${espIp}/update`, { method: "POST", body: fd });
                showToast(await resp.text());
            } catch { showToast("OTA upload failed."); }
        };
        elements.kanban.addTask.onclick = () => {
            const text = elements.kanban.newTask.value.trim();
            if (text) addDoc(collection(db, 'kanban'), { text, status: 'todo' });
            elements.kanban.newTask.value = '';
        };
        Object.entries({todo: 'todoCol', doing: 'doingCol', done: 'doneCol'}).forEach(([status, id]) => {
            const col = $(id);
            col.addEventListener('dragover', e => e.preventDefault());
            col.addEventListener('drop', async e => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) updateDoc(doc(db, 'kanban', taskId), { status });
            });
        });
    });
}
