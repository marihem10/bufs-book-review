import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const auth = getAuth(window.firebaseApp); 
    
    // ----------------------------------------------------
    // 로딩 버튼 헬퍼 함수
    // ----------------------------------------------------
    
    // 버튼을 로딩 상태로 변경하는 함수
    function showButtonLoading(button, text = '로딩중...') {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML; // 원래 내용 저장
        button.innerHTML = `<span class="button-loader"></span> ${text}`;
    }

    // 버튼을 원래 상태로 되돌리는 함수
    function hideButtonLoading(button) {
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml; // 원래 내용 복원
        }
        button.disabled = false;
    }
    
    // ----------------------------------------------------
    // 기존 탭 기능
    // ----------------------------------------------------
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');

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
    
    // ----------------------------------------------------
    // 로그인 로직 (로딩 적용)
    // ----------------------------------------------------
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.addEventListener('click', async () => {
        showButtonLoading(loginBtn, '로그인중...'); // [로딩 시작]
        try {
            await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            alert('로그인에 성공했습니다!');
            window.location.href = 'index.html';
        } catch (error) {
            alert('로그인에 실패했습니다: ' + error.message);
            hideButtonLoading(loginBtn); // [로딩 종료 - 실패 시]
        }
    });

    // ----------------------------------------------------
    // 회원가입 로직 (로딩 적용)
    // ----------------------------------------------------
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupBtn = document.getElementById('signupBtn');

    signupBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        const password = signupPassword.value;
        if (password.length < 6) {
            alert('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }

        showButtonLoading(signupBtn, '생성중...'); // [로딩 시작]

        try {
            await createUserWithEmailAndPassword(auth, signupEmail.value, password);
            alert('회원가입에 성공했습니다! 이제 로그인 탭에서 로그인할 수 있습니다.');
            
            switchTab(formLogin);
            
            signupEmail.value = '';
            signupPassword.value = '';
            hideButtonLoading(signupBtn); // [로딩 종료 - 성공 시]
        } catch (error) {
            console.error(error);
            
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/invalid-email') {
                alert('올바른 이메일 형식이 아닙니다.');
            } else {
                alert('회원가입에 실패했습니다: ' + error.message);
            }
            hideButtonLoading(signupBtn); // [로딩 종료 - 실패 시]
        }
    });

    // ----------------------------------------------------
    // 비밀번호 찾기 로직
    // ----------------------------------------------------
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault(); // 링크 클릭 시 페이지 새로고침 방지
        
        const email = loginEmail.value; // 로그인 폼의 이메일 입력창 값
        
        if (!email) {
            alert('비밀번호를 재설정할 이메일 주소를 입력해주세요. (로그인 폼의 아이디 창)');
            loginEmail.focus();
            return;
        }

        if (!confirm(`'${email}' 주소로 비밀번호 재설정 메일을 발송하시겠습니까?`)) {
            return;
        }
        
        // (임시 로딩) 링크 텍스트 변경
        forgotPasswordLink.textContent = '메일 발송 중...';
        
        try {
            await sendPasswordResetEmail(auth, email);
            alert('비밀번호 재설정 이메일을 발송했습니다. 이메일함을 확인해주세요.');
            forgotPasswordLink.textContent = '비밀번호를 잊으셨나요?'; // 텍스트 복원
        } catch (error) {
            console.error("비밀번호 재설정 이메일 발송 실패:", error);
            alert('오류가 발생했습니다: ' + error.message);
            forgotPasswordLink.textContent = '비밀번호를 잊으셨나요?'; // 텍스트 복원
        }
    });
});