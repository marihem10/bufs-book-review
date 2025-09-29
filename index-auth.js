// index-auth.js (최종 안정화 버전 3)

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const auth = window.auth; 

    if (!auth) {
        return; 
    }
    
    // [핵심 수정]: 1초(1000ms) 지연 후 로그인 상태 확인 로직 실행
    // DOM 로딩을 확실히 기다리고, 새로운 클래스 이름으로 찾습니다.
    setTimeout(() => {
        
        // 인증 상태 감지 리스너
        onAuthStateChanged(auth, (user) => {
            // [핵심 변경] 새로운 클래스 이름으로 버튼 요소를 찾습니다.
            const loginLink = document.querySelector('.nav-bar .main-nav-item');
            
            if (!loginLink) return; 
            
            // 1. 기존 요소를 복제하여 이벤트 충돌을 방지하고 새 요소를 만듭니다.
            const oldLink = loginLink;
            const newLink = oldLink.cloneNode(true);
            oldLink.parentNode.replaceChild(newLink, oldLink); // 기존 요소 대체
            
            if (user) {
                // 2. 사용자 로그인 상태: LOGOUT 버튼 표시
                newLink.textContent = 'LOGOUT';
                newLink.href = '#'; 
                
                // 새 요소에 로그아웃 이벤트 추가
                newLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        await signOut(auth);
                        alert('로그아웃되었습니다.');
                        // 로그아웃 후 메인 페이지로 이동
                        window.location.href = 'index.html'; 
                    } catch (error) {
                        console.error("로그아웃 실패:", error);
                    }
                });
                
            } else {
                // 3. 사용자 로그아웃 상태: LOGIN 버튼 표시
                newLink.textContent = 'LOGIN';
                newLink.href = 'auth.html'; // 로그인 페이지로 이동
            }
        });
    }, 1000); // 1초 지연
});