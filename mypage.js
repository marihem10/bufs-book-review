import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, updateDoc, FieldValue } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

//window.auth와 window.db가 로드될 때까지 기다립니다.
function initializeFirebaseInstances() {
    if (window.auth && window.db) {
        return { auth: window.auth, db: window.db };
    }
    return new Promise(resolve => setTimeout(() => resolve(initializeFirebaseInstances()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db; 
    const auth = window.auth;

    const reviewListContainer = document.getElementById('reviewList');
    const userStatusElement = document.getElementById('userStatus');
    
    // 1. 로그인 상태 확인 및 리뷰 목록 로드
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userStatusElement.textContent = `${user.email} 님의 리뷰 목록입니다.`;
            fetchUserReviews(user.email, db); // db 인스턴스 전달
        } else {
            userStatusElement.innerHTML = '로그인이 필요합니다. <a href="auth.html">로그인 페이지로 이동</a>';
            reviewListContainer.innerHTML = '';
        }
    });

    // 2. 현재 사용자의 리뷰를 Firestore에서 가져오는 함수
    async function fetchUserReviews(userEmail) {
        reviewListContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';
        const serverUrl = 'https://bufs-book-review.onrender.com'; // 서버 URL 재정의

        try {
            const q = query(collection(db, "reviews"), where("userId", "==", userEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            // 리뷰 데이터를 모두 가져와서 Promise 배열로 변환
            const reviewsWithTitles = querySnapshot.docs.map(async (doc) => {
                const review = doc.data();
                const reviewId = doc.id;
                
                // [핵심 로직]: Render 서버에 책 상세 정보를 요청합니다.
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                // 책 제목을 가져오지 못하면 기본값 사용
                const bookTitle = bookDetail.title || '책 제목을 찾을 수 없음';

                return { review, reviewId, bookTitle };
            });

            // 모든 비동기 작업(책 제목 가져오기)이 완료될 때까지 기다립니다.
            const finalReviews = await Promise.all(reviewsWithTitles);
            
            reviewListContainer.innerHTML = ''; // 목록 비우기

            finalReviews.forEach((data) => {
                const { review, reviewId, bookTitle } = data;
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                reviewElement.dataset.reviewId = reviewId;

                reviewElement.innerHTML = `
                    <h3 class="review-book-title">${bookTitle}</h3>
                    <p class="review-rating">${starsHtml}</p>
                    <p class="review-comment">${review.comment}</p>
                    <button class="edit-btn">수정</button>
                    <button class="delete-btn">삭제</button>
                    <hr>
                `;
                reviewListContainer.appendChild(reviewElement);
            });

            attachEventListeners(); // 버튼에 이벤트 리스너 연결
        } catch (e) {
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다. (서버 연결 오류)</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
        }
    }
// 3. 수정/삭제 버튼에 이벤트 리스너 연결
    function attachEventListeners() {
        // [수정 기능]
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const commentElement = reviewItem.querySelector('.review-comment');
                const ratingElement = reviewItem.querySelector('.review-rating');
                const reviewId = reviewItem.dataset.reviewId;
                
                // 이미 수정 모드인지 확인
                if (reviewItem.classList.contains('editing')) {
                    // -> 수정 완료 (저장) 로직 실행
                    saveReview(reviewItem, reviewId, commentElement, ratingElement);
                } else {
                    // -> 수정 모드 진입
                    enterEditMode(reviewItem, commentElement, ratingElement, btn);
                }
            });
        });
        
        // [삭제 기능]
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                
                // JSON.parse를 시도하고, 실패하면 null 처리
                const reviewDataJson = reviewItem.dataset.reviewData;
                let reviewData = null;
                try {
                    reviewData = JSON.parse(reviewDataJson);
                } catch (e) {
                    // JSON.parse 실패 시 (데이터 없음)
                    alert('오류: 리뷰 데이터 파싱에 실패했습니다. 페이지를 새로고침해주세요.');
                    return; 
                }
                
                if (!reviewData || !reviewData.bookIsbn || typeof reviewData.rating !== 'number') {
                    alert('오류: 리뷰 데이터(ISBN 또는 별점)가 누락되어 삭제할 수 없습니다.');
                    return;
                }

                if (confirm(`'${reviewData.bookTitle}' 리뷰를 정말 삭제하시겠습니까?`)) {
                    try {
                        const bookIsbn = reviewData.bookIsbn;
                        
                        await deleteDoc(doc(db, "reviews", reviewId));
                        await updateBookStatsOnDelete(bookIsbn, reviewData.rating); // 통계 업데이트
                        
                        alert('리뷰가 삭제되었습니다.');
                        fetchUserReviews(auth.currentUser.email); // 목록 새로고침
                    } catch (e) {
                        alert('삭제에 실패했습니다. (DB 권한 확인)');
                        console.error("삭제 실패:", e);
                    }
                }
            });
        });
    }

    // 수정 모드 진입 함수
    function enterEditMode(item, comment, rating, editBtn) {
        item.classList.add('editing');
        const deleteBtn = item.querySelector('.delete-btn');

        // 1. 코멘트 편집 창으로 변경
        const originalComment = comment.textContent;
        comment.innerHTML = `<textarea class="edit-textarea">${originalComment}</textarea>`;
        
        // 2. 별점 편집 창으로 변경
        const currentRatingValue = rating.dataset.currentRating;
        rating.innerHTML = createEditableStars(currentRatingValue);
        
        // 3. 버튼 텍스트 변경
        editBtn.textContent = '저장';
        deleteBtn.textContent = '취소';
        
        // 별점 이벤트 재연결
        attachStarListeners(item, currentRatingValue);
    }
    
    // 별점 편집 기능 연결 함수
    function createEditableStars(currentRating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="edit-star" data-rating="${i}">${i <= currentRating ? '★' : '☆'}</span>`;
        }
        return `<div class="edit-rating-stars" data-rating-value="${currentRating}">${starsHtml}</div>`;
    }
    
    // 별점 클릭 이벤트 핸들러
    function attachStarListeners(item, currentRating) {
        let newRating = parseInt(currentRating);
        item.querySelectorAll('.edit-star').forEach(star => {
            star.addEventListener('click', () => {
                newRating = parseInt(star.dataset.rating);
                item.querySelector('.edit-rating-stars').dataset.ratingValue = newRating;
                item.querySelectorAll('.edit-star').forEach((s, index) => {
                    s.textContent = (index < newRating) ? '★' : '☆';
                });
            });
        });
    }

    // 수정 취소 함수
    function cancelEdit(item) {
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        const review = item.dataset.originalReview; // 원래 리뷰 데이터가 필요

        //저장 후 fetchUserReviews로 목록 전체를 다시 불러옵니다.
        fetchUserReviews(auth.currentUser.email);
    }

    // 리뷰 저장 함수
    async function saveReview(item, reviewId, commentElement, ratingElement) {
        const newComment = item.querySelector('.edit-textarea').value.trim();
        const newRating = parseInt(item.querySelector('.edit-rating-stars').dataset.ratingValue);

        try {
            const reviewRef = doc(db, "reviews", reviewId);
            await updateDoc(reviewRef, {
                comment: newComment,
                rating: newRating,
                timestamp: new Date().toISOString() 
            });
            alert('리뷰가 수정되었습니다.');
            fetchUserReviews(auth.currentUser.email); // 목록 새로고침
        } catch (e) {
            alert('수정에 실패했습니다. (권한 또는 DB 연결 확인)');
            console.error("리뷰 수정 실패:", e);
        }
    }
});
    async function updateBookStatsOnDelete(bookIsbn, deletedRating) {
        const bookRef = doc(db, "books", bookIsbn);
        const bookDoc = await getDoc(bookRef);

        if (!bookDoc.exists) return; // 책 정보가 없다면 무시

        const firestoreData = bookDoc.data();
        const currentReviews = firestoreData.reviews || 0;
        const currentRatingSum = firestoreData.ratingSum || 0;

        if (currentReviews <= 0) return; // 이미 리뷰가 0개 이하라면 무시

        // 새 통계 계산
        const newReviews = currentReviews - 1;
        const newRatingSum = currentRatingSum - deletedRating;
        const newAverageRating = newReviews > 0 ? (newRatingSum / newReviews) : 0; // 0개일 때 0으로 설정

        // Firestore에 통계 업데이트
        await updateDoc(bookRef, {
            reviews: newReviews,
            ratingSum: newRatingSum,
            averageRating: newAverageRating
        });
        
    }
        querySnapshot.forEach((document) => {
                const review = document.data();
                const reviewId = document.id; 
                
                // ... (HTML 생성 코드 유지) ...

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                reviewElement.dataset.reviewId = reviewId;
                
                // [핵심 수정]: 삭제 시 사용할 리뷰 데이터를 문자열로 저장
                reviewElement.dataset.reviewData = JSON.stringify({
                    bookIsbn: review.bookIsbn,
                    bookTitle: review.bookTitle || '책 제목 불러오는 중...',
                    rating: review.rating, // ★★★ 이 rating 값이 정확해야 합니다. ★★★
                    comment: review.comment 
                });
            });