import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
const $ = (id) => document.getElementById(id);

// Entry: Login Page
if (location.pathname.includes("index.html")) {
  window.login = async () => {
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
    }
  };
}

// General Panel Logic
if (location.pathname.includes("general.html")) {
  const toggleBtn = $("toggleBtn");
  let unlocked = false;
  let holdMs = 3000;

  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";
    const snap = await getDoc(doc(db, "users", user.uid));
    const role = snap.data()?.role;
    if (role !== "admin") {
      const conf = await getDoc(doc(db, "config", "inactivity"));
      if (conf.exists()) holdMs = conf.data().timeout || holdMs;

      toggleBtn.onclick = () => {
        if (unlocked) return;
        unlocked = true;
        toggleBtn.textContent = "UNLOCKED";
        toggleBtn.classList.replace("bg-red-600", "bg-green-600");
        toggleBtn.disabled = true;
        setTimeout(() => {
          unlocked = false;
          toggleBtn.textContent = "LOCKED";
          toggleBtn.classList.replace("bg-green-600", "bg-red-600");
          toggleBtn.disabled = false;
        }, holdMs);
      };

      if (role === "sub") {
        $("copyBtn").classList.remove("hidden");
        $("copyBtn").onclick = async () => {
          const newToken = uuidv4();
          await setDoc(doc(db, "registerTokens", newToken), {
            createdAt: serverTimestamp(), used: false
          });
          const url = `${location.origin}/index.html?token=${newToken}`;
          await navigator.clipboard.writeText(url);
          alert("Token copied:\n" + url);
        };
      }
    }
  });
}

// Admin Panel Logic
if (location.pathname.includes("admin.html")) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.data()?.role !== "admin") location.href = "general.html";

    const conf = await getDoc(doc(db, "config", "inactivity"));
    if (conf.exists()) $("inactivityTimeout").value = conf.data().timeout || 3000;

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
      sel.onchange = async () => {
        await updateDoc(doc(db, "users", docSnap.id), { role: sel.value });
        location.reload();
      };
      $("userList").appendChild(row);
    });
  });

  window.saveTimeout = async () => {
    const val = parseInt($("inactivityTimeout").value);
    if (!isNaN(val)) await setDoc(doc(db, "config", "inactivity"), { timeout: val });
  };

  window.generateToken = async () => {
    const newToken = uuidv4();
    await setDoc(doc(db, "registerTokens", newToken), {
      createdAt: serverTimestamp(), used: false
    });
    const url = `${location.origin}/index.html?token=${newToken}`;
    await navigator.clipboard.writeText(url);
    alert("Token copied:\n" + url);
  };
}

// Shared logout
window.logout = async () => {
  await signOut(auth);
  location.href = "index.html";
};
