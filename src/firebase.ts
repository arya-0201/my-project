// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNLuazytO2jgLc6gKUKE0oORNeL6OHKd0",
  authDomain: "my-fridge-app-ebbb0.firebaseapp.com",
  projectId: "my-fridge-app-ebbb0",
  storageBucket: "my-fridge-app-ebbb0.firebasestorage.app",
  messagingSenderId: "1019279680674",
  appId: "1:1019279680674:web:0aa2279c22dbba807163fb",
  measurementId: "G-H2E3BC4D6H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);