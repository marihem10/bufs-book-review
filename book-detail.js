import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL에서 ISBN 가져오기 (초기화)
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');

    const bookDetailContainer = document.getElementById('bookDetail');
    const backButton = document.getElementById('backButton');
    
    // Firebase 인스턴스 (HTML에서 초기화됨)
    const db = window.db; 
    const auth = window.auth; 
    
    // 리뷰 관련 요소
    const reviewTextarea = document.getElementById('reviewText');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    const userReviewsContainer = document.getElementById('userReviews');
    
    let selectedRating = 0; // 사용자가 선택한 별점
    const serverUrl = 'https://bufs-book-review.onrender.com'; // 서버 URL (책 정보 가져올 때 사용)


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
    // [B] 함수 정의: 책 상세 정보 가져오기 (서버 사용)
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
    // [C] 함수 정의: 리뷰 목록 불러오기 (Firestore 직접 사용)
    // ----------------------------------------------------
    async function fetchAndDisplayReviews(bookIsbn) {
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
                // Timestamp 객체가 아닌 String일 경우 대비
                const date = review.timestamp ? new Date(review.timestamp).toLocaleDateString('ko-KR') : '날짜 없음'; 
                
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


    // ----------------------------------------------------
    // [D] 메인 실행 및 초기 로드
    // ----------------------------------------------------
    
    // 1. 책 상세 정보 로딩 및 표시
    const book = await fetchBookDetails(isbn);
    if (book) {
        document.getElementById('pageTitle').textContent = book.title;

        // Firebase Firestore에서 통계 데이터를 가져옵니다.
        const db = window.db;
        const bookRef = doc(db, "books", isbn);
        const docSnap = await getDoc(bookRef); // 문서 가져오기

        let totalReviews = 0;
        let averageRating = 0;

        // Firestore에 데이터가 존재하면 통계 정보를 업데이트합니다.
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            totalReviews = firestoreData.reviews || 0;
            averageRating = firestoreData.averageRating || 0;
        }

        // 별점 및 리뷰 수 계산
        const ratingDisplay = averageRating.toFixed(1);
        const fullStars = '★'.repeat(Math.round(averageRating));
        const emptyStars = '☆'.repeat(5 - Math.round(averageRating));
        const starsHtml = fullStars + emptyStars;


        // HTML 생성 로직
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
        // 2. 리뷰 목록 로드 (여기서 bookIsbn은 URL에서 가져온 isbn 변수입니다.)
        await fetchAndDisplayReviews(isbn); 
    } else {
         // 책 정보를 가져오지 못했을 때 오류 메시지를 표시합니다.
         bookDetailContainer.innerHTML = '<h2>책 상세 정보를 불러올 수 없습니다.</h2>';
    }

    // ----------------------------------------------------
    // [E] 리뷰 등록 이벤트 리스너
    // ----------------------------------------------------
    
    // 1. 별점 기능 구현 (클릭 시 별점 반영)
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

    // 2. 리뷰 등록 버튼 이벤트
    submitReviewBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('리뷰를 등록하려면 먼저 로그인해주세요.');
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

        // 3. Firestore에 직접 저장할 데이터
        const reviewData = {
            bookIsbn: cleanIsbn, 
            userId: auth.currentUser.email,
            rating: selectedRating,
            comment: reviewTextarea.value.trim(),
            timestamp: new Date().toISOString()
        };

        try {
            // 1. 리뷰 저장
            await addDoc(collection(db, "reviews"), reviewData);

            // 2. books 컬렉션의 통계 데이터 가져오기 및 업데이트
            const bookRef = doc(db, "books", cleanIsbn);
            const bookDoc = await getDoc(bookRef);
            
            let currentReviews = 0;
            let currentRatingSum = 0;
            
            const displayedTitle = document.querySelector('.detail-text h1').textContent.trim();
            const displayedImage = document.querySelector('.detail-image').src;
            
            if (bookDoc.exists()) {
                // 문서가 이미 존재하면 기존 통계 로드 및 업데이트 로직 유지
                const firestoreData = bookDoc.data();
                currentReviews = firestoreData.reviews || 0;
                currentRatingSum = firestoreData.ratingSum || 0;

                // 새 통계 계산
                const newReviews = currentReviews + 1;
                const newRatingSum = currentRatingSum + selectedRating;
                const newAverageRating = newRatingSum / newReviews;

                await updateDoc(bookRef, {
                    reviews: newReviews,
                    ratingSum: newRatingSum,
                    averageRating: newAverageRating
                });

            } else {
                const newReviews = 1;
                const newRatingSum = selectedRating;
                
                await setDoc(bookRef, {
                    isbn: cleanIsbn,
                    title: displayedTitle, 
                    image: displayedImage,
                    reviews: newReviews,
                    ratingSum: newRatingSum,
                    averageRating: newRatingSum / newReviews
                });
            }
            // 새 통계 계산
            const newReviews = currentReviews + 1;
            const newRatingSum = currentRatingSum + selectedRating;
            const newAverageRating = newRatingSum / newReviews;

            await updateDoc(bookRef, {
                reviews: newReviews,
                ratingSum: newRatingSum,
                averageRating: newAverageRating
            });

            alert('리뷰가 성공적으로 등록되었습니다.');
            reviewTextarea.value = '';
            selectedRating = 0;
            
            // 폼 초기화 및 화면 새로고침 (책 정보 및 리뷰 목록)
            fetchAndDisplayReviews(isbn); 
            fetchBookDetails(isbn); // 책 정보 및 통계 재로드

        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            alert('리뷰 등록 중 오류가 발생했습니다. (DB 연결 오류)');
        }
    });
});