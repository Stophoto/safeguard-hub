// sg-firebase.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Boots Firebase for every page that needs auth or Firestore.
// Loaded as an ES module: <script type="module" src="./sg-firebase.js">...</script>
// Other files import { auth, db } from "./sg-firebase.js";
//
// The values below are PUBLIC identifiers (not secrets). Real security
// is enforced by Firestore Security Rules on the server.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyC4ScuJTuRypg9cUm5Y4hTetx_aF8KgFsE",
  authDomain:        "safeguard-hub-71292.firebaseapp.com",
  projectId:         "safeguard-hub-71292",
  storageBucket:     "safeguard-hub-71292.firebasestorage.app",
  messagingSenderId: "753559262157",
  appId:             "1:753559262157:web:2747e88a7c87050f0b6a84",
  measurementId:     "G-QE9HPQDPLV"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
