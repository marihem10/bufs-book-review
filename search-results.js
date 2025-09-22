// search-results.js

document.addEventListener('DOMContentLoaded', async () => {
    // URL에서 검색어 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const queryText = urlParams.get('query');

    const searchResultsContainer = document.querySelector('.search-results-container');
    
    if (!queryText) {
        searchResultsContainer.textContent = "검색어를 찾을 수 없습니다.";
        return;
    }

    const serverUrl = 'https://bufs-book-review.onrender.com';

    try {
        const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}`);
        const books = await response.json();

        if (books.error) {
            searchResultsContainer.textContent = `서버 오류가 발생했습니다: ${books.error}`;
            return;
        }

        if (books && books.length > 0) {
            books.forEach(book => {
                const bookItem = document.createElement('div');
                bookItem.classList.add('search-result-item');
                
                const bookTitle = document.createElement('h3');
                bookTitle.textContent = book.title;

                const bookAuthor = document.createElement('p');
                bookAuthor.textContent = `저자: ${book.author}`;
                
                bookItem.appendChild(bookTitle);
                bookItem.appendChild(bookAuthor);
                searchResultsContainer.appendChild(bookItem);
            });
        } else {
            searchResultsContainer.textContent = '검색 결과가 없습니다.';
        }

    } catch (error) {
        console.error('검색 실패:', error);
        searchResultsContainer.textContent = "검색 중 오류가 발생했습니다. 서버 연결을 확인하세요.";
    }
});