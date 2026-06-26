import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApr5HyNoE780JF6kaa67EBRgz-LqKAAms",
  authDomain: "example-project.firebaseapp.com",
  projectId: "example-project",
  storageBucket: "example-project.firebasestorage.app",
  messagingSenderId: "792960941695",
  appId: "1:792960941695:web:91ae492c38797617bd494a",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
