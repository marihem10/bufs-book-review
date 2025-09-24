// login.js

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// login.html에서 앱 초기화가 완료될 때까지 기다렸다가 실행합니다.
// 전역 변수 window.firebaseApp을 사용하기 때문에 별도의 로직이 필요합니다.
function initializeAuth() {
    // window.firebaseApp이 존재할 때만 getAuth를 호출
    if (window.firebaseApp) {
        return getAuth(window.firebaseApp);
    }
    // 존재하지 않으면 100ms 후 다시 시도 (실행 순서 보장)
    return new Promise(resolve => setTimeout(() => resolve(initializeAuth()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
    // Auth 인스턴스를 안정적으로 초기화
    const auth = await initializeAuth(); 
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    // 1. 회원가입 버튼 클릭 이벤트
    signupBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        const email = emailInput.value;
        const password = passwordInput.value;
        
        if (password.length < 6) {
            alert('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            alert('회원가입에 성공했습니다! 이제 로그인할 수 있습니다.');
            emailInput.value = '';
            passwordInput.value = '';
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else {
                 alert('회원가입에 실패했습니다: ' + error.message);
            }
        }
    });

    // 2. 로그인 버튼 클릭 이벤트
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert('로그인에 성공했습니다!');
            window.location.href = 'index.html';
        } catch (error) {
            alert('로그인에 실패했습니다: ' + error.message);
        }
    });
});