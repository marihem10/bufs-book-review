import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', async () => {
    const auth = getAuth(window.firebaseApp); 
    const db = getFirestore(window.firebaseApp); 

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
    
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.addEventListener('click', async () => {
        showButtonLoading(loginBtn, '로그인중...'); 
        try {
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            const user = userCredential.user;
            if (user.emailVerified) {
                alert('로그인에 성공했습니다!');
                window.location.href = 'index.html';
            } else {
                if (confirm('이메일 인증이 완료되지 않았습니다. 인증 메일을 다시 받으시겠습니까? (스팸함도 확인해보세요)')) {
                    await sendEmailVerification(user);
                    alert('인증 메일을 다시 발송했습니다. 이메일함을 확인해주세요.');
                }
                await signOut(auth); 
                hideButtonLoading(loginBtn); 
            }
        } catch (error) {
            alert('로그인에 실패했습니다: ' + error.message);
            hideButtonLoading(loginBtn); 
        }
    });
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


    // ----------------------------------------------------
    // 회원가입 로직
    // ----------------------------------------------------
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupNickname = document.getElementById('signupNickname'); 
    const signupBtn = document.getElementById('signupBtn');

    signupBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        
        const email = signupEmail.value;
        const password = signupPassword.value;
        const nickname = signupNickname.value.trim(); 

        // 1. 유효성 검사
        if (password.length < 6) {
            alert('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }
        if (nickname.length < 2 || nickname.length > 10) {
            alert('닉네임은 2자 이상 10자 이하로 입력해주세요.');
            return;
        }

        showButtonLoading(signupBtn, '생성중...'); 

        try {
            // 2. 닉네임 중복 검사
            const nicknameLower = nickname.toLowerCase(); // 소문자로 변환하여 검사
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("nickname_lowercase", "==", nicknameLower));
            
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                alert('이미 사용 중인 닉네임입니다.');
                hideButtonLoading(signupBtn);
                return;
            }

            // 3. 계정 생성
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 4. Auth 프로필에 닉네임 저장
            await updateProfile(user, {
                displayName: nickname
            });

            // 5. Firestore 'users' 컬렉션에 프로필 저장
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                nickname: nickname,
                nickname_lowercase: nicknameLower
            });
            
            // 6. 인증 메일 발송
            await sendEmailVerification(user);

            alert('회원가입에 성공했습니다! 이메일함을 확인하여 인증을 완료해주세요.');
            
            switchTab(formLogin);
            signupEmail.value = '';
            signupPassword.value = '';
            signupNickname.value = '';
            hideButtonLoading(signupBtn); 

        } catch (error) {
            console.error("회원가입 실패:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/invalid-email') {
                alert('올바른 이메일 형식이 아닙니다.');
            } else if (error.code === 'failed-precondition') {
                alert('닉네임 중복 검사에 실패했습니다. (Firebase 색인이 필요합니다. F12 콘솔을 확인하세요.)');
            } else {
                alert('회원가입에 실패했습니다: ' + error.message);
            }
            hideButtonLoading(signupBtn); 
        }
    });
});