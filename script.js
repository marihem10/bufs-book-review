// script.js
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
        if (!db) {
            topBooksList.innerHTML = '<p>데이터베이스 연결 오류</p>';
            return;
        }

        // [주의]: 이 코드는 실제 책의 'reviews' 필드가 있다고 가정합니다.
        // Firebase에는 복잡한 쿼리가 안되므로, 실제로는 서버(Node.js)에서 통계 데이터를 계산해야 합니다.
        // 현재는 가장 단순한 방법인, 미리 저장된 'reviews' 필드를 사용한다고 가정합니다.
        const booksRef = collection(db, "books");

        // 리뷰 수가 많은 순서대로 5개의 책을 가져오는 쿼리
        const q = query(booksRef, orderBy("reviews", "desc"), limit(5));

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
                // 책 제목과 리뷰 수를 표시 (예시)
                listItem.textContent = `${book.title} (${book.reviews} 리뷰)`; 
                topBooksList.appendChild(listItem);
            });
        } catch (e) {
            console.error("인기 도서 목록 가져오기 실패:", e);
            topBooksList.innerHTML = '<p>인기 도서 목록을 불러올 수 없습니다.</p>';
        }
    }

    fetchPopularBooks(); // 페이지 로드 시 함수 실행
});