import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    const db = window.db;
    
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
    // 2. 인기 도서 목록 표시 (Firebase 연동)
    // ----------------------------------------------------
    async function fetchPopularBooks() {
        // [핵심 수정]: Render 서버에 인기 도서 목록을 요청합니다.
        const serverUrl = 'https://bufs-book-review.onrender.com'; 
        
        try {
            const response = await fetch(`${serverUrl}/api/popular-books`);
            const popularBooks = await response.json();

            topBooksList.innerHTML = ''; // 기존 로딩 메시지 삭제

            if (!popularBooks || popularBooks.length === 0) {
                topBooksList.innerHTML = '<p>아직 등록된 인기 도서가 없습니다.</p>';
                return;
            }

            popularBooks.forEach((book) => {
                const listItem = document.createElement('li');
                const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '평가 없음';
                const bookTitle = book.title || '제목 정보 없음';
                
                listItem.textContent = `${bookTitle} (${averageRating}점, ${book.reviews || 0} 리뷰)`; 
                topBooksList.appendChild(listItem);
            });
        } catch (e) {
            console.error("인기 도서 목록 가져오기 실패:", e);
            topBooksList.innerHTML = '<p>인기 도서 목록을 불러올 수 없습니다.</p>';
        }
    }

    fetchPopularBooks(); // 페이지 로드 시 함수 실행
});