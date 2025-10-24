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
        const db = window.db; // HTML에서 초기화된 전역 db를 사용

        if (!db) {
            // DB 인스턴스가 없으면 오류 메시지를 명확히 표시하고 함수 종료
            topBooksList.innerHTML = '<p>데이터베이스 연결 오류 (초기화 실패)</p>';
            console.error("Firebase DB 인스턴스를 찾을 수 없습니다. Firebase SDK를 확인하세요.");
            return; 
        }

        const booksRef = collection(db, "books"); // db 인스턴스 사용

        // 리뷰 수가 많은 순서대로 5개의 책을 가져오는 쿼리 (이미 설정됨)
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
        } catch (e) {
            console.error("인기 도서 목록 가져오기 실패:", e);
            topBooksList.innerHTML = '<p>인기 도서 목록을 불러올 수 없습니다.</p>';
        }
    }

    fetchPopularBooks(); // 페이지 로드 시 함수 실행
});