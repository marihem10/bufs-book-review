// book-detail.js

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL에서 ISBN 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');

    const bookDetailContainer = document.getElementById('bookDetail');
    const backButton = document.getElementById('backButton');
    const detailLoginLink = document.querySelector('.user-controls .nav-item-detail');
    // Firestore 및 Auth 인스턴스 초기화
    const db = getFirestore(window.firebaseApp);
    const auth = getAuth(window.firebaseApp);
    
    if (!isbn) {
        bookDetailContainer.innerHTML = '<h2>오류: 책 정보를 찾을 수 없습니다.</h2>';
        return;
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            // JavaScript의 history 객체를 사용하여 이전 페이지로 이동
            window.history.back(); 
        });
    }

    if (auth && detailLoginLink) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // 로그인 상태: LOGOUT 버튼 표시
                detailLoginLink.textContent = 'LOGOUT';
                detailLoginLink.href = '#'; 
                
                // 로그아웃 이벤트 리스너 재연결 (중복 방지)
                detailLoginLink.replaceWith(detailLoginLink.cloneNode(true));
                const newLogoutLink = document.querySelector('.user-controls .nav-item-detail');
                
                newLogoutLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        await signOut(auth);
                        alert('로그아웃되었습니다.');
                        window.location.href = 'index.html'; // 로그아웃 후 메인페이지로
                    } catch (error) {
                        console.error("로그아웃 실패:", error);
                    }
                });
            } else {
                // 로그아웃 상태: LOGIN 버튼 표시
                detailLoginLink.textContent = 'LOGIN';
                detailLoginLink.href = 'auth.html';
                
                // 이벤트 리스너 충돌 방지를 위해 요소 대체 (로그아웃 버튼이었을 경우를 대비)
                 detailLoginLink.replaceWith(detailLoginLink.cloneNode(true));
            }
        });
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

        // 평균 별점을 계산 (toFixed(1)로 소수점 첫째 자리까지 표시)
        const rating = book.averageRating ? book.averageRating.toFixed(1) : '평가 없음';
        
        // 별 아이콘 표시: Math.round()를 사용하여 반올림된 별 개수만큼 채웁니다.
        const fullStars = '★'.repeat(Math.round(book.averageRating || 0));
        const emptyStars = '☆'.repeat(5 - Math.round(book.averageRating || 0));
        const starsHtml = fullStars + emptyStars;

        bookDetailContainer.innerHTML = `
            <div class="detail-image-wrapper"> 
                <img src="${book.image}" alt="${book.title}" class="detail-image"> 
            </div>
            
            <div class="detail-text">
                <h1>${book.title}</h1> 
                <p><strong>저자:</strong> ${book.author}</p>
                <p><strong>출판사:</strong> ${book.publisher}</p>
                <p><strong>ISBN:</strong> ${book.isbn}</p>

                 <hr style="border-top: 1px solid rgba(255, 255, 255, 0.3); margin: 15px 0;">
                
                <p><strong>평균 별점:</strong> <span class="average-rating-stars">${starsHtml}</span> (${rating}/5.0)</p>
                <p><strong>총 리뷰 수:</strong> ${book.reviews || 0}개</p>
            </div>
        `;
    } 

    // 4. [ToDo]: 리뷰 작성 기능 및 평점 로직
     const reviewTextarea = document.getElementById('reviewText');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    const userReviewsContainer = document.getElementById('userReviews');
    
    let selectedRating = 0; // 사용자가 선택한 별점

    // ----------------------------------------------------
    // 1. 별점 기능 구현 (클릭 시 별점 반영)
    // ----------------------------------------------------
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            ratingStars.forEach((s, index) => {
                // 클릭된 별점까지만 노란색(opacity: 1)으로 표시
                if (index < selectedRating) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
        });
    });

    // ----------------------------------------------------
    // 2. 리뷰 등록 기능
    // ----------------------------------------------------
    submitReviewBtn.addEventListener('click', async () => {
        const db = window.db; 
        const authInstance = getAuth(window.firebaseApp);    // Auth 인스턴스를 사용해 현재 로그인된 사용자를 가져오기.

        if (!authInstance.currentUser) {
            alert('리뷰를 작성하려면 먼저 로그인해주세요.');
            return;
        }
        if (selectedRating === 0 || reviewTextarea.value.trim() === '') {
            alert('별점과 감상평을 모두 입력해주세요.');
            return;
        }

        // ISBN 클린업 및 검증
        const cleanIsbn = isbn ? isbn.replace(/\D/g, '').trim() : ''; 
        if (cleanIsbn.length !== 13) { 
            alert('오류: 책 정보(ISBN)가 유효하지 않습니다. 13자리 숫자를 확인해주세요.');
            return;
        }

        // 1. 리뷰 데이터 준비 (클라이언트 시간 사용)
        const reviewData = {
            bookIsbn: cleanIsbn, 
            userId: authInstance.currentUser.email,
            rating: selectedRating,
            comment: reviewTextarea.value.trim(),
            timestamp: new Date().toISOString() // 현재 시간을 ISO 형식으로 기록
        };

        try {
            // 2. [핵심]: 서버를 거치지 않고 Firestore 'reviews' 컬렉션에 직접 저장
            await addDoc(collection(db, "reviews"), reviewData);
            
            // 3. (통계 업데이트는 서버 없이 불가능하므로, 일단 성공 메시지만 표시)
            alert('리뷰가 성공적으로 등록되었습니다.');
            reviewTextarea.value = '';
            selectedRating = 0;
            fetchAndDisplayReviews(isbn); // 리뷰 목록 새로고침
        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            alert('리뷰 등록 중 오류가 발생했습니다. (Firestore 권한 확인 필요)');
        }
    });

    // ----------------------------------------------------
    // 3. 리뷰 목록 불러오기 및 표시
    // ----------------------------------------------------
    async function fetchAndDisplayReviews(bookIsbn) {
        // [핵심]: db 인스턴스를 전역 window.db에서 가져옵니다.
        const db = window.db; 
        const userReviewsContainer = document.getElementById('userReviews');
        
        userReviewsContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';

        try {
            // Firestore 쿼리: 해당 ISBN에 대한 리뷰만 가져옵니다.
            const reviewsQuery = query(collection(db, "reviews"), where("bookIsbn", "==", bookIsbn));
            const querySnapshot = await getDocs(reviewsQuery);

            if (querySnapshot.empty) {
                userReviewsContainer.innerHTML = '<p>아직 이 책에 대한 리뷰가 없습니다.</p>';
                return;
            }

            userReviewsContainer.innerHTML = ''; // 목록 비우기

            querySnapshot.forEach((doc) => {
                const review = doc.data();
                // Firestore timestamp 객체를 JavaScript Date 객체로 변환
                const date = review.timestamp ? review.timestamp.toDate().toLocaleDateString('ko-KR') : '날짜 없음';
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                const userIdDisplay = review.userId.split('@')[0]; // 이메일 앞부분만 표시

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                
                reviewElement.innerHTML = `
                    <p><strong>작성자:</strong> ${userIdDisplay} (${date})</p>
                    <p class="review-rating">${starsHtml}</p>
                    <p class="review-comment">${review.comment}</p>
                    <hr>
                `;
                userReviewsContainer.appendChild(reviewElement);
            });

        } catch (e) {
            console.error("리뷰 목록 가져오기 실패:", e);
            userReviewsContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다. (DB 연결 오류)</p>';
        }
    }
    }

);
