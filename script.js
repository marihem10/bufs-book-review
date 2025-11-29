import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ----------------------------------------------------
// [공용] Firebase 인스턴스를 기다리는 헬퍼 함수
// ----------------------------------------------------
async function initializeFirebaseInstances() {
    while (!window.auth || !window.db) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { auth: window.auth, db: window.db };
}

document.addEventListener('DOMContentLoaded', async () => {
    
    const { auth, db } = await initializeFirebaseInstances();
    
    const serverUrl = 'https://bufs-book-review.onrender.com';
    const popularBooksContainer = document.getElementById('popular-books-list');
    const tabButtons = document.querySelectorAll('.popular-tab-btn');
    
    // ----------------------------------------------------
    // 1. 검색 기능 이벤트 리스너
    // ----------------------------------------------------
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const handleSearch = () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    };
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    searchButton.addEventListener('click', handleSearch);

    // ----------------------------------------------------
    // 2. 가로 스크롤 버튼 기능
    // ----------------------------------------------------
    const scrollLeftBtn = document.getElementById('scroll-left');
    const scrollRightBtn = document.getElementById('scroll-right');
    if (popularBooksContainer && scrollLeftBtn && scrollRightBtn) {
        scrollLeftBtn.addEventListener('click', () => {
            const scrollAmount = popularBooksContainer.clientWidth * 0.7;
            popularBooksContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
        scrollRightBtn.addEventListener('click', () => {
            const scrollAmount = popularBooksContainer.clientWidth * 0.7;
            popularBooksContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
    }

    // ----------------------------------------------------
    // 3. 아래로 스크롤 버튼 기능
    // ----------------------------------------------------
    const scrollDownBtn = document.getElementById('scroll-down');
    const popularSection = document.querySelector('.popular-books-section');
    if (scrollDownBtn && popularSection) {
        scrollDownBtn.addEventListener('click', () => {
            popularSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ----------------------------------------------------
    // 5. 스크롤 시 '아래' 버튼 숨기기
    // ----------------------------------------------------
    if (scrollDownBtn) { 
        window.addEventListener('scroll', () => {
            const appContainer = document.getElementById('app-container'); // [신규] 컨테이너 선택

            if (scrollDownBtn && appContainer) { // window 대신 appContainer 사용
                appContainer.addEventListener('scroll', () => { // [수정] 이벤트 대상을 변경
                    if (appContainer.scrollTop > 100) { // [수정] window.scrollY -> appContainer.scrollTop
                        scrollDownBtn.classList.add('hidden');
                    } else {
                        scrollDownBtn.classList.remove('hidden');
                    }
                });
            }
        });
    }

    // ----------------------------------------------------
    // 4. 인기 도서 목록을 화면에 그리는 *공통 함수*
    // ----------------------------------------------------
    function renderPopularBooks(booksArray) {
        popularBooksContainer.innerHTML = ''; // 기존 목록 비우기
        
        if (!booksArray || booksArray.length === 0) {
            popularBooksContainer.innerHTML = '<p>아직 등록된 인기 도서가 없습니다.</p>';
            return;
        }

        booksArray.forEach((book, index) => {
            const bookItem = document.createElement('a');
            bookItem.classList.add('popular-book-item');
            bookItem.href = `book-detail.html?isbn=${book.isbn}`;

            const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '0.0';
            
            bookItem.innerHTML = `
                <span class="popular-book-rank">${index + 1}</span>
                <img src="${book.image || 'https://via.placeholder.com/160x230'}" alt="${book.title}">
                <p>${book.title}</p>
                <span>★ ${averageRating} (${book.reviews || 0} 리뷰)</span>
            `;
            
            popularBooksContainer.appendChild(bookItem);
        });
    }

    // ----------------------------------------------------
    // 5. '종합 인기' (All-Time) 데이터를 가져오는 함수
    // ----------------------------------------------------
    async function fetchPopularBooksAllTime() {
        if (!db) {
            popularBooksContainer.innerHTML = '<p>데이터베이스 연결 오류</p>';
            return;
        }
        popularBooksContainer.innerHTML = '<p>종합 인기 도서를 불러오는 중입니다...</p>';

        const booksRef = collection(db, "books");
        const q = query(
            booksRef, 
            where("reviews", ">", 0),
            orderBy("reviews", "desc"),
            orderBy("averageRating", "desc"), 
            limit(20) // 20개 가져와서
        );

        try {
            const querySnapshot = await getDocs(q);
            let books = [];
            querySnapshot.forEach((doc) => {
                books.push(doc.data());
            });

            books.sort((a, b) => {
                if ((b.averageRating || 0) > (a.averageRating || 0)) return 1;
                if ((b.averageRating || 0) < (a.averageRating || 0)) return -1;
                if ((b.reviews || 0) > (a.reviews || 0)) return 1;
                if ((b.reviews || 0) < (a.reviews || 0)) return -1;
                return 0;
            });
            
            const top10Books = books.slice(0, 10);
            renderPopularBooks(top10Books); // 공통 렌더링 함수 호출
            
        } catch (e) {
            console.error("종합 인기 도서 목록 가져오기 실패:", e);
            popularBooksContainer.innerHTML = '<p>인기 도서 목록을 불러올 수 없습니다.</p>';
            if (e.code === 'failed-precondition') {
                 popularBooksContainer.innerHTML = '<p>(관리자) Firebase 색인이 필요합니다. 콘솔을 확인하세요.</p>';
            }
        }
    } 

    // ----------------------------------------------------
    // 6. '이달의 인기' (Monthly) 데이터를 가져오는 함수
    // ----------------------------------------------------
    async function fetchPopularBooksMonthly() {
        
        // [핵심] 로딩 중에 안내 메시지와 스피너를 보여줍니다.
        popularBooksContainer.innerHTML = `
            <div class="loading-message">
                <div class="spinner-dark"></div>
                <p>이달의 인기도서를 집계하고 있습니다.</p>
                <p class="sub-text">데이터 양에 따라 시간이 조금 걸릴 수 있습니다.</p>
            </div>
        `;

        try {
            const response = await fetch(`${serverUrl}/api/popular-books-monthly`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || '서버 응답 오류');
            }
            
            const books = await response.json();
            renderPopularBooks(books); // 데이터 로딩 완료 시 목록 표시

        } catch (e) {
            console.error("이달의 인기 도서 목록 가져오기 실패:", e);
            popularBooksContainer.innerHTML = `<p>목록을 불러올 수 없습니다: ${e.message}</p>`;
        }
    }

    // ----------------------------------------------------
    // 특정 필드(readingCount, wishlistCount) 기준 랭킹 가져오기
    // ----------------------------------------------------
    async function fetchBooksByRank(field) {
        if (!db) return;
        popularBooksContainer.innerHTML = '<div class="loading-message"><div class="spinner-dark"></div><p>순위를 집계하고 있습니다.</p></div>';

        const booksRef = collection(db, "books");
        // 해당 필드가 0보다 큰 책만 가져와서, 내림차순 정렬
        const q = query(
            booksRef, 
            where(field, ">", 0), 
            orderBy(field, "desc"), 
            limit(10)
        );

        try {
            const querySnapshot = await getDocs(q);
            let books = [];
            querySnapshot.forEach((doc) => {
                books.push(doc.data());
            });
            
            if (books.length === 0) {
                popularBooksContainer.innerHTML = '<p style="padding:50px;">아직 집계된 데이터가 없습니다.</p>';
            } else {
                renderPopularBooks(books);
            }
        } catch (e) {
            console.error(`${field} 순위 가져오기 실패:`, e);
            // 색인 오류 처리
            if (e.code === 'failed-precondition') {
                const msg = field === 'readingCount' ? '읽는 중' : '찜하기';
                alert(`(관리자) '${msg}' 순위를 보려면 색인이 필요합니다. F12 콘솔의 링크를 클릭하세요.`);
                console.log(e.message); // 여기에 링크 뜸
            }
            popularBooksContainer.innerHTML = '<p>목록을 불러올 수 없습니다.</p>';
        }
    }

    // ----------------------------------------------------
    // 7. 탭 버튼 클릭 이벤트 리스너
    // ----------------------------------------------------
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 1. 스타일 변경
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 2. 탭에 따른 함수 호출
            const tab = button.dataset.tab;
            
            if (tab === 'month') {
                fetchPopularBooksMonthly();
            } else if (tab === 'reading') {
                // 읽는 중 순위 (readingCount 기준)
                fetchBooksByRank('readingCount');
            } else if (tab === 'wishlist') {
                // 찜하기 순위 (wishlistCount 기준)
                fetchBooksByRank('wishlistCount');
            } else {
                // 기본: 종합 인기
                fetchPopularBooksAllTime();
            }
        });
    });

    // ----------------------------------------------------
    // 8. 페이지 최초 로드 시 '종합 인기' 기본 호출
    // ----------------------------------------------------
    fetchPopularBooksAllTime();

}); 