// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: "mind-weaver-97jrm",
  appId: "1:383664433779:web:43448b5e543d746a145806",
  storageBucket: "mind-weaver-97jrm.firebasestorage.app",
  apiKey: "AIzaSyC5IzFghlzNCJrrLBp5o7cpWBCaElwtzTI",
  authDomain: "mind-weaver-97jrm.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "383664433779"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
export const storage: FirebaseStorage = getStorage(app);
