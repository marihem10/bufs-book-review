// login.js

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// DOMContentLoaded 외부에 auth 변수를 선언합니다.
let auth;

document.addEventListener('DOMContentLoaded', () => {
    // 1. login.html에서 저장한 전역 변수(window.firebaseApp)를 사용합니다.
    const firebaseApp = window.firebaseApp; 
    
    // 2. Auth 인스턴스를 초기화할 때 app 인스턴스를 넣어줍니다.
    auth = getAuth(firebaseApp); 
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');

    // 3. 회원가입 버튼 클릭 이벤트
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

    // 4. 로그인 버튼 클릭 이벤트
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