// search-results.js

import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. URL에서 검색어와 페이지 번호 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const queryText = urlParams.get('query');
    const currentPage = parseInt(urlParams.get('page')) || 1; // 현재 페이지 번호

    // 2. DOM 요소 선택
    const searchResultsContainer = document.querySelector('.search-results-container');
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const paginationContainer = document.querySelector('.pagination-container');
    
    // 서버 설정
    const serverUrl = 'https://bufs-book-review.onrender.com';
    const booksPerPage = 12; // 서버와 클라이언트 간의 페이지당 개수 일치


    // ----------------------------------------------------
    // A. 검색창 기능 (버튼 클릭 및 엔터)
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
    // B. 페이지네이션 UI 생성 함수
    // ----------------------------------------------------
    function createPagination(totalResults, currentPage, query) {
        if (!paginationContainer) return;

        paginationContainer.innerHTML = ''; 
        const totalPages = Math.ceil(totalResults / booksPerPage);

        if (totalPages <= 1) return;

        const maxButtons = 5; 
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        // 페이지 번호 버튼 생성
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('a');
            button.href = `search-results.html?query=${encodeURIComponent(query)}&page=${i}`;
            button.textContent = i;
            button.classList.add('pagination-button');
            if (i === currentPage) {
                button.classList.add('active');
                button.removeAttribute('href'); // 현재 페이지는 클릭 불가
            }
            paginationContainer.appendChild(button);
        }
    }


    // ----------------------------------------------------
    // C. 검색 결과 표시 함수
    // ----------------------------------------------------
    function displayResults(books) {
        searchResultsContainer.innerHTML = '';
        if (books && books.length > 0) {
            books.forEach(book => {
                const bookItem = document.createElement('div');
                bookItem.classList.add('search-result-item');
                
                // 클릭 이벤트 추가 (상세 페이지 이동)
                bookItem.addEventListener('click', () => {
                    window.location.href = `book-detail.html?isbn=${book.isbn}`;
                });

                // HTML 요소 생성
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
    // D. 페이지 로드 시 검색 실행 (MAIN LOGIC)
    // ----------------------------------------------------
    
    if (queryText) {
        try {
            searchResultsContainer.textContent = '검색 중...';
            
            // 1. 서버에 현재 페이지 정보를 전달하여 데이터 요청
            const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}&page=${currentPage}`);
            
            // 2. 응답이 400 또는 500 에러일 경우 처리
            if (!response.ok) {
                 const errorData = await response.json();
                 searchResultsContainer.textContent = `서버 오류가 발생했습니다: ${errorData.error || response.statusText}`;
                 return;
            }

            const data = await response.json(); // 서버에서 items와 total을 받음 (서버 코드가 items와 total을 반환한다고 가정)

            // 3. 결과 표시 및 페이지네이션 생성
            displayResults(data.items);
            createPagination(data.total, currentPage, queryText); 

        } catch (error) {
            console.error('검색 실패:', error);
            searchResultsContainer.textContent = "검색 중 오류가 발생했습니다. 서버 연결을 확인하세요.";
        }
    }
});