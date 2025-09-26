// script.js (index.html 파일용 - 최종 버전)

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    
    // 이 변수는 이제 사용하지 않습니다. (Render 서버 URL은 search-results.js에서 사용)
    // const serverUrl = 'https://bufs-book-review.onrender.com';

    // ----------------------------------------------------
    // 1. Firebase 인증 상태 확인 및 로그아웃 기능
    // ----------------------------------------------------
    const loginLink = document.querySelector('.nav-bar .nav-item');
    
    // login.html에서 window.auth에 저장한 인증 인스턴스를 사용합니다.
    const auth = window.auth; 

    // 인증 상태 감지 리스너
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 사용자 로그인 상태: LOGOUT 버튼 표시
            loginLink.textContent = 'LOGOUT';
            loginLink.href = '#'; // 링크 이동 방지
            
            // 기존 이벤트를 제거하고 로그아웃 이벤트를 추가
            loginLink.replaceWith(loginLink.cloneNode(true));
            const newLogoutLink = document.querySelector('.nav-bar .nav-item');
            
            newLogoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                    alert('로그아웃되었습니다.');
                    // 로그아웃 후 새로고침 (onAuthStateChanged가 다시 실행됨)
                    window.location.href = 'index.html'; 
                } catch (error) {
                    console.error("로그아웃 실패:", error);
                }
            });
            
        } else {
            // 사용자 로그아웃 상태: LOGIN 버튼 표시
            loginLink.textContent = 'LOGIN';
            loginLink.href = 'auth.html'; // auth.html로 이동하도록 링크 설정
        }
    });

    // ----------------------------------------------------
    // 2. 검색 기능 (기존 로직 유지)
    // ----------------------------------------------------
    
    // 검색창에서 엔터 키를 눌렀을 때 검색 기능 실행
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const queryText = searchInput.value;
            if (queryText) {
                // 검색어를 URL에 포함하여 새 페이지로 이동
                window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
            } else {
                alert('검색어를 입력해주세요!');
            }
        }
    });

    // 검색 버튼 클릭 이벤트 리스너
    searchButton.addEventListener('click', () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }
        
        // 검색어를 URL에 포함하여 새 페이지로 이동
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    });

    // ----------------------------------------------------
    // 3. 인기 도서 목록 표시 (기존 로직 유지)
    // ----------------------------------------------------
    
    const topBooks = [
        { rank: 1, title: '책이름1', reviews: 120 },
        { rank: 2, title: '책이름2', reviews: 110 },
        { rank: 3, title: '책이름3', reviews: 95 },
        { rank: 4, title: '책이름4', reviews: 88 },
        { rank: 5, title: '책이름5', reviews: 75 },
    ];

    topBooks.forEach(book => {
        const listItem = document.createElement('li');
        listItem.textContent = `${book.title}`;
        topBooksList.appendChild(listItem);
    });
});