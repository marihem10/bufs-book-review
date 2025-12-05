import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ----------------------------------------------------
// Firebase 인스턴스를 기다리는 헬퍼 함수
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
    //  검색 기능 이벤트 리스너
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
    //  가로 스크롤 버튼 기능
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
    //  아래로 스크롤 버튼 기능
    // ----------------------------------------------------
    const scrollDownBtn = document.getElementById('scroll-down');
    const popularSection = document.querySelector('.popular-books-section');
    if (scrollDownBtn && popularSection) {
        scrollDownBtn.addEventListener('click', () => {
            popularSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ----------------------------------------------------
    // 스크롤 시 아래 버튼 숨기기
    // ----------------------------------------------------
    const appContainer = document.getElementById('app-container'); // 스크롤되는 진짜 박스

    if (scrollDownBtn && appContainer) {
        // window가 아니라 appContainer에 이벤트를 걸기
        appContainer.addEventListener('scroll', () => {
            // 스크롤 위치가 100px 넘어가면 숨김 클래스 추가
            if (appContainer.scrollTop > 100) {
                scrollDownBtn.classList.add('hidden');
            } else {
                scrollDownBtn.classList.remove('hidden');
            }
        });
    }

    // ----------------------------------------------------
    // 인기 도서 목록 그리기
    // ----------------------------------------------------
    function renderPopularBooks(booksArray, type = 'default') {
        popularBooksContainer.innerHTML = ''; // 목록 비우기
        
        if (!booksArray || booksArray.length === 0) {
            popularBooksContainer.innerHTML = '<p style="padding: 50px;">등록된 도서가 없습니다.</p>';
            return;
        }

        let currentRank = 1; // 현재 표시할 등수
        let actualCount = 1; // 실제 몇 번째 책인지 (다음 등수 계산용)

        booksArray.forEach((book, index) => {
            const bookItem = document.createElement('a');
            bookItem.classList.add('popular-book-item');
            bookItem.href = `book-detail.html?isbn=${book.isbn}`;

            // 공동 순위 계산 로직
            if (index > 0) {
                const prevBook = booksArray[index - 1];
                let isTie = false;

                // 탭 타입에 따라 비교 대상이 다름
                if (type === 'reading') {
                    // 읽는 중: 명수가 같으면 동점
                    isTie = (book.readingCount || 0) === (prevBook.readingCount || 0);
                } else if (type === 'wishlist') {
                    // 담은 책: 명수가 같으면 동점
                    isTie = (book.wishlistCount || 0) === (prevBook.wishlistCount || 0);
                } else {
                    // 종합/이달: 평점과 리뷰 수가 모두 같아야 동점
                    isTie = (book.averageRating === prevBook.averageRating) && 
                            (book.reviews === prevBook.reviews);
                }

                if (isTie) {
                    // 동점이면 등수 유지 (예: 1등, 1등)
                } else {
                    // 다르면 실제 순서로 등수 갱신 (예: 1등, 1등, 3등)
                    currentRank = actualCount;
                }
            }
            actualCount++; // 실제 책 개수는 무조건 증가

            // 하단 텍스트 설정
            let bottomInfo = '';
            if (type === 'reading') {
                bottomInfo = `<span style="color: #0abde3;"> ${book.readingCount || 0}명이 읽는 중</span>`;
            } else if (type === 'wishlist') {
                bottomInfo = `<span style="color: #20bf6b;"> ${book.wishlistCount || 0}명이 담아둠</span>`;
            } else {
                const averageRating = book.averageRating ? book.averageRating.toFixed(1) : '0.0';
                bottomInfo = `<span>★ ${averageRating} (${book.reviews || 0} 리뷰)</span>`;
            }
            
            // HTML 생성 rank 부분에 currentRank 사용
            bookItem.innerHTML = `
                <span class="popular-book-rank">${currentRank}</span>
                <img src="${book.image || 'https://via.placeholder.com/160x230'}" alt="${book.title}">
                <p>${book.title}</p>
                ${bottomInfo}
            `;
            
            popularBooksContainer.appendChild(bookItem);
        });
    }

    // ----------------------------------------------------
    //  종합 인기 데이터를 가져오는 함수
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
            limit(20)
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
    //  이달의 인기 데이터를 가져오는 함수
    // ----------------------------------------------------
    async function fetchPopularBooksMonthly() {
        
        // 로딩 중에 안내 메시지와 스피너를 보여줍니다.
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
                // field에 따라 타입 결정해서 전달 ('reading' 또는 'wishlist')
                const displayType = (field === 'readingCount') ? 'reading' : 'wishlist';
                renderPopularBooks(books, displayType);
            }
        } catch (e) {
            console.error(`${field} 순위 가져오기 실패:`, e);
            if (e.code === 'failed-precondition') {
                const msg = field === 'readingCount' ? '읽는 중' : '찜하기';
                alert(`(관리자) '${msg}' 순위 색인이 필요합니다. 콘솔 링크를 클릭하세요.`);
                console.log(e.message);
            }
            popularBooksContainer.innerHTML = '<p>목록을 불러올 수 없습니다.</p>';
        }
    }

    // ----------------------------------------------------
    //  탭 버튼 클릭 이벤트 리스너
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
    //  페이지 최초 로드 시 종합 인기 기본 호출
    // ----------------------------------------------------
    fetchPopularBooksAllTime();

}); 