import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, serverTimestamp, addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";

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
const $ = (id) => document.getElementById(id);
const showNotif = (msg) => {
  const el = $("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove("hidden", "opacity-0");
  setTimeout(() => {
    el.classList.add("opacity-0");
    setTimeout(() => el.classList.add("hidden"), 300);
  }, 3000);
};
window.showNotif = showNotif;

let logoutTimer;
window.setupInactivity = (ms) => {
  const reset = () => {
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(() => auth.currentUser && logout(), ms);
  };
  ['mousemove','keydown','click','touchstart'].forEach(ev => document.addEventListener(ev, reset));
  reset();
};

// LOGIN
window.login = async () => {
  const btn = $("loginBtn");
  const loading = $("loading");
  btn && (btn.disabled = true);
  loading && loading.classList.remove("hidden");
  $("msg").textContent = "";
  try {
    const email = $("email").value;
    const pass = $("password").value;
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) return;
    if (snap.data().locked) {
      await signOut(auth);
      $("msg").textContent = "❌ Account locked";
      return;
    }
    const role = snap.data().role;
    if (role === "admin") location.href = "admin.html";
    else location.href = "general.html";
  } catch (err) {
    $("msg").textContent = "❌ " + err.message;
  } finally {
    btn && (btn.disabled = false);
    loading && loading.classList.add("hidden");
  }
};

// REGISTER
if (location.href.includes("register")) {
  window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (!token) {
      $("regMsg").textContent = "Missing token";
      return;
    }
    $("regBtn").onclick = async () => {
      const name = $("name").value;
      const email = $("regEmail").value;
      const pass = $("regPassword").value;
      try {
        const tokSnap = await getDoc(doc(db, "registerTokens", token));
        if (!tokSnap.exists() || tokSnap.data().used) {
          $("regMsg").textContent = "Invalid or used token";
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const data = tokSnap.data();
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          role: data.role || "general",
          roles: data.roles || []
        });
        await updateDoc(doc(db, "registerTokens", token), { used: true });
        showNotif("Registration successful");
        await signOut(auth);
        setTimeout(() => (location.href = "index.html"), 500);
      } catch (err) {
        $("regMsg").textContent = "❌ " + err.message;
      }
    };
  });
}

// GENERAL PANEL
if (location.href.includes("general")) {
  window.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = $("toggleBtn");
    const medToggle = $("medToggle");
    const inviteBtn = $("inviteBtn");
    const offlineBtn = $("offlineBtn");
    const errorBtn = $("errorBtn");
    const modal = $("errorModal");
    const offlineModal = $("offlineModal");
    const closeOffline = $("closeOffline");
    const launchOffline = $("launchOffline");
    const offlineCodeInput = $("offlineCodeInput");
    const errorText = $("errorText");
    const cancelError = $("cancelError");
    const sendError = $("sendError");
    const copyOffline = $("copyOffline");
    const inviteModal = $("inviteModal");
    const inviteStep1 = $("inviteStep1");
    const inviteStep2 = $("inviteStep2");
    const inviteRole = $("inviteRole");
    const inviteMedWrap = $("inviteMedWrap");
    const inviteMed = $("inviteMed");
    const inviteNext = $("inviteNext");
    const inviteQR = $("inviteQR");
    const copyInvite = $("copyInvite");
    const closeInvite = $("closeInvite");
    const hbStatus = $("hbStatus");
    let unlocked = false;
    let medUnlocked = false;
    let holdMs = 3000;
    let offlinePinGeneral = "";
    let offlinePinSub = "";
    let offlinePin = "";
    let offlineShown = false;

    onAuthStateChanged(auth, async (user) => {
      if (!user) return location.href = "index.html";
      const uRef = doc(db, "users", user.uid);
      const uSnap = await getDoc(uRef);
      const role = uSnap.data()?.role;
      const rolesArr = uSnap.data()?.roles || [];

      const confSnap = await getDoc(doc(db, "config", "inactivity"));
      const timeoutSec = confSnap.exists() ? confSnap.data().timeout || 300 : 300;
      setupInactivity(timeoutSec * 1000);

      const applyMedToggle = (arr) => {
        if (arr.includes("med")) {
          medToggle.classList.remove("hidden");
        } else {
          medToggle.classList.add("hidden");
        }
      };

      applyMedToggle(rolesArr);
      onSnapshot(uRef, (s) => applyMedToggle(s.data()?.roles || []));

      if (role !== "admin") {
        const hold = await getDoc(doc(db, "config", "relayHoldTime"));
        if (hold.exists()) holdMs = hold.data().ms || holdMs;
        onValue(ref(rtdb, "relayHoldTime/ms"), s => {
          const v = parseInt(s.val());
          if (!isNaN(v)) holdMs = v;
        });

        let hbLast = 0;
        onValue(ref(rtdb, "offlinePinGeneral"), s => {
          offlinePinGeneral = s.val() || "";
          if (role !== "sub") offlinePin = offlinePinGeneral;
        });
        onValue(ref(rtdb, "offlinePinSub"), s => {
          offlinePinSub = s.val() || "";
          if (role === "sub") offlinePin = offlinePinSub;
        });

        onValue(ref(rtdb, "heartbeat"), () => {
          hbLast = Date.now();
          hbStatus.textContent = "❤️";
          hbStatus.classList.remove("text-red-400");
          hbStatus.classList.add("text-green-400");
          offlineShown = false;
          offlineModal.classList.add("hidden");
        });
        setInterval(() => {
          if (Date.now() - hbLast > 15000) {
            hbStatus.textContent = "❤️";
            hbStatus.classList.remove("text-green-400");
            hbStatus.classList.add("text-red-400");
            if (!offlineShown) {
              offlineShown = true;
              offlineCodeInput.value = offlinePin;
              offlineModal.classList.remove("hidden");
            }
          }
        }, 5000);

        const stateDoc = doc(db, "config", "relaystate");
        const medStateDoc = doc(db, "config", "medRelaystate");

        const applyState = (btn, on, offLabel, onLabel) => {
          btn.textContent = on ? onLabel : offLabel;
          btn.classList.toggle("bg-green-600", on);
          btn.classList.toggle("bg-red-600", !on);
          btn.disabled = on;
        };

        onValue(ref(rtdb, "relaystate"), s => {
          unlocked = s.val() === "unlocked";
          applyState(toggleBtn, unlocked, "LOCKED", "UNLOCKED");
        });

        onValue(ref(rtdb, "medRelaystate"), s => {
          medUnlocked = s.val() === "unlocked";
          applyState(medToggle, medUnlocked, "MED LOCKED", "MED UNLOCKED");
        });

        const updateRelay = async (val) => {
          const tasks = [
            setDoc(stateDoc, { state: val }),
            set(ref(rtdb, "relaystate"), val)
          ];
          if (val === "unlocked") {
            tasks.push(set(ref(rtdb, "relayHoldTime/ms"), holdMs));
          }
          const results = await Promise.allSettled(tasks);
          return results.some(r => r.status === "fulfilled");
        };

        const updateMedRelay = async (val) => {
          const tasks = [
            setDoc(medStateDoc, { state: val }),
            set(ref(rtdb, "medRelaystate"), val)
          ];
          if (val === "unlocked") {
            tasks.push(set(ref(rtdb, "relayHoldTime/ms"), holdMs));
          }
          const results = await Promise.allSettled(tasks);
          return results.some(r => r.status === "fulfilled");
        };

        toggleBtn.addEventListener("click", async () => {
          if (unlocked) return;
          unlocked = true;
          const ok1 = await updateRelay("unlocked");
          if (!ok1) showNotif("Failed to update relay state");
          // ESP will update the locked state after the hold time
        });

        medToggle.addEventListener("click", async () => {
          if (medUnlocked) return;
          medUnlocked = true;
          const ok1 = await updateMedRelay("unlocked");
          if (!ok1) showNotif("Failed to update med state");
          // ESP will update the locked state after the hold time
        });

        if (role === "sub") {
          inviteBtn.classList.remove("hidden");
          inviteBtn.onclick = () => {
            inviteStep1.classList.remove("hidden");
            inviteStep2.classList.add("hidden");
            inviteMedWrap.classList.add("hidden");
            inviteModal.classList.remove("hidden");
          };
          inviteRole.onchange = () => {
            if (inviteRole.value === "general") inviteMedWrap.classList.remove("hidden");
            else inviteMedWrap.classList.add("hidden");
          };
          inviteNext.onclick = async () => {
            const newToken = uuidv4();
            const roles = inviteRole.value === "general" && inviteMed.checked ? ["med"] : [];
            await setDoc(doc(db, "registerTokens", newToken), {
              createdAt: serverTimestamp(),
              used: false,
              role: inviteRole.value,
              roles
            });
            const url = `${location.origin}/register.html?token=${newToken}`;
            inviteStep1.classList.add("hidden");
            inviteStep2.classList.remove("hidden");
            QRCode.toCanvas(inviteQR, url);
            copyInvite.onclick = async () => {
              await navigator.clipboard.writeText(url);
              showNotif("Link copied");
            };
          };
          closeInvite.onclick = () => inviteModal.classList.add("hidden");
        }

        offlineBtn.onclick = () => {
          if (!offlinePin) return showNotif("No PIN available yet");
          offlineCodeInput.value = offlinePin;
          offlineModal.classList.remove("hidden");
        };
        copyOffline.onclick = async () => {
          if (!offlinePin) return;
          await navigator.clipboard.writeText(offlinePin);
          showNotif("PIN copied");
        };

        closeOffline.onclick = () => {
          offlineModal.classList.add("hidden");
          offlineShown = false;
        };
        launchOffline.onclick = () => {
          const tok = offlineCodeInput.value.trim();
          if (tok) window.open(`http://192.168.4.1/unlock?pin=${encodeURIComponent(tok)}`, "_blank");
        };

        errorBtn.onclick = () => {
          modal.classList.remove("hidden");
          errorText.value = "";
        };
        cancelError.onclick = () => modal.classList.add("hidden");
        sendError.onclick = async () => {
          const msg = errorText.value.trim();
          if (!msg) return;
          await addDoc(collection(db, "errors"), {
            message: msg,
            user: user.uid,
            createdAt: serverTimestamp()
          });
          modal.classList.add("hidden");
          showNotif("Issue reported");
        };
      }
    });
  });
}

// ADMIN PANEL
if (location.href.includes("admin")) {
  window.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return location.href = "index.html";
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.data()?.role !== "admin") location.href = "general.html";

      const conf = await getDoc(doc(db, "config", "inactivity"));
      let inactivitySec = 300;
      if (conf.exists()) inactivitySec = conf.data().timeout || inactivitySec;
      $("inactivityTimeout").value = inactivitySec;
      setupInactivity(inactivitySec * 1000);

      const holdConf = await getDoc(doc(db, "config", "relayHoldTime"));
      if (holdConf.exists()) $("relayHoldTime").value = holdConf.data().ms || 3000;

      const snapUsers = await getDocs(collection(db, "users"));
      snapUsers.forEach(docSnap => {
        const u = docSnap.data();
        if (u.role === "admin") return;
        const row = document.createElement("div");
        row.className = "p-2 bg-gray-700 rounded flex justify-between items-center";
        row.innerHTML = `
          <div>${u.name} → ${u.role}</div>
          <select class="bg-gray-800 text-white rounded px-2 py-1">
            <option value="general">general</option>
            <option value="sub">sub</option>
          </select>
        `;
        const sel = row.querySelector("select");
        sel.value = u.role;
        const label = row.querySelector("div");
        sel.onchange = async () => {
          await updateDoc(doc(db, "users", docSnap.id), { role: sel.value });
          label.textContent = `${u.name} → ${sel.value}`;
          showNotif(`Role updated to ${sel.value}`);
        };
        $("userList").appendChild(row);
      });
    });

    window.saveTimeout = async () => {
      const val = parseInt($("inactivityTimeout").value);
      if (!isNaN(val)) await setDoc(doc(db, "config", "inactivity"), { timeout: val });
      showNotif("Saved inactivity timeout");
    };

    window.saveRelayHold = async () => {
      const val = parseInt($("relayHoldTime").value);
      if (isNaN(val)) return showNotif("Enter a valid number");
      try {
        await Promise.all([
          setDoc(doc(db, "config", "relayHoldTime"), { ms: val }),
          set(ref(rtdb, "relayHoldTime/ms"), val)
        ]);
        showNotif("Saved relay hold time");
      } catch {
        showNotif("Failed to save relay hold time");
      }
    };

    window.generateToken = async () => {
      const newToken = uuidv4();
      await setDoc(doc(db, "registerTokens", newToken), {
        createdAt: serverTimestamp(),
        used: false
      });
      const url = `${location.origin}/register.html?token=${newToken}`;
      await navigator.clipboard.writeText(url);
      showNotif("Token copied:\n" + url);
    };
  });
}

window.logout = async () => {
  await signOut(auth);
  location.href = "index.html";
};

window.deleteAccount = () => {
  showNotif("Account deletion coming soon");
};
