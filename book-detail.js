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
                let date = '날짜 없음';
                if (review.timestamp) {
                    if (typeof review.timestamp.toDate === 'function') {
                        // 1. Firestore Timestamp 객체 (수정된 리뷰)
                        date = review.timestamp.toDate().toLocaleDateString('ko-KR');
                    } else {
                        // 2. ISO String (최초 등록된 리뷰)
                        date = new Date(review.timestamp).toLocaleDateString('ko-KR');
                    }
                }
                
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
            // [수정 1] 사용자 ID(uid)와 email을 가져옵니다.
            const userId = auth.currentUser.uid;
            const userEmail = auth.currentUser.email;
            
            // [수정 2] "uid_isbn" 형식으로 고유한 문서 ID를 생성합니다.
            const docId = `${userId}_${cleanIsbn}`;
            const reviewRef = doc(db, "reviews", docId);

            // [수정 3] (클라이언트 검사) setDoc을 시도하기 전에,
            // 이 ID로 된 문서가 이미 있는지 확인합니다.
            const reviewDoc = await getDoc(reviewRef);
            if (reviewDoc.exists()) {
                alert('이미 이 책에 대한 리뷰를 작성했습니다.');
                return; // 등록 절차 중단
            }

            // [수정 4] 저장할 리뷰 데이터 (timestamp를 Date 객체로 저장)
            const reviewData = {
                bookIsbn: cleanIsbn, 
                userId: userEmail, // 마이페이지 쿼리를 위해 email 저장
                rating: selectedRating,
                comment: reviewTextarea.value.trim(),
                timestamp: new Date() // Date 객체로 저장 (Invalid Date 문제 해결)
            };

            // [수정 5] addDoc (랜덤 ID) 대신 setDoc (고유 ID)을 사용합니다.
            // 이것이 중복 등록을 막는 2번째 방어선(DB 레벨)입니다.
            await setDoc(reviewRef, reviewData);

            // [수정 6] 책 통계 업데이트 (기존 버그 수정)
            const bookRef = doc(db, "books", cleanIsbn);
            const bookDoc = await getDoc(bookRef);
            
            if (bookDoc.exists()) {
                // 6-1. 책이 이미 DB에 있으면, 통계를 +1 업데이트합니다.
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
                // 6-2. 책이 DB에 없으면(첫 리뷰), 새 문서를 생성합니다.
                const displayedTitle = document.querySelector('.detail-text h1').textContent.trim();
                const displayedImage = document.querySelector('.detail-image').src;
                
                await setDoc(bookRef, {
                    isbn: cleanIsbn,
                    title: displayedTitle, 
                    image: displayedImage,
                    reviews: 1,
                    ratingSum: selectedRating,
                    averageRating: selectedRating // 1로 나누나 마나
                });
            }

            alert('리뷰가 성공적으로 등록되었습니다.');
            
            // 폼 초기화
            reviewTextarea.value = '';
            ratingStars.forEach(s => s.classList.remove('selected'));
            selectedRating = 0;
            
            // 리뷰 목록과 책 상세 정보(통계)를 즉시 새로고침
            fetchAndDisplayReviews(isbn); 
            fetchBookDetails(isbn); 

        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            if (e.code === 'permission-denied') {
                alert('리뷰 등록에 실패했습니다. (DB 쓰기 권한 오류)');
            } else {
                alert('리뷰 등록 중 오류가 발생했습니다.');
            }
        }
    });
});