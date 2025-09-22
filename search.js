// script.js

// Firebase 클라이언트 SDK 설정 (index.html에 추가했던 스크립트 모듈과 동일해야 함)
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const db = getFirestore();

    searchButton.addEventListener('click', async () => {
        const queryText = searchInput.value;
        if (!queryText) {
            alert('검색어를 입력해주세요!');
            return;
        }

        try {
            // 1. 먼저 Firebase에서 책을 검색합니다.
            const booksCol = collection(db, 'books');
            const q = query(booksCol, where('title', '==', queryText));
            const querySnapshot = await getDocs(q);

            let book;
            if (!querySnapshot.empty) {
                // 2. Firebase에 책이 있으면 바로 사용
                book = querySnapshot.docs[0].data();
                console.log('Firebase에서 책 정보 가져옴:', book);
            } else {
                // 3. Firebase에 책이 없으면 백엔드 서버에 요청
                console.log('Firebase에 책 정보 없음. 백엔드 서버에 요청 중...');
                const response = await fetch(`http://localhost:3000/api/search-and-save?query=${queryText}`);
                const data = await response.json();

                if (data.error) {
                    alert(data.error);
                    return;
                }
                book = data;
                console.log('백엔드 서버로부터 책 정보 가져옴:', book);
            }

            // 4. 검색 결과를 화면에 표시하는 로직
            displaySearchResults(book);

        } catch (error) {
            console.error('검색 실패:', error);
            alert('검색 중 오류가 발생했습니다.');
        }
    });

    // ... (인기 도서 목록과 displaySearchResults 함수는 이전 코드와 동일) ...
    function displaySearchResults(book) {
        // 이 부분에 검색 결과를 보여주는 로직을 작성합니다.
        console.log(book); 
        alert(`'${book.title}' 책이 검색되었습니다. 콘솔을 확인하세요.`);
    }
    
   // 인기 도서 목록을 표시하는 코드
    const topBooksList = document.querySelector('.top-books-list');
    
    // 이 함수를 호출하여 Firebase에서 데이터를 가져오고 화면에 표시합니다.
    async function fetchPopularBooks() {
        // Firebase Firestore 인스턴스를 가져옵니다.
        const db = getFirestore();
        const booksCol = collection(db, 'books');
        
        // 'reviews' 필드를 기준으로 내림차순 정렬하고 5개만 가져옵니다.
        const q = query(booksCol, orderBy('reviews', 'desc'), limit(5));

        try {
            const querySnapshot = await getDocs(q);
            topBooksList.innerHTML = ''; // 기존 목록을 비웁니다.
            
            querySnapshot.forEach(doc => {
                const book = doc.data();
                const listItem = document.createElement('li');
                listItem.textContent = `${book.title}`;
                topBooksList.appendChild(listItem);
            });
        } catch (error) {
            console.error("인기 도서 목록을 가져오는 데 실패했습니다:", error);
            topBooksList.textContent = "인기 도서 목록을 불러올 수 없습니다.";
        }
    }

    // 페이지가 로드되면 인기 도서 목록을 가져옵니다.
    fetchPopularBooks();
});