// script.js (index.html 파일용 - 로그인 기능 제외)

// Firebase Auth 관련 import는 모두 삭제합니다.
// import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    
    // ----------------------------------------------------
    // 1. 검색 기능 이벤트 리스너
    // ----------------------------------------------------
    const handleSearch = () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }
        // 검색어를 URL에 포함하여 새 페이지로 이동
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    };

    // 엔터 키 이벤트 리스너
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // 검색 버튼 클릭 이벤트 리스너
    searchButton.addEventListener('click', handleSearch);

    // ----------------------------------------------------
    // 2. 인기 도서 목록 표시 (기존 로직 유지)
    // ----------------------------------------------------
    
    const topBooks = [
        { rank: 1, title: '책이름1', reviews: 120, displayTitle: '책이름1' },
        { rank: 2, title: '책이름2', reviews: 110, displayTitle: '책이름2' },
        { rank: 3, title: '책이름3', reviews: 95, displayTitle: '책이름3' },
        { rank: 4, title: '책이름4', reviews: 88, displayTitle: '책이름4' },
        { rank: 5, title: '책이름5', reviews: 75, displayTitle: '책이름5' },
    ];

    topBooks.forEach(book => {
        const listItem = document.createElement('li');
        listItem.textContent = `${book.displayTitle}`;
        topBooksList.appendChild(listItem);
    });
});