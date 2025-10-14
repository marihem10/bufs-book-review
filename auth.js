// auth.js

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
        // 모든 폼과 버튼에서 'active' 클래스를 제거하고 'hidden' 클래스를 추가/제거합니다.
        formLogin.classList.add('hidden');
        formSignup.classList.add('hidden');
        tabLogin.classList.remove('active');
        tabSignup.classList.remove('active');

        // 선택된 폼과 버튼에 'active' 클래스를 추가하고 'hidden' 클래스를 제거합니다.
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
        // ... (이전에 드린 로그인 로직을 여기에 넣습니다.) ...
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
    const signupBtn = document.getElementById('signupBtn');

    const submitSignupBtn = document.getElementById('signupBtn'); // ID가 'signupBtn'인 폼 제출 버튼
    submitSignupBtn.addEventListener('click', async (e) => {
        // [핵심 수정]: 폼 제출 버튼의 기본 동작(페이지 새로고침)을 막습니다.
        e.preventDefault(); 
        
        // 현재 활성화된 폼의 비밀번호 입력창 값을 사용해야 합니다.
        // 여기서는 signupPassword.value를 사용합니다.
    const password = signupPassword.value;
        
        if (password.length < 6) {
            alert('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }

        try {
            // Firebase에 새 계정 생성 요청
            await createUserWithEmailAndPassword(auth, signupEmail.value, password);
            
            alert('회원가입에 성공했습니다! 이제 로그인 탭에서 로그인할 수 있습니다.');
            
            // 성공 후 로그인 탭으로 자동 전환
            switchTab(formLogin);
            
            // 입력 필드 비우기
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