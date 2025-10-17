document.addEventListener('DOMContentLoaded', async () => {
    // URL에서 검색어 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const queryText = urlParams.get('query');

    const searchResultsContainer = document.querySelector('.search-results-container');
    
    // 검색창 기능 추가
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    
    if (queryText) {
        searchInput.value = queryText; // 검색창에 검색어 미리 채워넣기
    }
    searchButton.addEventListener('click', () => {
        const newQuery = searchInput.value;
        if (newQuery) {
            window.location.href = `search-results.html?query=${encodeURIComponent(newQuery)}`;
        }
    });

    // 검색창에서 엔터 키를 눌렀을 때 검색 기능 실행
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const queryText = searchInput.value;
            if (queryText) {
                // 검색어를 URL에 포함하여 새 페이지로 이동
                window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
            } else {
                alert('검색어를 입력해주세요!');
            }
        }
    });

    // 검색 결과를 표시하는 함수
    function displayResults(books) {
        searchResultsContainer.innerHTML = '';
        if (books && books.length > 0) {
            books.forEach(book => {
                const bookItem = document.createElement('div');
                bookItem.classList.add('search-result-item');

                // [핵심 수정]: 클릭 이벤트를 추가하여 상세 페이지로 이동
                bookItem.addEventListener('click', () => {
                    // ISBN을 URL 쿼리 파라미터로 전달
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

    const serverUrl = 'https://bufs-book-review.onrender.com';

    try {
        const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}`);
        const books = await response.json();

        if (books.error) {
            searchResultsContainer.textContent = `서버 오류가 발생했습니다: ${books.error}`;
            return;
        }

        displayResults(books);

    } catch (error) {
        console.error('검색 실패:', error);
        searchResultsContainer.textContent = "검색 중 오류가 발생했습니다. 서버 연결을 확인하세요.";
    }
});

// 검색창에서 엔터 키를 눌렀을 때 검색 기능 실행
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// 검색 버튼 클릭 이벤트 리스너
searchButton.addEventListener('click', handleSearch);