// login.js

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    // Firebase Auth 인스턴스 가져오기
    const auth = getAuth();

    // 로그인 버튼 클릭 이벤트
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert('로그인에 성공했습니다!');
            window.location.href = 'index.html'; // 로그인 후 메인 페이지로 이동
        } catch (error) {
            console.error(error);
            alert('로그인에 실패했습니다: ' + error.message);
        }
    });

    // 회원가입 버튼 클릭 이벤트
    signupBtn.addEventListener('click', async (e) => {
        // e.preventDefault(); // 이 코드가 링크 이동을 막는 역할을 합니다.

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            alert('회원가입에 성공했습니다! 이제 로그인할 수 있습니다.');
            // 회원가입 후 입력창을 비워줍니다.
            emailInput.value = '';
            passwordInput.value = '';
        } catch (error) {
            console.error(error);
            // 에러 메시지가 'auth/email-already-in-use'일 경우 사용자에게 알림
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/weak-password') {
                alert('비밀번호는 6자리 이상이어야 합니다.');
            } else {
                 alert('회원가입에 실패했습니다: ' + error.message);
            }
        }
    });
})
