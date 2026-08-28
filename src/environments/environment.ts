// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  production: false,
  firebase: {
    apiKey: "AIzaSyCPwhp6m8CTXWDVbXWR20XWszf6Oz7MjBU",
    authDomain: "condominiomoradas-42a17.firebaseapp.com",
    projectId: "condominiomoradas-42a17",
    storageBucket: "condominiomoradas-42a17.firebasestorage.app",
    messagingSenderId: "116045904915",
    appId: "1:116045904915:web:c3e486bd5652d4010753e6"
  }
};

// Initialize Firebase
const app = initializeApp(firebaseConfig.firebase);