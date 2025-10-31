// mypage.js (오류 수정된 최종 코드)

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, updateDoc, FieldValue, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

// [핵심] window.auth와 window.db가 로드될 때까지 기다립니다.
function initializeFirebaseInstances() {
    if (window.auth && window.db) {
        return { auth: window.auth, db: window.db };
    }
    // 0.1초마다 firebase-init.js가 로드되었는지 확인
    return new Promise(resolve => setTimeout(() => resolve(initializeFirebaseInstances()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // [핵심 수정]: Firebase 인스턴스를 기다려서 가져옵니다.
    const { auth, db } = await initializeFirebaseInstances();

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
    async function fetchUserReviews(userEmail, dbInstance) {
        reviewListContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';
        const serverUrl = 'https://bufs-book-review.onrender.com'; 

        try {
            const q = query(collection(dbInstance, "reviews"), where("userId", "==", userEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            // 리뷰 목록과 책 제목을 비동기로 가져옵니다.
            const reviewsWithTitles = querySnapshot.docs.map(async (document) => {
                const review = document.data();
                const reviewId = document.id;
                
                // Render 서버에 책 상세 정보를 요청
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                // [핵심 수정]: 서버 오류가 나도 제목만 기본값으로 처리
                const bookTitle = (bookDetail && bookDetail.title) ? bookDetail.title : '책 제목을 찾을 수 없음';

                return { 
                    review, 
                    reviewId, 
                    bookTitle, 
                    reviewDate: review.timestamp ? new Date(review.timestamp.toDate()).toLocaleDateString('ko-KR') : '날짜 없음'
                };
            });

            // 모든 비동기 작업(책 제목 가져오기)이 완료될 때까지 기다립니다.
            const finalReviews = await Promise.all(reviewsWithTitles);
            reviewListContainer.innerHTML = ''; // 목록 비우기

            // 최종 리뷰 데이터를 화면에 표시합니다.
            finalReviews.forEach((data) => {
                const { review, reviewId, bookTitle, reviewDate } = data;
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                reviewElement.dataset.reviewId = reviewId;
                
                // [핵심]: 삭제 시 사용할 개별 데이터를 dataset에 저장
                reviewElement.dataset.bookIsbn = review.bookIsbn;
                reviewElement.dataset.rating = review.rating;
                reviewElement.dataset.bookTitle = bookTitle;

                reviewElement.innerHTML = `
                    <h3 class="review-book-title">${bookTitle}</h3>
                    <p class="review-date">작성일: ${reviewDate}</p>
                    <p class="review-rating">${starsHtml}</p>
                    <p class="review-comment">${review.comment}</p>
                    <div class="review-actions">
                        <button class="edit-btn">수정</button>
                        <button class="delete-btn">삭제</button>
                    </div>
                    <hr>
                `;
                reviewListContainer.appendChild(reviewElement);
            });

            attachEventListeners(dbInstance, auth.currentUser.email); // 버튼에 이벤트 리스너 연결
        } catch (e) {
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다. (서버 연결 오류)</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
        }
    }

    // 3. 수정/삭제 버튼에 이벤트 리스너 연결
    function attachEventListeners(dbInstance, userEmail) {
        // [수정 기능]
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const commentElement = reviewItem.querySelector('.review-comment');
                const ratingElement = reviewItem.querySelector('.review-rating');
                const reviewId = reviewItem.dataset.reviewId;
                
                if (reviewItem.classList.contains('editing')) {
                    saveReview(reviewItem, reviewId, commentElement, ratingElement, dbInstance);
                } else {
                    enterEditMode(reviewItem, commentElement, ratingElement, btn);
                }
            });
        });
        
        // [삭제 기능]
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;

                // [핵심 수정]: JSON.parse 대신 dataset에서 직접 읽기
                const bookIsbn = reviewItem.dataset.bookIsbn;
                const deletedRating = parseInt(reviewItem.dataset.rating);
                const bookTitle = reviewItem.dataset.bookTitle;
                
                // 수정 모드 중 취소
                if (reviewItem.classList.contains('editing')) {
                    cancelEdit(reviewItem, userEmail, dbInstance);
                    return;
                }

                if (!bookIsbn || isNaN(deletedRating)) {
                    alert('오류: 리뷰 데이터(ISBN 또는 별점)가 누락되어 삭제할 수 없습니다.');
                    return;
                }
                
                if (confirm(`'${bookTitle}' 리뷰를 정말 삭제하시겠습니까?`)) {
                    try {
                        await updateBookStatsOnDelete(bookIsbn, deletedRating, dbInstance); 
                        await deleteDoc(doc(dbInstance, "reviews", reviewId));
                        
                        alert('리뷰가 삭제되었습니다.');
                        fetchUserReviews(userEmail, dbInstance); // 목록 새로고침
                    } catch (e) {
                        alert('삭제에 실패했습니다. (통계 업데이트 오류)');
                        console.error("삭제 실패:", e);
                    }
                }
            });
        });
    }

    // [수정 모드 진입 함수]
    function enterEditMode(item, comment, rating, editBtn) {
        item.classList.add('editing');
        const deleteBtn = item.querySelector('.delete-btn');
        const originalComment = comment.textContent;
        const currentRatingValue = (rating.textContent.match(/★/g) || []).length; 

        comment.innerHTML = `<textarea class="edit-textarea">${originalComment}</textarea>`;
        rating.innerHTML = createEditableStars(currentRatingValue);
        
        editBtn.textContent = '저장';
        deleteBtn.textContent = '취소';
        
        attachStarListeners(item, currentRatingValue);
    }
    
    // [별점 편집 UI 생성 함수]
    function createEditableStars(currentRating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="edit-star" data-rating="${i}">${i <= currentRating ? '★' : '☆'}</span>`;
        }
        return `<div class="edit-rating-stars" data-rating-value="${currentRating}">${starsHtml}</div>`;
    }
    
    // [별점 편집 이벤트 핸들러]
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

    // [수정 취소 함수]
    function cancelEdit(item) {
        fetchUserReviews(auth.currentUser.email, db); // 목록 새로고침으로 취소 처리
    }

    // [리뷰 저장 함수]
    async function saveReview(item, reviewId, commentElement, ratingElement, dbInstance) {
        const newComment = item.querySelector('.edit-textarea').value.trim();
        const newRating = parseInt(item.querySelector('.edit-rating-stars').dataset.ratingValue);

        try {
            const reviewRef = doc(dbInstance, "reviews", reviewId);
            await updateDoc(reviewRef, {
                comment: newComment,
                rating: newRating,
                timestamp: new Date().toISOString() 
            });

            // [핵심]: 수정한 별점도 통계에 반영
            const oldRating = (ratingElement.textContent.match(/★/g) || []).length;
            const bookIsbn = item.dataset.bookIsbn; // dataset에서 ISBN 가져오기
            await updateBookStatsOnEdit(bookIsbn, oldRating, newRating, dbInstance);

            alert('리뷰가 수정되었습니다.');
            fetchUserReviews(auth.currentUser.email, dbInstance); 
        } catch (e) {
            alert('수정에 실패했습니다. (권한 또는 DB 연결 확인)');
            console.error("리뷰 수정 실패:", e);
        }
    }

    // [리뷰 삭제 시 통계 업데이트 함수]
    async function updateBookStatsOnDelete(bookIsbn, deletedRating, dbInstance) {
        const bookRef = doc(dbInstance, "books", bookIsbn);
        const bookDoc = await getDoc(bookRef);

        if (!bookDoc.exists) return; 

        const firestoreData = bookDoc.data();
        const currentReviews = firestoreData.reviews || 0;
        const currentRatingSum = firestoreData.ratingSum || 0;

        if (currentReviews <= 0) return; 

        const newReviews = currentReviews - 1;
        const newRatingSum = currentRatingSum - deletedRating;
        const newAverageRating = newReviews > 0 ? (newRatingSum / newReviews) : 0;

        await updateDoc(bookRef, {
            reviews: newReviews,
            ratingSum: newRatingSum,
            averageRating: newAverageRating
        });
    }
    
    // [리뷰 수정 시 통계 업데이트 함수]
    async function updateBookStatsOnEdit(bookIsbn, oldRating, newRating, dbInstance) {
        const bookRef = doc(dbInstance, "books", bookIsbn);
        const bookDoc = await getDoc(bookRef);

        if (!bookDoc.exists) return;

        const firestoreData = bookDoc.data();
        const currentReviews = firestoreData.reviews || 0; // 리뷰 개수는 동일
        const currentRatingSum = firestoreData.ratingSum || 0;

        // 기존 별점을 빼고 새 별점을 더함
        const newRatingSum = (currentRatingSum - oldRating) + newRating;
        const newAverageRating = newRatingSum / currentReviews;

        await updateDoc(bookRef, {
            ratingSum: newRatingSum,
            averageRating: newAverageRating
        });
    }
});