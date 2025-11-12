import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// window.auth와 window.db가 로드될 때까지 기다리는 헬퍼 함수
function initializeFirebaseInstances() {
    if (window.auth && window.db) {
        return { auth: window.auth, db: window.db };
    }
    // 0.1초마다 firebase-init.js가 로드되었는지 확인
    return new Promise(resolve => setTimeout(() => resolve(initializeFirebaseInstances()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // [핵심]: Firebase 인스턴스를 기다려서 가져옵니다.
    const { auth, db } = await initializeFirebaseInstances();

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
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    };
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    searchButton.addEventListener('click', handleSearch);

    // ----------------------------------------------------
    // 2. 인기 도서 목록 표시
    // ----------------------------------------------------
    async function fetchPopularBooks() {
        const topBooksList = document.getElementById('popular-books-list');

        if (!db) {
            topBooksList.innerHTML = '<p>데이터베이스 연결 오류 (초기화 실패)</p>';
            return;
        }
        if (!topBooksList) {
            console.error('인기 도서 목록 컨테이너(#popular-books-list)를 찾을 수 없습니다.');
            return;
        }

        const booksRef = collection(db, "books");
        
        // 기존 쿼리 유지 (평균 별점 순으로 재정렬)
        const q = query(
            booksRef, 
            where("reviews", ">", 0),
            orderBy("reviews", "desc"),
            orderBy("averageRating", "desc"), 
            limit(20)
        );

        try {
            const querySnapshot = await getDocs(q);
            
            let books = [];
            querySnapshot.forEach((doc) => {
                books.push(doc.data());
            });

            if (books.length === 0) {
                topBooksList.innerHTML = '<p>아직 등록된 인기 도서가 없습니다.</p>';
                return;
            }

            // 기존 클라이언트 재정렬 유지 (평균 별점 1순위)
            books.sort((a, b) => {
                if ((b.averageRating || 0) > (a.averageRating || 0)) return 1;
                if ((b.averageRating || 0) < (a.averageRating || 0)) return -1;
                if ((b.reviews || 0) > (a.reviews || 0)) return 1;
                if ((b.reviews || 0) < (a.reviews || 0)) return -1;
                return 0;
            });
            
            // 상위 10개
            const top10Books = books.slice(0, 10);
            topBooksList.innerHTML = ''; // 로딩 메시지 삭제
            
            // 새 HTML 구조 (이미지+텍스트)로 렌더링
            top10Books.forEach((book) => {
                const bookItem = document.createElement('a');
                bookItem.classList.add('popular-book-item');
                bookItem.href = `book-detail.html?isbn=${book.isbn}`;

                const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '0.0';
                
                bookItem.innerHTML = `
                    <img src="${book.image || 'https://via.placeholder.com/160x230'}" alt="${book.title}">
                    <p>${book.title}</p>
                    <span>★ ${averageRating} (${book.reviews || 0} 리뷰)</span>
                `;
                
                topBooksList.appendChild(bookItem);
            });
            
        } catch (e) {
            console.error("인기 도서 목록 가져오기 실패:", e);
            topBooksList.innerHTML = '<p>인기 도서 목록을 불러올 수 없습니다.</p>';
            
            if (e.code === 'failed-precondition') {
                 topBooksList.innerHTML = '<p>(관리자) Firebase 색인이 필요합니다. 콘솔을 확인하세요.</p>';
            }
        }
    } 
    await fetchPopularBooks();

}); 