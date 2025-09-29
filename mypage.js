// mypage.js (전체 내용 교체)

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// [핵심] window.auth와 window.db가 로드될 때까지 기다립니다.
function initializeFirebaseInstances() {
    if (window.auth && window.db) {
        return { auth: window.auth, db: window.db };
    }
    return new Promise(resolve => setTimeout(() => resolve(initializeFirebaseInstances()), 100));
}

document.addEventListener('DOMContentLoaded', async () => {
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
        reviewListContainer.innerHTML = '<p>리뷰를 불러오는 중입니다...</p>';
        
        try {
            const q = query(collection(dbInstance, "reviews"), where("userId", "==", userEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
                return;
            }

            reviewListContainer.innerHTML = ''; // 목록 비우기

            querySnapshot.forEach((doc) => {
                const review = doc.data();
                const reviewId = doc.id; 
                
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
            });

            attachEventListeners(dbInstance, auth.currentUser.email); // 이벤트 연결
        } catch (e) {
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
            console.error("리뷰 목록 가져오기 실패:", e);
        }
    }

    // 3. 수정/삭제 버튼에 이벤트 리스너 연결 함수
    function attachEventListeners(dbInstance, userEmail) {
        // 삭제 기능
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("정말 이 리뷰를 삭제하시겠습니까?")) {
                    const reviewId = e.target.closest('.user-review-item').dataset.reviewId;
                    try {
                        await deleteDoc(doc(dbInstance, "reviews", reviewId));
                        alert('리뷰가 삭제되었습니다.');
                        fetchUserReviews(userEmail, dbInstance); // 목록 새로고침
                    } catch (e) {
                        alert('삭제에 실패했습니다.');
                        console.error("삭제 실패:", e);
                    }
                }
            });
        });
        
        // 수정 기능 (간단한 알림창)
        document.querySelectorAll('.edit-btn').forEach(btn => {
             btn.addEventListener('click', () => {
                alert('수정 기능은 현재 개발 중입니다.'); 
            });
        });
    }
});