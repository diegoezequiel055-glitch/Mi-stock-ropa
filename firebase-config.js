// Configuración de Firebase y re-export de las funciones de Firestore
// que usan los demás módulos, para que todos importen desde un solo lugar.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:"AIzaSyBdw_kkoaFUKGl2HX4FfUEV-I-0SR0n1go",
  authDomain:"mi-stock-ropa.firebaseapp.com",
  projectId:"mi-stock-ropa",
  storageBucket:"mi-stock-ropa.firebasestorage.app",
  messagingSenderId:"517134595094",
  appId:"1:517134595094:web:f3ce949a1ef8d09d5db137"
});

export const auth = getAuth(app);
export const db   = getFirestore(app);

export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit
};
