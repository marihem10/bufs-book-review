// firebase-init.js (새 파일)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js"; 
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; 

// 여러분의 Firebase 설정 정보
const firebaseConfig = {
            apiKey: "AIzaSyB3Aw-AhHXWbqfY_u0Sklf0fO0_VLBD_s0",
            authDomain: "authentication-c2cb0.firebaseapp.com",
            projectId: "authentication-c2cb0",
            storageBucket: "authentication-c2cb0.firebasestorage.app",
            messagingSenderId: "253032870308",
            appId: "1:253032870308:web:9629c3430156b6ddaf9131",
            measurementId: "G-G0T7ZML631"
            };

// 앱 인스턴스 초기화
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app); 
export const db = getFirestore(app);

// 모든 페이지에서 사용할 전역 인스턴스를 노출합니다.
//window.firebaseApp = app; 
//window.auth = getAuth(app); 
//window.db = getFirestore(app);