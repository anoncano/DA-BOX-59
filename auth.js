import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";

const firebaseConfig = {
  apiKey: "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o",
  authDomain: "da-box-59.firebaseapp.com",
  projectId: "da-box-59",
  storageBucket: "da-box-59.firebasestorage.app",
  messagingSenderId: "382682873063",
  appId: "1:382682873063:web:e240e1bf8e14527b277642",
  databaseURL: "https://da-box-59-default-rtdb.asia-southeast1.firebasedatabase.app" // ✅ FIXED
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
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          role: "general",
          firstLogin: true
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
    const toggleBtn2 = $("toggleBtn2");
    const copyBtn = $("copyBtn");
    const offlineBtn = $("offlineBtn");
    const errorBtn = $("errorBtn");
    const modal = $("errorModal");
    const errorText = $("errorText");
    const cancelError = $("cancelError");
    const sendError = $("sendError");
    let unlocked = false;
    let unlocked2 = false;
    let holdMs = 3000;

    const showOffline = (code) => {
      $("offlineCode").textContent = code;
      $("offlineModal").classList.remove("hidden");
      $("copyOffline").onclick = () => {
        navigator.clipboard.writeText(code);
        showNotif("PIN copied");
      };
      $("closeOffline").onclick = () => $("offlineModal").classList.add("hidden");
    };

    if (!navigator.onLine) {
      const pin = localStorage.getItem("offlinePin");
      if (pin) showOffline(pin);
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) return location.href = "index.html";
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};
      const role = data.role;

      if (data.firstLogin) {
        $("firstLoginModal").classList.remove("hidden");
        $("closeFirst").onclick = async () => {
          $("firstLoginModal").classList.add("hidden");
          await updateDoc(doc(db, "users", user.uid), { firstLogin: false });
        };
      }

      if (role !== "admin") {
        const hold = await getDoc(doc(db, "config", "relayHoldTime"));
        if (hold.exists()) holdMs = hold.data().ms || holdMs;

        const stateDoc = doc(db, "config", "relaystate");
        const stateDoc2 = doc(db, "config", "relaystate2");

        const updateRelay = async (val) => {
          try {
            await Promise.all([
              setDoc(stateDoc, { state: val }),
              set(ref(rtdb, "relaystate"), val)
            ]);
            return true;
          } catch {
            return false;
          }
        };

        const updateRelay2 = async (val) => {
          try {
            await Promise.all([
              setDoc(stateDoc2, { state: val }),
              set(ref(rtdb, "relaystate2"), val)
            ]);
            return true;
          } catch {
            return false;
          }
        };

        toggleBtn.addEventListener("click", async () => {
          if (unlocked) return;
          unlocked = true;
          toggleBtn.textContent = "UNLOCKED";
          toggleBtn.classList.remove("bg-red-600");
          toggleBtn.classList.add("bg-green-600");
          toggleBtn.disabled = true;
          const ok1 = await updateRelay("unlocked");
          if (!ok1) {
            showNotif("Failed to update relay state");
          }
          setTimeout(async () => {
            unlocked = false;
            toggleBtn.textContent = "LOCKED";
            toggleBtn.classList.remove("bg-green-600");
            toggleBtn.classList.add("bg-red-600");
            toggleBtn.disabled = false;
            const ok2 = await updateRelay("locked");
            if (!ok2) {
              showNotif("Failed to update relay state");
            }
          }, holdMs);
        });

        if (toggleBtn2) {
          toggleBtn2.classList.remove("hidden");
          toggleBtn2.addEventListener("click", async () => {
            if (unlocked2) return;
            unlocked2 = true;
            toggleBtn2.textContent = "UNLOCKED";
            toggleBtn2.classList.remove("bg-red-600");
            toggleBtn2.classList.add("bg-green-600");
            toggleBtn2.disabled = true;
            const ok1 = await updateRelay2("unlocked");
            if (!ok1) showNotif("Failed to update second relay");
            setTimeout(async () => {
              unlocked2 = false;
              toggleBtn2.textContent = "LOCKED";
              toggleBtn2.classList.remove("bg-green-600");
              toggleBtn2.classList.add("bg-red-600");
              toggleBtn2.disabled = false;
              const ok2 = await updateRelay2("locked");
              if (!ok2) showNotif("Failed to update second relay");
            }, holdMs);
          });
        }

        if (role === "sub") {
          copyBtn.classList.remove("hidden");
          const tModal = $("tokenModal");
          copyBtn.onclick = async () => {
            const newToken = uuidv4();
            await setDoc(doc(db, "registerTokens", newToken), {
              createdAt: serverTimestamp(),
              used: false
            });
            const url = `${location.origin}/register.html?token=${newToken}`;
            $("tokenQr").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            $("tokenLink").value = url;
            tModal.classList.remove("hidden");
            $("copyToken").onclick = () => {
              navigator.clipboard.writeText(url);
              showNotif("Link copied");
            };
            $("closeToken").onclick = () => tModal.classList.add("hidden");
          };
        }

        offlineBtn.onclick = async () => {
          let code = localStorage.getItem("offlinePin");
          if (!code) {
            code = uuidv4();
            localStorage.setItem("offlinePin", code);
            if (role === "admin") {
              await setDoc(doc(db, "config", "offlinePin"), { pin: code });
            }
          }
          showOffline(code);
          navigator.clipboard.writeText(code);
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
      if (!isNaN(val)) await setDoc(doc(db, "config", "relayHoldTime"), { ms: val });
      showNotif("Saved relay hold time");
    };

    window.generateToken = async () => {
      const newToken = uuidv4();
      await setDoc(doc(db, "registerTokens", newToken), {
        createdAt: serverTimestamp(),
        used: false
      });
      const url = `${location.origin}/register.html?token=${newToken}`;
      $("adminTokenQr").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
      $("adminTokenLink").value = url;
      const modal = document.getElementById("tokenModal");
      modal.classList.remove("hidden");
      $("copyAdminToken").onclick = () => {
        navigator.clipboard.writeText(url);
        showNotif("Link copied");
      };
      $("closeAdminToken").onclick = () => modal.classList.add("hidden");
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
