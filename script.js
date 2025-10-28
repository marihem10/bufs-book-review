// script.js (Firebase 초기화 대기 로직 추가)

import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// [핵심] window.auth와 window.db가 로드될 때까지 기다리는 헬퍼 함수
function initializeFirebaseInstances() {
    if (window.auth && window.db) {
        return { auth: window.auth, db: window.db };
    }
    // 0.1초마다 firebase-init.js가 로드되었는지 확인
    return new Promise(resolve => setTimeout(() => resolve(initializeFirebaseInstances()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // [핵심 수정]: Firebase 인스턴스를 기다려서 가져옵니다.
    const { auth, db } = await initializeFirebaseInstances();

    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    
    // ----------------------------------------------------
    // 1. 검색 기능 이벤트 리스너 (기존 코드)
    // ----------------------------------------------------
    const handleSearch = () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    };
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    searchButton.addEventListener('click', handleSearch);

    // ----------------------------------------------------
    // 2. 인기 도서 목록 표시 (Firebase 연동)
    // ----------------------------------------------------
    async function fetchPopularBooks() {
        // [핵심 수정]: 위에서 await로 받아온 db 변수를 사용합니다.
        if (!db) {
            topBooksList.innerHTML = '<p>데이터베이스 연결 오류 (초기화 실패)</p>';
            return;
        }

        const booksRef = collection(db, "books");
        
        // [수정 확인]: 정렬 기준 (평균 별점 우선, 그다음 리뷰 수)
        const q = query(
            booksRef, 
            orderBy("averageRating", "desc"), 
            orderBy("reviews", "desc"), 
            limit(5)
        );

        try {
            const querySnapshot = await getDocs(q);
            topBooksList.innerHTML = ''; // 기존 로딩 메시지 삭제

            if (querySnapshot.empty) {
                topBooksList.innerHTML = '<p>아직 등록된 인기 도서가 없습니다.</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const book = doc.data();
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