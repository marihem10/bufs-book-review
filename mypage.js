// mypage.js

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const reviewListContainer = document.getElementById('reviewList');
    const userStatusElement = document.getElementById('userStatus');
    
    const db = window.db; 
    const auth = window.auth; 

    if (!auth) {
        userStatusElement.textContent = '로그인 정보를 불러올 수 없습니다. 다시 로그인해 주세요.';
        return;
    }

    // 1. 로그인 상태 확인 및 리뷰 목록 로드
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userStatusElement.textContent = `${user.email} 님의 리뷰 목록입니다.`;
            fetchUserReviews(user.email);
        } else {
            userStatusElement.innerHTML = '로그인이 필요합니다. <a href="auth.html">로그인 페이지로 이동</a>';
            reviewListContainer.innerHTML = '';
        }
    });

    // 2. 현재 사용자의 리뷰를 Firestore에서 가져오는 함수
    async function fetchUserReviews(userEmail) {
        reviewListContainer.innerHTML = '<p>리뷰를 불러오는 중입니다...</p>';
        
        try {
            // Firestore 쿼리: bookIsbn 대신 userId 필드를 사용해 필터링합니다.
            const q = query(collection(db, "reviews"), where("userId", "==", userEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            reviewListContainer.innerHTML = ''; // 목록 비우기

            querySnapshot.forEach((doc) => {
                const review = doc.data();
                const reviewId = doc.id; // Firestore 문서 ID (수정/삭제에 필요)
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

                const reviewElement = document.createElement('div');
                reviewElement.classList.add('user-review-item');
                reviewElement.dataset.reviewId = reviewId;

                reviewElement.innerHTML = `
                    <h3>${review.bookTitle || '책 제목 불러오는 중...'}</h3>
                    <p class="review-rating">${starsHtml}</p>
                    <p>${review.comment}</p>
                    <button class="edit-btn">수정</button>
                    <button class="delete-btn">삭제</button>
                    <hr>
                `;
                reviewListContainer.appendChild(reviewElement);

                // 책 제목 정보가 없으므로 book-detail 엔드포인트를 호출하여 제목을 가져와 업데이트하는 로직이 필요합니다.
                // 이 부분은 복잡해지므로, 현재는 Firestroe에 저장된 bookTitle 필드를 사용한다고 가정하겠습니다.
            });

            attachEventListeners(); // 버튼에 이벤트 리스너 연결
        } catch (e) {
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
        }
    }

    // 3. 수정/삭제 버튼에 이벤트 리스너 연결
    function attachEventListeners() {
        // 삭제 기능
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("정말 이 리뷰를 삭제하시겠습니까?")) {
                    const reviewId = e.target.closest('.user-review-item').dataset.reviewId;
                    try {
                        await deleteDoc(doc(db, "reviews", reviewId));
                        alert('리뷰가 삭제되었습니다.');
                        fetchUserReviews(auth.currentUser.email); // 목록 새로고침
                    } catch (e) {
                        alert('삭제에 실패했습니다.');
                        console.error("삭제 실패:", e);
                    }
                }
            });
        });
        
        // 수정 기능 (간단한 알림창으로 대체, 실제 폼 수정은 복잡함)
        document.querySelectorAll('.edit-btn').forEach(btn => {
             btn.addEventListener('click', () => {
                alert('수정 기능은 현재 개발 중입니다.'); 
                // 실제 수정 기능을 구현하려면 팝업창이나 인라인 편집 폼이 필요합니다.
            });
        });
    }

    // [중요]: 이 코드가 작동하려면 index.html에 Firestore가 초기화되어 window.db가 정의되어 있어야 합니다.
});