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
        e.preventDefault(); // 페이지 이동 방지
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            alert('회원가입에 성공했습니다! 로그인해주세요.');
            // 회원가입 후 로그인 페이지에 그대로 남음
        } catch (error) {
            console.error(error);
            alert('회원가입에 실패했습니다: ' + error.message);
        }
    });
});

