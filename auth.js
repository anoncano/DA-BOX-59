import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";

const firebaseConfig = {
  apiKey: "AIzaSyDF_BGAKz4NbsZPZmAcJofaYsccxtIIQ_o",
  authDomain: "da-box-59.firebaseapp.com",
  projectId: "da-box-59",
  storageBucket: "da-box-59.firebasestorage.app",
  messagingSenderId: "382682873063",
  appId: "1:382682873063:web:e240e1bf8e14527b277642"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
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
          role: "general"
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
    const copyBtn = $("copyBtn");
    let unlocked = false;
    let holdMs = 3000;

    onAuthStateChanged(auth, async (user) => {
      if (!user) return location.href = "index.html";
      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.data()?.role;

      if (role !== "admin") {
        const hold = await getDoc(doc(db, "config", "relayHoldTime"));
        if (hold.exists()) holdMs = hold.data().ms || holdMs;

        toggleBtn.onclick = () => {
          if (unlocked) return;
          unlocked = true;
          toggleBtn.textContent = "UNLOCKED";
          toggleBtn.classList.remove("bg-red-600");
          toggleBtn.classList.add("bg-green-600");
          toggleBtn.disabled = true;
          setTimeout(() => {
            unlocked = false;
            toggleBtn.textContent = "LOCKED";
            toggleBtn.classList.remove("bg-green-600");
            toggleBtn.classList.add("bg-red-600");
            toggleBtn.disabled = false;
          }, holdMs);
        };

        if (role === "sub") {
          copyBtn.classList.remove("hidden");
          copyBtn.onclick = async () => {
            const newToken = uuidv4();
            await setDoc(doc(db, "registerTokens", newToken), {
              createdAt: serverTimestamp(),
              used: false
            });
            const url = `${location.origin}/register.html?token=${newToken}`;
            await navigator.clipboard.writeText(url);
            showNotif("Token copied:\n" + url);
          };
        }
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
  showNotif("Account deletion not implemented yet");
};
