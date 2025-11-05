// mypage.js (전체 교체)
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // [수정]: db, auth 인스턴스를 window에서 가져옵니다.
    const db = window.db; 
    const auth = window.auth;
    const serverUrl = 'https://bufs-book-review.onrender.com'; // 서버 URL

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

    // 2. [수정]: 사용자의 리뷰를 가져오는 함수 (ISBN, Rating 저장 로직 추가)
    async function fetchUserReviews(userEmail) {
        reviewListContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';

        try {
            // [참고]: 이 쿼리는 클라이언트에서 실행됩니다.
            const q = query(collection(db, "reviews"), where("userId", "==", userEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            const reviewsWithTitles = querySnapshot.docs.map(async (doc_snapshot) => {
                const review = doc_snapshot.data();
                const reviewId = doc_snapshot.id;
                
                // [참고]: 책 제목은 서버 API를 통해 가져옵니다.
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                const bookTitle = bookDetail.title || '책 제목을 찾을 수 없음';

                return { review, reviewId, bookTitle };
            });

            const finalReviews = await Promise.all(reviewsWithTitles);
            
            reviewListContainer.innerHTML = ''; 

            finalReviews.forEach((data) => {
                const { review, reviewId, bookTitle } = data;
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                
                // [핵심 수정]: data 속성에 API 호출에 필요한 정보를 저장합니다.
                reviewElement.dataset.reviewId = reviewId;
                reviewElement.dataset.bookIsbn = review.bookIsbn;      // <-- (추가)
                reviewElement.dataset.currentRating = review.rating; // <-- (추가)

                // [수정]: 원본 댓글 저장을 위해 data 속성 추가
                reviewElement.dataset.originalComment = review.comment;

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
    
    // 3. [수정]: 수정/삭제 버튼 이벤트 리스너 (API 호출로 변경)
    function attachEventListeners() {
        // [수정 기능]
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                
                if (reviewItem.classList.contains('editing')) {
                    // -> 수정 완료 (저장) 로직 실행
                    saveReview(reviewItem, reviewId); // [수정]
                } else {
                    // -> 수정 모드 진입
                    enterEditMode(reviewItem, btn); // [수정]
                }
            });
        });
        
        // [삭제 기능]
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                
                // 수정 모드 중 취소
                if (reviewItem.classList.contains('editing')) {
                    cancelEdit(reviewItem); // [수정]
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
                        // 데이터를 URL 쿼리 파라미터로 전송 (body 제거)
                        const response = await fetch(
                            `${serverUrl}/api/review-delete?reviewId=${reviewId}&bookIsbn=${bookIsbn}&deletedRating=${deletedRating}`, 
                            {
                                method: 'DELETE'
                                // headers와 body 속성 제거
                            }
                        );

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

    // [수정]: 수정 모드 진입 함수
    function enterEditMode(item, editBtn) {
        item.classList.add('editing');
        const deleteBtn = item.querySelector('.delete-btn');
        
        const commentElement = item.querySelector('.review-comment');
        const ratingElement = item.querySelector('.review-rating');

        // [수정]: data 속성에서 원본 값 가져오기
        const originalComment = item.dataset.originalComment;
        const currentRatingValue = parseInt(item.dataset.currentRating);

        // [수정]: 취소 시 복원을 위해 원본 HTML 저장
        item.dataset.originalRatingHtml = ratingElement.innerHTML;

        // 1. 코멘트 편집 창으로 변경
        commentElement.innerHTML = `<textarea class="edit-textarea">${originalComment}</textarea>`;
        
        // 2. 별점 편집 창으로 변경
        ratingElement.innerHTML = createEditableStars(currentRatingValue);
        
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
        // [수정]: data-rating-value에 현재 값을 저장
        return `<div class="edit-rating-stars" data-rating-value="${currentRating}">${starsHtml}</div>`;
    }
    
    // 별점 클릭 이벤트 핸들러
    function attachStarListeners(item, currentRating) {
        let newRating = parseInt(currentRating);
        const ratingContainer = item.querySelector('.edit-rating-stars');
        
        item.querySelectorAll('.edit-star').forEach(star => {
            star.addEventListener('click', () => {
                newRating = parseInt(star.dataset.rating);
                // [수정]: 컨테이너의 data-rating-value 업데이트
                ratingContainer.dataset.ratingValue = newRating;
                
                item.querySelectorAll('.edit-star').forEach((s, index) => {
                    s.textContent = (index < newRating) ? '★' : '☆';
                });
            });
        });
    }

    // [수정]: 수정 취소 함수 (원본 데이터로 복원)
    function cancelEdit(item) {
        item.classList.remove('editing');
        
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        const commentElement = item.querySelector('.review-comment');
        const ratingElement = item.querySelector('.review-rating');

        // 저장해둔 원본 값으로 복원
        commentElement.innerHTML = item.dataset.originalComment;
        ratingElement.innerHTML = item.dataset.originalRatingHtml;

        editBtn.textContent = '수정';
        deleteBtn.textContent = '삭제';
    }

    // [수정]: 리뷰 저장 함수 (서버 API 호출)
    async function saveReview(item, reviewId) {
        const newComment = item.querySelector('.edit-textarea').value.trim();
        const newRating = parseInt(item.querySelector('.edit-rating-stars').dataset.ratingValue);
        
        // data 속성에서 나머지 정보 가져오기
        const bookIsbn = item.dataset.bookIsbn;
        const oldRating = parseInt(item.dataset.currentRating); // 수정 전 별점

        if (!reviewId || !bookIsbn || isNaN(oldRating) || isNaN(newRating)) {
            alert('오류: 리뷰 정보를 저장할 수 없습니다. (데이터 누락)');
            return;
        }

        try {
            // [핵심 수정]: 서버의 수정 API 호출
            const response = await fetch(`${serverUrl}/api/review-edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewId: reviewId,
                    bookIsbn: bookIsbn,
                    newComment: newComment,
                    newRating: newRating,
                    oldRating: oldRating // 통계 계산을 위해 수정 전 별점 전송
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