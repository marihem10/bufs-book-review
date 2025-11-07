import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');

    const bookDetailContainer = document.getElementById('bookDetail');
    const backButton = document.getElementById('backButton');
    
    const db = window.db; 
    const auth = window.auth; 
    
    const reviewTextarea = document.getElementById('reviewText');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    const userReviewsContainer = document.getElementById('userReviews');
    
    let selectedRating = 0;
    const serverUrl = 'https://bufs-book-review.onrender.com';

    // ----------------------------------------------------
    // 로딩 버튼 헬퍼 함수
    // ----------------------------------------------------
    function showButtonLoading(button) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = '<span class="button-loader"></span> 등록중...';
    }

    function hideButtonLoading(button) {
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
        }
        button.disabled = false;
    }

    if (!isbn) {
        bookDetailContainer.innerHTML = '<h2>오류: 책 정보를 찾을 수 없습니다.</h2>';
        return;
    }

    // ----------------------------------------------------
    // [A] 뒤로가기 버튼 기능
    // ----------------------------------------------------
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back(); 
        });
    }

    // ----------------------------------------------------
    // [B] 함수 정의: 책 상세 정보 가져오기
    // ----------------------------------------------------
    async function fetchBookDetails(isbn) {
        try {
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


    // ----------------------------------------------------
    // [C] 함수 정의: 리뷰 목록 불러오기
    // ----------------------------------------------------
    async function fetchAndDisplayReviews(bookIsbn) {
        userReviewsContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';

        try {
            const reviewsQuery = query(collection(db, "reviews"), where("bookIsbn", "==", bookIsbn));
            const querySnapshot = await getDocs(reviewsQuery);

            if (querySnapshot.empty) {
                userReviewsContainer.innerHTML = '<p>아직 이 책에 대한 리뷰가 없습니다.</p>';
                return;
            }

            userReviewsContainer.innerHTML = ''; 

            querySnapshot.forEach((doc) => {
                const review = doc.data();
                
                // Timestamp 객체와 String 형식을 모두 처리합니다.
                let date = '날짜 없음';
                if (review.timestamp) {
                    if (typeof review.timestamp.toDate === 'function') {
                        // 1. Firestore Timestamp 객체 (수정된 리뷰)
                        date = review.timestamp.toDate().toLocaleDateString('ko-KR');
                    } else {
                        // 2. ISO String 또는 Date 객체 (최초 등록)
                        date = new Date(review.timestamp).toLocaleDateString('ko-KR');
                    }
                }
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                const userIdDisplay = review.userId.split('@')[0];

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


    // ----------------------------------------------------
    // [D] 메인 실행 및 초기 로드
    // ----------------------------------------------------
    const book = await fetchBookDetails(isbn);
    if (book) {
        document.getElementById('pageTitle').textContent = book.title;

        const bookRef = doc(db, "books", isbn);
        const docSnap = await getDoc(bookRef); 

        let totalReviews = 0;
        let averageRating = 0;

        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            totalReviews = firestoreData.reviews || 0;
            averageRating = firestoreData.averageRating || 0;
        }

        const ratingDisplay = averageRating.toFixed(1);
        const fullStars = '★'.repeat(Math.round(averageRating));
        const emptyStars = '☆'.repeat(5 - Math.round(averageRating));
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
                
                <p><strong>평균 별점:</strong> <span class="average-rating-stars">${starsHtml}</span> (${ratingDisplay}/5.0)</p>
                <p><strong>총 리뷰 수:</strong> ${totalReviews}개</p>
            </div>
        `;
        await fetchAndDisplayReviews(isbn); 
    } else {
         bookDetailContainer.innerHTML = '<h2>책 상세 정보를 불러올 수 없습니다.</h2>';
    }

    // ----------------------------------------------------
    // [E] 리뷰 등록 이벤트 리스너 (별점)
    // ----------------------------------------------------
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            ratingStars.forEach((s, index) => {
                if (index < selectedRating) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
        });
    });

    // ----------------------------------------------------
    // [E-2] 리뷰 "등록" 버튼
    // ----------------------------------------------------
    submitReviewBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('리뷰를 등록하려면 먼저 로그인해주세요.');
            return;
        }
        if (selectedRating === 0 || reviewTextarea.value.trim() === '') {
            alert('별점과 감상평을 모두 입력해주세요.');
            return;
        }

        const cleanIsbn = isbn ? isbn.replace(/\D/g, '').trim() : ''; 
        if (cleanIsbn.length !== 13) { 
            alert('오류: 책 정보(ISBN)가 유효하지 않습니다. 13자리 숫자를 확인해주세요.');
            return;
        }

        showButtonLoading(submitReviewBtn); // [로딩 시작]

        try {
            const userId = auth.currentUser.uid;
            const userEmail = auth.currentUser.email;
            
            const docId = `${userId}_${cleanIsbn}`;
            const reviewRef = doc(db, "reviews", docId);

            const reviewDoc = await getDoc(reviewRef);
            if (reviewDoc.exists()) {
                alert('이미 이 책에 대한 리뷰를 작성했습니다.');
                hideButtonLoading(submitReviewBtn); // [로딩 종료 - 중복 시]
                return; 
            }

            const reviewData = {
                bookIsbn: cleanIsbn, 
                userId: userEmail,
                rating: selectedRating,
                comment: reviewTextarea.value.trim(),
                timestamp: new Date() // Date 객체로 저장
            };

            await setDoc(reviewRef, reviewData);

            // 통계 업데이트
            const bookRef = doc(db, "books", cleanIsbn);
            const bookDoc = await getDoc(bookRef);
            
            if (bookDoc.exists()) {
                const firestoreData = bookDoc.data();
                const currentReviews = firestoreData.reviews || 0;
                const currentRatingSum = firestoreData.ratingSum || 0;
                const newReviews = currentReviews + 1;
                const newRatingSum = currentRatingSum + selectedRating;
                const newAverageRating = newRatingSum / newReviews;
                await updateDoc(bookRef, {
                    reviews: newReviews,
                    ratingSum: newRatingSum,
                    averageRating: newAverageRating
                });
            } else {
                const displayedTitle = document.querySelector('.detail-text h1').textContent.trim();
                const displayedImage = document.querySelector('.detail-image').src;
                await setDoc(bookRef, {
                    isbn: cleanIsbn,
                    title: displayedTitle, 
                    image: displayedImage,
                    reviews: 1,
                    ratingSum: selectedRating,
                    averageRating: selectedRating
                });
            }

            alert('리뷰가 성공적으로 등록되었습니다.');
            
            reviewTextarea.value = '';
            ratingStars.forEach(s => s.classList.remove('selected'));
            selectedRating = 0;
            
            await fetchAndDisplayReviews(isbn); 
            await fetchBookDetails(isbn); 

            hideButtonLoading(submitReviewBtn); // [로딩 종료 - 성공 시]

        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            if (e.code === 'permission-denied') {
                alert('리뷰 등록에 실패했습니다. (DB 쓰기 권한 오류)');
            } else {
                alert('리뷰 등록 중 오류가 발생했습니다.');
            }
            hideButtonLoading(submitReviewBtn); // [로딩 종료 - 실패 시]
        }
    });
});