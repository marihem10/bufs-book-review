// book-detail.js (최종 안정화 버전)

// 필요한 Firebase 모듈을 명확히 import 합니다.
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL에서 ISBN 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');

    const bookDetailContainer = document.getElementById('bookDetail');
    const backButton = document.getElementById('backButton');
    const detailLoginLink = document.querySelector('.user-controls .nav-item-detail');
    
    // [핵심 수정]: Firebase 인스턴스 전역에서 가져오기
    const db = window.db; 
    const auth = window.auth; 
    
    // 리뷰 관련 요소
    const reviewTextarea = document.getElementById('reviewText');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    const userReviewsContainer = document.getElementById('userReviews');
    let selectedRating = 0;

    if (!isbn) {
        bookDetailContainer.innerHTML = '<h2>오류: 책 정보를 찾을 수 없습니다.</h2>';
        return;
    }
    
    // 뒤로가기 기능
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back(); 
        });
    }


    // ----------------------------------------------------
    // 2. Auth 상태 및 로그아웃 (인증 인스턴스가 전역에 있다고 가정)
    // ----------------------------------------------------
    if (auth && detailLoginLink) {
        onAuthStateChanged(auth, (user) => {
            // 이 로직은 index-auth.js에 이미 있으므로, 여기서는 리뷰 폼 제어만 합니다.
            // (편의상 코드를 간소화하고 전역 스크립트에 의존합니다.)
        });
    }

    const serverUrl = 'https://bufs-book-review.onrender.com';
    
    // ----------------------------------------------------
    // 3. 리뷰 등록 기능
    // ----------------------------------------------------
    // 1. 별점 기능 (클릭 시 별점 반영)
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

        const cleanIsbn = isbn ? isbn.replace(/\D/g, '').trim() : ''; 
        if (cleanIsbn.length !== 13) { 
            alert('오류: 책 정보(ISBN)가 유효하지 않습니다. 13자리 숫자를 확인해주세요.');
            return;
        }

        const reviewData = {
            bookIsbn: cleanIsbn, 
            userId: auth.currentUser.email, // 전역 auth.currentUser 사용
            rating: selectedRating,
            comment: reviewTextarea.value.trim()
        };

        try {
            // Render 서버의 /api/review-submit 엔드포인트에 POST 요청
            const response = await fetch(`${serverUrl}/api/review-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reviewData)
            });

            const result = await response.json();

            if (response.status !== 200) {
                alert('리뷰 등록 실패: ' + (result.error || '알 수 없는 서버 오류'));
                return;
            }
            
            alert('리뷰가 성공적으로 등록되었습니다.');
            reviewTextarea.value = '';
            selectedRating = 0;
            fetchAndDisplayReviews(isbn); // 리뷰 목록 새로고침
        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            alert('리뷰 등록 중 오류가 발생했습니다.');
        }
    });

    // ----------------------------------------------------
    // 4. 책 상세 정보 로딩 및 리뷰 표시 (비동기 함수)
    // ----------------------------------------------------
    async function fetchBookDetails(isbn) {
        // ... (기존 fetchBookDetails 함수 내용 유지) ...
    }

    async function fetchAndDisplayReviews(bookIsbn) {
        // ... (기존 fetchAndDisplayReviews 함수 내용 유지) ...
    }

    const book = await fetchBookDetails(isbn);
    if (book) {
        // ... (책 상세 정보 HTML 생성 로직 유지) ...
        fetchAndDisplayReviews(isbn); // 리뷰 목록 로드
    }
});