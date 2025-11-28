import { 
    getAuth, 
    onAuthStateChanged, 
    sendPasswordResetEmail, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db; 
    const auth = window.auth;
    const serverUrl = 'https://bufs-book-review.onrender.com'; 
    const reviewListContainer = document.getElementById('reviewList');
    const userStatusElement = document.getElementById('userStatus');

    function showButtonLoading(button, text = '로딩중...') {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML; 
        button.innerHTML = `<span class="button-loader"></span> ${text}`;
    }
    function hideButtonLoading(button) {
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml; 
        }
        button.disabled = false;
    }
    
    // ----------------------------------------------------
    // 1. 로그인 상태 확인
    // ----------------------------------------------------
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const displayName = user.displayName || user.email.split('@')[0];
            userStatusElement.textContent = `${displayName} 님의 리뷰 목록입니다.`;
            fetchUserReviews(user.uid, db); 
        } else {
            userStatusElement.innerHTML = '로그인이 필요합니다. <a href="auth.html">로그인 페이지로 이동</a>';
            reviewListContainer.innerHTML = '';
        }
    });

    // ----------------------------------------------------
    // 2. 리뷰 가져오기
    // ----------------------------------------------------
    async function fetchUserReviews(userUid) { 
        reviewListContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';

        try {
            const q = query(
                collection(db, "reviews"), 
                where("uid", "==", userUid),
                orderBy("timestamp", "desc") 
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            const reviewsWithTitles = querySnapshot.docs.map(async (doc_snapshot) => {
                const review = doc_snapshot.data();
                const reviewId = doc_snapshot.id;
                
                // 책 상세 정보 가져오기
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                const bookTitle = bookDetail.title || '책 제목을 찾을 수 없음';
                // [신규] 이미지 정보 가져오기 (없으면 기본 이미지)
                const bookImage = bookDetail.image || 'https://via.placeholder.com/120x170?text=No+Image';

                return { review, reviewId, bookTitle, bookImage };
            });

            const finalReviews = await Promise.all(reviewsWithTitles);
            
            reviewListContainer.innerHTML = ''; 

            finalReviews.forEach((data) => {
                const { review, reviewId, bookTitle, bookImage } = data;
                
                let date = '날짜 없음';
                if (review.timestamp) {
                    if (typeof review.timestamp.toDate === 'function') { 
                        date = review.timestamp.toDate().toLocaleDateString('ko-KR');
                    } else { 
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

                // [핵심 수정] Flexbox 구조로 변경 (이미지 왼쪽, 텍스트 오른쪽)
                reviewElement.innerHTML = `
                    <div class="review-left">
                        <a href="book-detail.html?isbn=${review.bookIsbn}">
                            <img src="${bookImage}" alt="${bookTitle}" class="review-book-img">
                        </a>
                    </div>
                    <div class="review-right">
                        <a href="book-detail.html?isbn=${review.bookIsbn}" class="book-title-link">
                            <h3 class="review-book-title">${bookTitle}</h3>
                        </a>
                        <p class="review-date">${date}</p>
                        <p class="review-rating">${starsHtml}</p>
                        <p class="review-comment">${review.comment}</p>
                        <div class="review-buttons">
                            <button class="edit-btn">수정</button>
                            <button class="delete-btn">삭제</button>
                        </div>
                    </div>
                `;
                reviewListContainer.appendChild(reviewElement);
            });

            attachEventListeners(); 
        } catch (e) {
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
            if (e.code === 'failed-precondition') {
                 reviewListContainer.innerHTML = '<p>(관리자) Firebase 색인이 필요합니다. F12 콘솔을 확인하세요.</p>';
            }
        }
    }
    
    
    // 3. 수정/삭제 버튼 (로딩 적용)
    function attachEventListeners() {
        // [수정] 버튼
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
        
        // [삭제] 버튼
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reviewItem = e.target.closest('.user-review-item');
                const reviewId = reviewItem.dataset.reviewId;
                const button = e.target;
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
                    showButtonLoading(button, '삭제중...'); 
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
                        fetchUserReviews(auth.currentUser.uid, db); 
                    } catch (e) {
                        alert('삭제에 실패했습니다: ' + e.message);
                        console.error("삭제 실패:", e);
                        hideButtonLoading(button); 
                    }
                }
            });
        });
    }

    // 4. 수정 모드 진입
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

    // 7. 수정 취소
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

    // 8. 리뷰 저장
    async function saveReview(item, reviewId) {
        const button = item.querySelector('.edit-btn');
        const newComment = item.querySelector('.edit-textarea').value.trim();
        const newRating = parseInt(item.querySelector('.edit-rating-stars').dataset.ratingValue);
        const bookIsbn = item.dataset.bookIsbn;
        const oldRating = parseInt(item.dataset.currentRating); 
        if (!reviewId || !bookIsbn || isNaN(oldRating) || isNaN(newRating)) {
            alert('오류: 리뷰 정보를 저장할 수 없습니다. (데이터 누락)');
            return;
        }
        showButtonLoading(button, '저장중...'); 
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
            fetchUserReviews(auth.currentUser.uid, db); 
        } catch (e) {
            alert('수정에 실패했습니다: ' + e.message);
            console.error("리뷰 수정 실패:", e);
            hideButtonLoading(button);
        }
    }
    
    const passwordResetBtn = document.getElementById('passwordResetBtn');
    if (passwordResetBtn) {
        passwordResetBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }
            showButtonLoading(passwordResetBtn, '메일 발송중...');
            try {
                await sendPasswordResetEmail(auth, auth.currentUser.email);
                alert('비밀번호 재설정 이메일을 발송했습니다. 이메일함을 확인해주세요.');
                hideButtonLoading(passwordResetBtn);
            } catch (error) {
                console.error("비밀번호 재설정 이메일 발송 실패:", error);
                alert('오류가 발생했습니다: ' + error.message);
                hideButtonLoading(passwordResetBtn);
            }
        });
    }
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }
            if (!confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                return;
            }
            if (!confirm(`[마지막 확인] '${auth.currentUser.email}' 계정의 모든 리뷰가 삭제됩니다. 계속하시겠습니까?`)) {
                return;
            }
            showButtonLoading(deleteAccountBtn, '삭제중...');
            try {
                const idToken = await auth.currentUser.getIdToken(true);
                const response = await fetch(`${serverUrl}/api/delete-account`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || '서버 응답 오류');
                }
                alert('계정이 성공적으로 삭제되었습니다. 이용해주셔서 감사합니다.');
                await signOut(auth); 
                window.location.href = 'index.html'; 
            } catch (error) {
                console.error("계정 삭제 실패:", error);
                alert('계정 삭제에 실패했습니다: ' + error.message);
                hideButtonLoading(deleteAccountBtn);
            }
        });
    }
    
    // ----------------------------------------------------
    // 닉네임 변경 기능
    // ----------------------------------------------------
    const nicknameChangeBtn = document.getElementById('nicknameChangeBtn');
    if (nicknameChangeBtn) {
        nicknameChangeBtn.addEventListener('click', async () => {
            if (!auth.currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }

            const oldNickname = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
            
            // 1. prompt 창으로 새 닉네임 입력받기
            const newNickname = prompt("새 닉네임을 입력하세요 (2~10자):", oldNickname);

            // 2. 유효성 검사 (클라이언트)
            if (!newNickname || newNickname.trim() === "") {
                return; // 취소
            }
            if (newNickname.trim() === oldNickname) {
                alert('현재 닉네임과 동일합니다.');
                return;
            }
            if (newNickname.trim().length < 2 || newNickname.trim().length > 10) {
                alert('닉네임은 2자 이상 10자 이하여야 합니다.');
                return;
            }

            showButtonLoading(nicknameChangeBtn, '변경중...');

            try {
                // 3. 서버 인증을 위한 ID 토큰 가져오기
                const idToken = await auth.currentUser.getIdToken();
                const cleanNickname = newNickname.trim();

                // 4. 서버의 닉네임 변경 API 호출
                const response = await fetch(`${serverUrl}/api/update-nickname`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        newNickname: cleanNickname
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || `서버 오류 (${response.status})`);
                }
                
                // 5. 성공 처리 (클라이언트)
                // 5-1. Auth 프로필 강제 새로고침
                await auth.currentUser.getIdToken(true); 
                
                // 5-2. 환영 메시지 업데이트
                userStatusElement.textContent = `${cleanNickname} 님의 리뷰 목록입니다.`;
                
                alert('닉네임이 성공적으로 변경되었습니다.');
                hideButtonLoading(nicknameChangeBtn);

            } catch (error) {
                console.error("닉네임 변경 실패:", error);
                alert('닉네임 변경에 실패했습니다: ' + error.message);
                hideButtonLoading(nicknameChangeBtn);
            }
        });
    }
    
});