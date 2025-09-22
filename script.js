document.addEventListener('DOMContentLoaded', () => {
    

    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const topBooksList = document.querySelector('.top-books-list');
    
    // Render에 배포된 서버의 URL로 변경해야 합니다.
    const serverUrl = 'https://bufs-book-review.onrender.com';

    searchButton.addEventListener('click', async () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }

        try {
            // Render 서버에 요청
            const response = await fetch(`${serverUrl}/api/search?query=${encodeURIComponent(queryText)}`);
            const books = await response.json();

            if (books.error) {
                alert(books.error);
                return;
            }
            
            // 검색 결과를 화면에 표시하는 함수를 호출합니다.
            displaySearchResults(books);

        } catch (error) {
            console.error('검색 실패:', error);
            alert('검색 중 오류가 발생했습니다. 서버가 실행 중인지 확인하세요.');
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