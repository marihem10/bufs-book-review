// book-detail.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL에서 ISBN 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');

    const bookDetailContainer = document.getElementById('bookDetail');
    
    if (!isbn) {
        bookDetailContainer.innerHTML = '<h2>오류: 책 정보를 찾을 수 없습니다.</h2>';
        return;
    }

    const serverUrl = 'https://bufs-book-review.onrender.com';
    
    // 2. ISBN으로 책 정보 가져오기 (Render 서버에 새로운 엔드포인트가 필요함)
    async function fetchBookDetails(isbn) {
        try {
            // [주의]: Render 서버에 '/api/book-detail?isbn=...' 엔드포인트가 추가되어야 합니다.
            const response = await fetch(`${serverUrl}/api/book-detail?isbn=${isbn}`);
            const book = await response.json();

            if (book.error) {
                 bookDetailContainer.innerHTML = `<h2>${book.error}</h2>`;
                 return null;
            }
            return book;
        } catch (error) {
            bookDetailContainer.innerHTML = '<h2>서버 연결에 실패했습니다.</h2>';
            console.error(error);
            return null;
        }
    }

    // 3. 가져온 책 정보를 화면에 표시
    const book = await fetchBookDetails(isbn);
    if (book) {
        document.getElementById('pageTitle').textContent = book.title;

        bookDetailContainer.innerHTML = `
            <div class="detail-content">
                <img src="${book.image}" alt="${book.title}" class="detail-image"> 
                
                <div class="detail-text">
                    <h1>${book.title}</h1> 
                    <p><strong>저자:</strong> ${book.author}</p>
                    <p><strong>출판사:</strong> ${book.publisher}</p>
                    <p><strong>ISBN:</strong> ${book.isbn}</p>
                </div>
            </div>
        `;
    } 

    // 4. [ToDo]: 리뷰 작성 기능 및 평점 로직을 여기에 구현해야 합니다.
    // (예: submitReviewBtn 클릭 이벤트, Firebase에 리뷰 저장 로직 등)
});