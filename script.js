// script.js (index.html 파일용)

document.addEventListener('DOMContentLoaded', () => {
    
    // 이전에 있던 변수들을 그대로 둡니다.
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');

    // 검색 버튼 클릭 이벤트 리스너
    searchButton.addEventListener('click', () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }
        
        // 검색어를 URL에 포함하여 새 페이지로 이동
        window.location.href = `search-results.html?query=${encodeURIComponent(queryText)}`;
    });

    // ... (인기 도서 목록을 표시하는 기존 코드) ...
    const topBooks = [
        { rank: 1, title: '책이름1', reviews: 120 },
        { rank: 2, title: '책이름2', reviews: 110 },
        { rank: 3, title: '책이름3', reviews: 95 },
        { rank: 4, title: '책이름4', reviews: 88 },
        { rank: 5, title: '책이름5', reviews: 75 },
    ];

    topBooks.forEach(book => {
        const listItem = document.createElement('li');
        listItem.textContent = `${book.title}`;
        topBooksList.appendChild(listItem);
    });
});