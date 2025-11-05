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
    // 2. 인기 도서 목록 표시 (Firebase 연동)
    // ----------------------------------------------------
    async function fetchPopularBooks() {
        if (!db) {
            topBooksList.innerHTML = '<p>데이터베이스 연결 오류 (초기화 실패)</p>';
            return;
        }

        const booksRef = collection(db, "books");
        
        // (참고) Firebase 규칙상 'reviews' > 0 필터 사용 시 'reviews' 정렬이 먼저 와야 합니다.
        const q = query(
            booksRef, 
            where("reviews", ">", 0),
            orderBy("reviews", "desc"),
            orderBy("averageRating", "desc"), 
            limit(20) // 20개를 가져와서
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

            // (참고) 클라이언트에서 '평균 별점' 순으로 재정렬
            books.sort((a, b) => {
                // 1. 평균 별점 (내림차순)
                if ((b.averageRating || 0) > (a.averageRating || 0)) return 1;
                if ((b.averageRating || 0) < (a.averageRating || 0)) return -1;
                
                // 2. (별점이 같으면) 리뷰 개수 (내림차순)
                if ((b.reviews || 0) > (a.reviews || 0)) return 1;
                if ((b.reviews || 0) < (a.reviews || 0)) return -1;
                
                return 0;
            });
            
            const top5Books = books.slice(0, 5); // 재정렬된 리스트에서 5개 선택
            topBooksList.innerHTML = ''; // 기존 로딩 메시지 삭제
            
            top5Books.forEach((book) => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                
                link.href = `book-detail.html?isbn=${book.isbn}`; 
                
                const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '평가 없음';
                const bookTitle = book.title || '제목 정보 없음';
                link.textContent = `${bookTitle} (${averageRating}점, ${book.reviews || 0} 리뷰)`;
                
                link.classList.add('popular-book-link');
                listItem.appendChild(link);
                topBooksList.appendChild(listItem);
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