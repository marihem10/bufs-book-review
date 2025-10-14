// search-results.js

import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL에서 검색어와 페이지 번호 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const queryText = urlParams.get('query');
    const currentPage = parseInt(urlParams.get('page')) || 1; // 현재 페이지

    const searchResultsContainer = document.querySelector('.search-results-container');
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const paginationContainer = document.querySelector('.pagination-container'); // 페이지네이션 컨테이너
    
    const serverUrl = 'https://bufs-book-review.onrender.com';
    const booksPerPage = 12; // 한 페이지에 표시할 책 개수 (서버와 일치)
    
    // ----------------------------------------------------
    // 2. 검색창 기능 (클릭 및 엔터 키) 통합
    // ----------------------------------------------------
    const handleSearch = () => {
        const newQuery = searchInput.value;
        if (newQuery) {
            // 새 검색어로 1페이지로 이동
            window.location.href = `search-results.html?query=${encodeURIComponent(newQuery)}&page=1`;
        }
    };
    
    if (queryText) {
        searchInput.value = queryText; // 검색창에 검색어 미리 채워넣기
    }

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // ----------------------------------------------------
    // 3. 페이지네이션 UI 생성 함수
    // ----------------------------------------------------
    function createPagination(totalResults, currentPage, query) {
        paginationContainer.innerHTML = ''; 
        const totalPages = Math.ceil(totalResults / booksPerPage);

        if (totalPages <= 1) return;

        const maxButtons = 5; 
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        // '이전' 버튼
        if (currentPage > 1) {
            paginationContainer.appendChild(createButton(currentPage - 1, '이전', query));
        }

        // 페이지 번호 버튼
        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(createButton(i, i, query, i === currentPage));
        }

        // '다음' 버튼
        if (currentPage < totalPages) {
            paginationContainer.appendChild(createButton(currentPage + 1, '다음', query));
        }
    }

    function createButton(pageNumber, text, query, isActive = false) {
        const button = document.createElement('a');
        button.href = `search-results.html?query=${encodeURIComponent(query)}&page=${pageNumber}`;
        button.textContent = text;
        button.classList.add('pagination-button');
        if (isActive) {
            button.classList.add('active');
            button.removeAttribute('href');
        }
        return button;
    }
    
    // ----------------------------------------------------
    // 4. 검색 결과 표시 함수
    // ----------------------------------------------------
    function displayResults(books) {
        searchResultsContainer.innerHTML = '';
        if (books && books.length > 0) {
            books.forEach(book => {
                const bookItem = document.createElement('div');
                bookItem.classList.add('search-result-item');
                bookItem.addEventListener('click', () => {
                    window.location.href = `book-detail.html?isbn=${book.isbn}`;
                });
                // ... (이미지, 제목, 저자 등 HTML 요소 생성 로직 유지) ...
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
    
    // ----------------------------------------------------
    // 5. 페이지 로드 시 검색 실행
    // ----------------------------------------------------
    
    if (queryText) {
        try {
            searchResultsContainer.textContent = '검색 중...';
            // [핵심 호출]: 서버에 현재 페이지 정보를 전달
            const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}&page=${currentPage}`);
            const data = await response.json(); // data에는 items와 total이 포함되어 있음

            if (data.error) {
                searchResultsContainer.textContent = `서버 오류가 발생했습니다: ${data.error}`;
                return;
            }

            displayResults(data.items);
            createPagination(data.total, currentPage, queryText); // 페이지네이션 생성

        } catch (error) {
            console.error('검색 실패:', error);
            searchResultsContainer.textContent = "검색 중 오류가 발생했습니다. 서버 연결을 확인하세요.";
        }
    }
});