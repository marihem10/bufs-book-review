// index-auth.js (로그인 상태 전용)

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// index.html에서 SDK 초기화 후 window.auth에 저장한 인스턴스를 사용합니다.
const auth = window.auth; 

if (auth) {
    const loginLink = document.querySelector('.nav-bar .nav-item');
    
    // 인증 상태 감지 리스너
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 사용자 로그인 상태: LOGOUT 버튼 표시
            loginLink.textContent = 'LOGOUT';
            loginLink.href = '#'; 
            
            // 기존 이벤트 리스너 제거 후 로그아웃 이벤트 추가
            loginLink.replaceWith(loginLink.cloneNode(true));
            const newLogoutLink = document.querySelector('.nav-bar .nav-item');
            
            newLogoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                    alert('로그아웃되었습니다.');
                    window.location.href = 'index.html'; 
                } catch (error) {
                    console.error("로그아웃 실패:", error);
                }
            });
            
        } else {
            // 사용자 로그아웃 상태: LOGIN 버튼 표시
            loginLink.textContent = 'LOGIN';
            loginLink.href = 'auth.html'; // auth.html로 이동하도록 링크 설정
        }
    });
} else {
    // console.error("Firebase Auth 인스턴스를 찾을 수 없습니다.");
}