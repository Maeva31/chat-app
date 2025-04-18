import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2pK1gUtspXbG4wDy6SdJmnivCco-t_zc",
  authDomain: "chatapp-7ee15.firebaseapp.com",
  projectId: "chatapp-7ee15",
  storageBucket: "chatapp-7ee15.appspot.com",
  messagingSenderId: "995598698289",
  appId: "1:995598698289:web:580aaace2fa2b7beb89210"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
