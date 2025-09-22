document.addEventListener('DOMContentLoaded', () => {
    

    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    
    // 검색 버튼 클릭 이벤트 리스너
    searchButton.addEventListener('click', async () => {
        const query = searchInput.value;
        if (query) {
            // 검색어를 URL의 쿼리 문자열로 인코딩하여 새 페이지로 이동
            window.location.href = `search-results.html?query=${encodeURIComponent(query)}`;
        } else {
            alert('검색어를 입력해주세요!');
        }
    });

    // 검색 결과를 화면에 표시하는 함수
    function displaySearchResults(books) {
        console.log(books);
        alert(`총 ${books.length}권의 책이 검색되었습니다. 콘솔을 확인하세요.`);
    }

    // 인기 도서 목록을 표시하는 코드
    // 예시 책 데이터 (실제로는 Firebase에서 가져올 데이터)
    const topBooks = [
        { rank: 1, title: '책이름1', reviews: 120 },
        { rank: 2, title: '책이름2', reviews: 110 },
        { rank: 3, title: '책이름3', reviews: 95 },
        { rank: 4, title: '책이름4', reviews: 88 },
        { rank: 5, title: '책이름5', reviews: 75 },
    ];

    // 각 책 데이터에 대해 HTML 요소를 생성하고 추가합니다.
    topBooks.forEach(book => {
        const listItem = document.createElement('li');
        listItem.textContent = `${book.title}`;
        topBooksList.appendChild(listItem);
    });
});