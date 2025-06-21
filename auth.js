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
      $("msg").textContent = "Account locked";
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

window.resetPassword = async () => {
  const email = $("email").value;
  if (!email) return showNotif("Enter email");
  try {
    await sendPasswordResetEmail(auth, email);
    showNotif("Reset email sent");
    const m = $("resetModal");
    if (m) {
      m.classList.remove("hidden");
      const c = $("resetClose");
      if (c) c.onclick = () => m.classList.add("hidden");
    }
  } catch (err) {
    showNotif("Error: " + err.message);
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
        const role = data.role || "general";
        const roles = [];
        if (role === "general" && data.med) roles.push("med");
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          role,
          roles,
          locked: false
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
    const copyBtn = $("copyBtn");
    const offlineBtn = $("offlineBtn");
    const errorBtn = $("errorBtn");
    const deleteModal = $("deleteModal");
    const cancelDel = $("cancelDel");
    const confirmDel = $("confirmDel");
    const modal = $("errorModal");
    const offlineModal = $("offlineModal");
    const closeOffline = $("closeOffline");
    const launchOffline = $("launchOffline");
    const offlineCodeInput = $("offlineCodeInput");
    const copyOffline = $("copyOffline");
    const tokenModal = $("tokenModal");
    const tokenStep1 = $("tokenStep1");
    const tokenStep2 = $("tokenStep2");
    const cancelToken = $("cancelToken");
    const nextToken = $("nextToken");
    const doneToken = $("doneToken");
    const copyTokenLink = $("copyTokenLink");
    const tokenLink = $("tokenLink");
    const qrImg = $("qrImg");
    const medFlag = $("medFlag");
    const medWrap = $("medWrap");
    const roleRads = document.querySelectorAll('.roleRad');
    const updateMedVisibility = () => {
      const sel = Array.from(roleRads).find(r => r.checked)?.value || 'general';
      if (sel === 'sub') medWrap.classList.add('hidden');
      else medWrap.classList.remove('hidden');
    };
    roleRads.forEach(r => r.addEventListener('change', updateMedVisibility));
    const errorText = $("errorText");
    const cancelError = $("cancelError");
    const sendError = $("sendError");
    const hbStatus = $("hbStatus");
    const hbLine = $("hbLine");
    let unlocked = false;
    let medUnlocked = false;
    let holdMs = 3000;
    let offlinePinGeneral = "";
    let offlinePinSub = "";
    let offlinePin = "";
    let offlineShown = false;
    let inactivitySec = 0;
    let inactTimer;
    const resetInact = () => {
      clearTimeout(inactTimer);
      if (inactivitySec > 0) inactTimer = setTimeout(() => logout(), inactivitySec * 1000);
    };
    ["click","keydown","mousemove","touchstart"].forEach(e => document.addEventListener(e, resetInact));

    onAuthStateChanged(auth, async (user) => {
      if (!user) return location.href = "index.html";
      const uRef = doc(db, "users", user.uid);
      const uSnap = await getDoc(uRef);
      const role = uSnap.data()?.role;
      const rolesArr = uSnap.data()?.roles || [];

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

        const conf = await getDoc(doc(db, "config", "inactivity"));
        if (conf.exists()) inactivitySec = conf.data().timeout || 0;
        resetInact();

        onValue(ref(rtdb, "heartbeat"), () => {
          hbLast = Date.now();
          hbStatus.textContent = "❤️";
          hbStatus.classList.remove("text-red-400");
          hbStatus.classList.add("text-green-400");
          hbLine.classList.remove("bg-red-400");
          hbLine.classList.add("bg-green-400", "animate-pulse");
          setTimeout(() => hbLine.classList.remove("animate-pulse"), 300);
          offlineShown = false;
        });
        setInterval(() => {
          if (Date.now() - hbLast > 15000) {
            hbStatus.textContent = "❤️";
            hbStatus.classList.remove("text-green-400");
            hbStatus.classList.add("text-red-400");
            hbLine.classList.remove("bg-green-400", "animate-pulse");
            hbLine.classList.add("bg-red-400");
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
          copyBtn.classList.remove("hidden");
          copyBtn.onclick = () => {
            tokenModal.classList.remove("hidden");
            tokenStep1.classList.remove("hidden");
            tokenStep2.classList.add("hidden");
            medFlag.checked = false;
            updateMedVisibility();
          };
          cancelToken.onclick = () => tokenModal.classList.add("hidden");
          nextToken.onclick = async () => {
            const roleSel = Array.from(roleRads).find(r => r.checked).value;
            const newToken = uuidv4();
            await setDoc(doc(db, 'registerTokens', newToken), {
              createdAt: serverTimestamp(),
              used: false,
              role: roleSel,
              med: medFlag.checked
            });
            const url = `${location.origin}/register.html?token=${newToken}`;
            tokenLink.value = url;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            tokenStep1.classList.add('hidden');
            tokenStep2.classList.remove('hidden');
          };
          copyTokenLink.onclick = async () => {
            await navigator.clipboard.writeText(tokenLink.value);
            showNotif('Link copied');
          };
          doneToken.onclick = () => tokenModal.classList.add('hidden');
        }

        offlineBtn.onclick = () => {
          if (!offlinePin) return showNotif("No PIN available yet");
          offlineCodeInput.value = offlinePin;
          offlineModal.classList.remove("hidden");
          resetInact();
        };

        copyOffline.onclick = async () => {
          if (!offlinePin) return;
          const link = `http://192.168.4.1/?pin=${encodeURIComponent(offlinePin)}`;
          await navigator.clipboard.writeText(`${offlinePin} ${link}`);
          showNotif("Info copied");
        };

        closeOffline.onclick = () => {
          offlineModal.classList.add("hidden");
          offlineShown = false;
          resetInact();
        };
        offlineModal.addEventListener("click", e => {
          if (e.target === offlineModal) {
            offlineModal.classList.add("hidden");
            offlineShown = false;
            resetInact();
          }
        });
        launchOffline.onclick = () => {
          const tok = offlineCodeInput.value.trim();
          if (tok) window.open(`http://192.168.4.1/?pin=${encodeURIComponent(tok)}`, "_blank");
          resetInact();
        };

        errorBtn.onclick = () => {
          modal.classList.remove("hidden");
          errorText.value = "";
        };
        cancelError.onclick = () => modal.classList.add("hidden");
        sendError.onclick = async () => {
          const msg = errorText.value.trim();
          const ack = document.getElementById("errorAck").checked;
          if (!msg || !ack) return;
          await addDoc(collection(db, "errors"), {
            message: msg,
            user: user.uid,
            createdAt: serverTimestamp()
          });
          modal.classList.add("hidden");
          showNotif("Issue reported");
        };

        cancelDel.onclick = () => deleteModal.classList.add("hidden");
        confirmDel.onclick = async () => {
          confirmDel.disabled = true;
          try {
            await httpsCallable(functions, 'deleteAccount')();
          } catch (e) {
            try {
              if (auth.currentUser) {
                await deleteUser(auth.currentUser);
                await deleteDoc(doc(db, 'users', auth.currentUser.uid));
              }
            } catch (err) {
              showNotif('Error: ' + err.message);
              confirmDel.disabled = false;
              return;
            }
          }
          showNotif('Account deleted');
          setTimeout(() => location.href = 'index.html', 500);
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
      if (conf.exists()) $("inactivityTimeout").value = conf.data().timeout || 3000;

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
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('hidden');
};
