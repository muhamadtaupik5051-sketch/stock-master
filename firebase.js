import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBO8p5y2uPqiA6T6KbIce7ja2XifYp7zW8",
  authDomain: "stock-master-27392.firebaseapp.com",
  projectId: "stock-master-27392",
  storageBucket: "stock-master-27392.firebasestorage.app",
  messagingSenderId: "806200771118",
  appId: "1:806200771118:web:7fd3de03471889e17a15bf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Data disimpan di HP (IndexedDB) agar aplikasi tetap bisa dipakai tanpa sinyal.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
export const ready = signInAnonymously(auth).catch(() => null);
