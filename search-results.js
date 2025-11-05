document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. URL에서 핵심 파라미터 읽어오기
    const urlParams = new URLSearchParams(window.location.search);
    const queryText = urlParams.get('query');
    const currentSort = urlParams.get('sort') || 'sim'; // 기본값 'sim'
    const currentPage = parseInt(urlParams.get('page')) || 1; // 기본값 1

    // 2. 서버 URL 및 DOM 요소 가져오기
    const serverUrl = 'https://bufs-book-review.onrender.com';
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const searchResultsContainer = document.querySelector('.search-results-container');
    const paginationContainer = document.getElementById('pagination-container');
    const sortButtons = document.querySelectorAll('.sort-btn');

    // 3. 검색창 및 정렬 버튼 리스너 설정
    
    // 3-1. 검색창 설정
    if (queryText) {
        searchInput.value = queryText; // 검색창에 현재 검색어 채우기
    }
    
    const handleNewSearch = () => {
        const newQuery = searchInput.value;
        if (newQuery && newQuery.trim() !== '') {
            // 새 검색은 항상 정확도순(sim) 1페이지로 이동
            window.location.href = `search-results.html?query=${encodeURIComponent(newQuery)}&sort=sim&page=1`;
        } else {
            alert('검색어를 입력해주세요.');
        }
    };
    
    searchButton.addEventListener('click', handleNewSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleNewSearch();
        }
    });

    // 3-2. 정렬 버튼 설정
    sortButtons.forEach(button => {
        // 현재 정렬 상태에 맞게 버튼 활성화 표시
        if (button.dataset.sort === currentSort) {
            button.classList.add('active');
        }

        // 정렬 버튼 클릭 리스너
        button.addEventListener('click', () => {
            const newSort = button.dataset.sort;
            if (newSort !== currentSort) {
                // 정렬 변경 시 1페이지로 리셋
                window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}&sort=${newSort}&page=1`;
            }
        });
    });

    // 4. (메인) 검색 결과 API 요청 및 표시 함수
    async function fetchAndDisplayResults() {
        if (!queryText) {
            searchResultsContainer.textContent = '검색 결과 페이지입니다. 검색어를 입력해주세요.';
            return;
        }

        // 로딩 표시
        searchResultsContainer.innerHTML = '<p>검색 중입니다...</p>';

        try {
            // [핵심] sort와 page 파라미터를 추가하여 서버에 요청
            const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}&sort=${currentSort}&page=${currentPage}`);
            
            // [핵심] 서버로부터 { books, currentPage, totalPages } 객체를 받음
            const data = await response.json(); 

            if (data.error) {
                searchResultsContainer.textContent = `서버 오류가 발생했습니다: ${data.error}`;
                return;
            }

            // 결과 표시
            displayResults(data.books);
            
            // 페이지네이션 표시
            displayPagination(data.currentPage, data.totalPages);

        } catch (error) {
            console.error('검색 실패:', error);
            searchResultsContainer.textContent = "검색 중 오류가 발생했습니다. 서버 연결을 확인하세요.";
        }
    }

    // 5. (헬퍼) 책 목록을 화면에 그리는 함수
    function displayResults(books) {
        searchResultsContainer.innerHTML = ''; // 기존 결과 비우기
        
        if (books && books.length > 0) {
            books.forEach(book => {
                const bookItem = document.createElement('div');
                bookItem.classList.add('search-result-item');

                // 클릭 시 상세 페이지 이동 (기존 기능 유지)
                bookItem.addEventListener('click', () => {
                    window.location.href = `book-detail.html?isbn=${book.isbn}`;
                });

                const bookImage = document.createElement('img');
                bookImage.src = book.image || 'https://via.placeholder.com/180x250';
                bookImage.alt = book.title;

                const bookTitle = document.createElement('h3');
                bookTitle.textContent = book.title;

                const bookAuthor = document.createElement('p');
                bookAuthor.textContent = `저자: ${book.author}`;
                
                bookItem.appendChild(bookImage);
                bookItem.appendChild(bookTitle);
                bookItem.appendChild(bookAuthor);
                searchResultsContainer.appendChild(bookItem);
            });
        } else {
            searchResultsContainer.textContent = '검색 결과가 없습니다.';
        }
    }

    // 6. (헬퍼) 페이지네이션 버튼을 그리는 함수
    function displayPagination(page, totalPages) {
        paginationContainer.innerHTML = ''; // 기존 버튼 비우기
        
        if (totalPages <= 1) return; // 페이지가 1개 이하면 표시 안 함

        // 페이지 그룹 (예: 1-5, 6-10)
        const groupSize = 5;
        const currentGroup = Math.ceil(page / groupSize);
        let startPage = (currentGroup - 1) * groupSize + 1;
        let endPage = Math.min(startPage + groupSize - 1, totalPages);

        // "이전" 버튼 (첫 그룹이 아닐 때)
        if (currentGroup > 1) {
            paginationContainer.appendChild(createPageButton('« 이전', startPage - 1));
        }

        // 페이지 번호 버튼
        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(createPageButton(i, i, i === page));
        }

        // "다음" 버튼 (마지막 그룹이 아닐 때)
        if (endPage < totalPages) {
            paginationContainer.appendChild(createPageButton('다음 »', endPage + 1));
        }
    }

    // 7. (헬퍼) 페이지네이션 버튼 생성기
    function createPageButton(text, pageNum, isActive = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.classList.add('page-btn');
        
        if (isActive) {
            button.classList.add('active'); // 현재 페이지 활성화
            button.disabled = true;
        }

        // 버튼 클릭 시 URL을 변경하여 페이지 리로드
        button.addEventListener('click', () => {
            if (!button.disabled) {
                // 현재 URL 파라미터에서 page만 변경
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('page', pageNum);
                window.location.href = `search-results.html?${newParams.toString()}`;
            }
        });

        return button;
    }

    // 8. 페이지 로드 시 최초 실행
    fetchAndDisplayResults();
});