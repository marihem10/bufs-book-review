import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    sendEmailVerification,  // 이메일 인증
    signOut                 // 로그아웃 (인증 실패 시)
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const auth = getAuth(window.firebaseApp); 
    
    // ----------------------------------------------------
    // 로딩 버튼 헬퍼 함수
    // ----------------------------------------------------
    function showButtonLoading(button, text = '로딩중...') {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML; 
        button.innerHTML = `<span class="button-loader"></span> ${text}`;
    }
    function hideButtonLoading(button) {
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml; 
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
    // 로그인 로직 (이메일 인증 확인)
    // ----------------------------------------------------
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.addEventListener('click', async () => {
        showButtonLoading(loginBtn, '로그인중...'); 
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            const user = userCredential.user;

            // 사용자가 이메일 인증을 완료했는지 확인
            if (user.emailVerified) {
                // 인증 완료: 로그인 성공
                alert('로그인에 성공했습니다!');
                window.location.href = 'index.html';
            } else {
                // 인증 미완료: 로그인 차단 및 메일 재전송
                if (confirm('이메일 인증이 완료되지 않았습니다. 인증 메일을 다시 받으시겠습니까? (스팸함도 확인해보세요)')) {
                    await sendEmailVerification(user);
                    alert('인증 메일을 다시 발송했습니다. 이메일함을 확인해주세요.');
                }
                // 인증되지 않은 사용자는 즉시 로그아웃 처리
                await signOut(auth); 
                hideButtonLoading(loginBtn); 
            }

        } catch (error) {
            alert('로그인에 실패했습니다: ' + error.message);
            hideButtonLoading(loginBtn); 
        }
    });

    // ----------------------------------------------------
    // [수정] 회원가입 로직 (인증 메일 발송)
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

        showButtonLoading(signupBtn, '생성중...'); 

        try {
            // 1. 계정 생성
            const userCredential = await createUserWithEmailAndPassword(auth, signupEmail.value, password);
            
            // 2. [핵심] 인증 메일 발송
            // (이 부분이 sendPasswordResetEmail로 잘못되어 있었을 수 있습니다)
            await sendEmailVerification(userCredential.user);

            alert('회원가입에 성공했습니다! 이메일함을 확인하여 인증을 완료해주세요.');
            
            switchTab(formLogin);
            signupEmail.value = '';
            signupPassword.value = '';
            hideButtonLoading(signupBtn); 

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/invalid-email') {
                alert('올바른 이메일 형식이 아닙니다.');
            } else {
                alert('회원가입에 실패했습니다: ' + error.message);
            }
            hideButtonLoading(signupBtn); 
        }
    });

    // ----------------------------------------------------
    // 비밀번호 찾기 로직
    // ----------------------------------------------------
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault(); 
        const email = loginEmail.value;
        if (!email) {
            alert('비밀번호를 재설정할 이메일 주소를 입력해주세요. (로그인 폼의 아이디 창)');
            loginEmail.focus();
            return;
        }
        if (!confirm(`'${email}' 주소로 비밀번호 재설정 메일을 발송하시겠습니까?`)) {
            return;
        }
        forgotPasswordLink.textContent = '메일 발송 중...';
        try {
            await sendPasswordResetEmail(auth, email);
            alert('비밀번호 재설정 이메일을 발송했습니다. 이메일함을 확인해주세요.');
            forgotPasswordLink.textContent = '비밀번호를 잊으셨나요?';
        } catch (error) {
            console.error("비밀번호 재설정 이메일 발송 실패:", error);
            alert('오류가 발생했습니다: ' + error.message);
            forgotPasswordLink.textContent = '비밀번호를 잊으셨나요?';
        }
    });
});