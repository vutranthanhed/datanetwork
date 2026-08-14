// Firebase Configuration
// Replace these values with YOUR Firebase project credentials

const firebaseConfig = {
  apiKey: "AIzaSyAfIHDtgTcxlIZkyApI0UMF8HFmoVeqhRs",
  authDomain: "datasupportnetwork.firebaseapp.com",
  projectId: "datasupportnetwork",
  storageBucket: "datasupportnetwork.firebasestorage.app",
  messagingSenderId: "623896442039",
  appId: "1:623896442039:web:444cb46ada20a81e304932"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

console.log("Firebase initialized successfully!");