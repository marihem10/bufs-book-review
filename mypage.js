import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db; 
    const auth = window.auth;
    const serverUrl = 'https://bufs-book-review.onrender.com'; 

    const reviewListContainer = document.getElementById('reviewList');
    const userStatusElement = document.getElementById('userStatus');
    
    // 1. 로그인 상태 확인
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userStatusElement.textContent = `${user.email} 님의 리뷰 목록입니다.`;
            fetchUserReviews(user.email, db); // db 인스턴스 전달
        } else {
            userStatusElement.innerHTML = '로그인이 필요합니다. <a href="auth.html">로그인 페이지로 이동</a>';
            reviewListContainer.innerHTML = '';
        }
    });

    // 2. 사용자의 리뷰를 가져오는 함수 (최신순 정렬, 날짜, 링크 추가)
    async function fetchUserReviews(userEmail) {
        reviewListContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';

        try {
            // [수정 1]: 'orderBy'를 추가하여 timestamp(작성일) 기준 내림차순(desc)으로 정렬합니다.
            const q = query(
                collection(db, "reviews"), 
                where("userId", "==", userEmail),
                orderBy("timestamp", "desc") // <-- 최신순 정렬
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            const reviewsWithTitles = querySnapshot.docs.map(async (doc_snapshot) => {
                const review = doc_snapshot.data();
                const reviewId = doc_snapshot.id;
                
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                const bookTitle = bookDetail.title || '책 제목을 찾을 수 없음';

                return { review, reviewId, bookTitle };
            });

            const finalReviews = await Promise.all(reviewsWithTitles);
            
            reviewListContainer.innerHTML = ''; 

            finalReviews.forEach((data) => {
                const { review, reviewId, bookTitle } = data;
                
                // [수정 2]: 날짜 처리 로직 (Invalid Date 방지)
                let date = '날짜 없음';
                if (review.timestamp) {
                    if (typeof review.timestamp.toDate === 'function') { // Firestore Timestamp 객체
                        date = review.timestamp.toDate().toLocaleDateString('ko-KR');
                    } else { // ISO String
                        date = new Date(review.timestamp).toLocaleDateString('ko-KR');
                    }
                }
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                
                reviewElement.dataset.reviewId = reviewId;
                reviewElement.dataset.bookIsbn = review.bookIsbn;      
                reviewElement.dataset.currentRating = review.rating; 
                reviewElement.dataset.originalComment = review.comment;

                // [수정 3]: HTML 구조 변경 (제목에 <a> 링크 추가, 날짜 <p> 추가)
                reviewElement.innerHTML = `
                    <a href="book-detail.html?isbn=${review.bookIsbn}" class="book-title-link">
                        <h3 class="review-book-title">${bookTitle}</h3>
                    </a>
                    <p class="review-date">${date}</p>
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
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
            
            // [중요] 색인 오류 시 사용자에게 힌트 제공
            if (e.code === 'failed-precondition') {
                 reviewListContainer.innerHTML = '<p>(관리자) Firebase 색인이 필요합니다. F12 콘솔을 확인하세요.</p>';
            }
        }
    }
    
    // 3. 수정/삭제 버튼 이벤트 리스너
    function attachEventListeners() {
        // [수정 기능]
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                
                if (reviewItem.classList.contains('editing')) {
                    saveReview(reviewItem, reviewId);
                } else {
                    enterEditMode(reviewItem, btn);
                }
            });
        });
        
        // [삭제 기능]
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                
                if (reviewItem.classList.contains('editing')) {
                    cancelEdit(reviewItem);
                    return;
                }

                if (!reviewId) {
                    alert('오류: 리뷰 ID를 찾을 수 없습니다.');
                    return;
                }
                
                if (confirm(`이 리뷰를 정말 삭제하시겠습니까?`)) {
                    const bookIsbn = reviewItem.dataset.bookIsbn;
                    const deletedRating = parseInt(reviewItem.dataset.currentRating);

                    if (!bookIsbn || isNaN(deletedRating)) {
                        alert('오류: 리뷰 데이터(ISBN 또는 별점)가 유효하지 않아 통계를 업데이트할 수 없습니다.');
                        return;
                    }

                    try {
                        const requestUrl = `${serverUrl}/api/review-delete?reviewId=${reviewId}&bookIsbn=${bookIsbn}&deletedRating=${deletedRating}`;
                        console.log('서버에 삭제 요청:', requestUrl);

                        const response = await fetch(requestUrl, {
                            method: 'DELETE'
                        });

                        if (!response.ok) {
                            const err = await response.json();
                            throw new Error(err.error || '서버 통신 오류');
                        }
                        
                        alert('리뷰가 삭제되었습니다.');
                        fetchUserReviews(auth.currentUser.email, db); // 목록 새로고침

                    } catch (e) {
                        alert('삭제에 실패했습니다: ' + e.message);
                        console.error("삭제 실패:", e);
                    }
                }
            });
        });
    }

    // 4. 수정 모드 진입 함수
    function enterEditMode(item, editBtn) {
        item.classList.add('editing');
        const deleteBtn = item.querySelector('.delete-btn');
        
        const commentElement = item.querySelector('.review-comment');
        const ratingElement = item.querySelector('.review-rating');

        const originalComment = item.dataset.originalComment;
        const currentRatingValue = parseInt(item.dataset.currentRating);

        item.dataset.originalRatingHtml = ratingElement.innerHTML;

        commentElement.innerHTML = `<textarea class="edit-textarea">${originalComment}</textarea>`;
        ratingElement.innerHTML = createEditableStars(currentRatingValue);
        
        editBtn.textContent = '저장';
        deleteBtn.textContent = '취소';
        
        attachStarListeners(item, currentRatingValue);
    }
    
    // 5. 별점 편집 기능
    function createEditableStars(currentRating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="edit-star" data-rating="${i}">${i <= currentRating ? '★' : '☆'}</span>`;
        }
        return `<div class="edit-rating-stars" data-rating-value="${currentRating}">${starsHtml}</div>`;
    }
    
    // 6. 별점 클릭 핸들러 
    function attachStarListeners(item, currentRating) {
        let newRating = parseInt(currentRating);
        const ratingContainer = item.querySelector('.edit-rating-stars');
        
        item.querySelectorAll('.edit-star').forEach(star => {
            star.addEventListener('click', () => {
                newRating = parseInt(star.dataset.rating);
                ratingContainer.dataset.ratingValue = newRating;
                
                item.querySelectorAll('.edit-star').forEach((s, index) => {
                    s.textContent = (index < newRating) ? '★' : '☆';
                });
            });
        });
    }

    // 7. 수정 취소 함수 
    function cancelEdit(item) {
        item.classList.remove('editing');
        
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        const commentElement = item.querySelector('.review-comment');
        const ratingElement = item.querySelector('.review-rating');

        commentElement.innerHTML = item.dataset.originalComment;
        ratingElement.innerHTML = item.dataset.originalRatingHtml;

        editBtn.textContent = '수정';
        deleteBtn.textContent = '삭제';
    }

    // 8. 리뷰 저장 함수 
    async function saveReview(item, reviewId) {
        const newComment = item.querySelector('.edit-textarea').value.trim();
        const newRating = parseInt(item.querySelector('.edit-rating-stars').dataset.ratingValue);
        
        const bookIsbn = item.dataset.bookIsbn;
        const oldRating = parseInt(item.dataset.currentRating); 

        if (!reviewId || !bookIsbn || isNaN(oldRating) || isNaN(newRating)) {
            alert('오류: 리뷰 정보를 저장할 수 없습니다. (데이터 누락)');
            return;
        }

        try {
            const response = await fetch(`${serverUrl}/api/review-edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewId: reviewId,
                    bookIsbn: bookIsbn,
                    newComment: newComment,
                    newRating: newRating,
                    oldRating: oldRating
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || '서버 통신 오류');
            }

            alert('리뷰가 수정되었습니다.');
            fetchUserReviews(auth.currentUser.email, db); // 목록 새로고침
        } catch (e) {
            alert('수정에 실패했습니다: ' + e.message);
            console.error("리뷰 수정 실패:", e);
        }
    }
});