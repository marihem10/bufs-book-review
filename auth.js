// auth.js (수정 완료)

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 초기화
    const auth = getAuth(window.firebaseApp); 
    
    // 2. 탭 요소 선택
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');

    // 3. 탭 전환 기능
    function switchTab(targetForm) {
        formLogin.classList.add('hidden');
        formSignup.classList.add('hidden');
        tabLogin.classList.remove('active');
        tabSignup.classList.remove('active');

        targetForm.classList.remove('hidden');
        if (targetForm === formLogin) {
            tabLogin.classList.add('active');
        } else {
            tabSignup.classList.add('active');
        }
    }

    tabLogin.addEventListener('click', () => switchTab(formLogin));
    tabSignup.addEventListener('click', () => switchTab(formSignup));
    
    // 4. 로그인 로직
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.addEventListener('click', async () => {
        try {
            await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            alert('로그인에 성공했습니다!');
            window.location.href = 'index.html';
        } catch (error) {
            alert('로그인에 실패했습니다: ' + error.message);
        }
    });

    // 5. 회원가입 로직
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const submitSignupBtn = document.getElementById('signupBtn'); // ID가 'signupBtn'인 폼 제출 버튼

    submitSignupBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        const password = signupPassword.value;
        
        if (password.length < 6) {
            alert('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, signupEmail.value, password);
            
            alert('회원가입에 성공했습니다! 이제 로그인 탭에서 로그인할 수 있습니다.');
            
            switchTab(formLogin);
            
            signupEmail.value = '';
            signupPassword.value = '';
        } catch (error) {
            console.error(error);
            
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/invalid-email') {
                alert('올바른 이메일 형식이 아닙니다.');
            } else {
                alert('회원가입에 실패했습니다: ' + error.message);
            }
        }
    })
});