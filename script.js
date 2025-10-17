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
        const db = window.db; 
        const booksRef = collection(db, "books");

        // 리뷰 수가 많은 순서대로 5개의 책을 가져오는 쿼리
        const q = query(booksRef, orderBy("reviews", "desc"), limit(5));

        try {
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((doc) => {
                const book = doc.data();
                const listItem = document.createElement('li');

                const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '평가 없음';
                
                // 임시로 JSON 문자열 전체를 출력하여 문제 진단:
                const bookTitle = book.title || '제목 정보 없음'; // book.title이 undefined면 '제목 정보 없음'으로 표시

                // 책 제목과 리뷰 수를 표시
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