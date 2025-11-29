import { getAuth, onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy , deleteDoc} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db; 
    const auth = window.auth;
    const serverUrl = 'https://bufs-book-review.onrender.com'; 
    const reviewListContainer = document.getElementById('reviewList');
    const userStatusElement = document.getElementById('userStatus');
    const paginationContainer = document.getElementById('myPagePagination'); // 페이지네이션 요소
    const tabMyReviews = document.getElementById('tabMyReviews');
    const tabMyWishlist = document.getElementById('tabMyWishlist');
    const sectionMyReviews = document.getElementById('sectionMyReviews');
    const sectionMyWishlist = document.getElementById('sectionMyWishlist');
    const wishlistContainer = document.getElementById('wishlistContainer');
    const tabMyReading = document.getElementById('tabMyReading');
    const sectionMyReading = document.getElementById('sectionMyReading');
    const readingContainer = document.getElementById('readingContainer');
    const reviewPagination = document.getElementById('reviewPagination');
    const readingPagination = document.getElementById('readingPagination');
    const wishlistPagination = document.getElementById('wishlistPagination');

    // 페이지네이션 관련 변수
    let allReviewsData = []; // 가져온 모든 리뷰를 저장할 곳
    let currentPage = 1;     // 현재 페이지
    const itemsPerPage = 5;  // 한 페이지당 보여줄 리뷰 수
    // 데이터 저장용 변수들 (각각 따로 관리)
    let reviewsData = [];
    let readingData = [];
    let wishlistData = [];
    // 현재 페이지 상태 (각각 따로 관리)
    let reviewsPage = 1;
    let readingPage = 1;
    let wishlistPage = 1;
    // 한 페이지당 보여줄 개수
    const REVIEWS_PER_PAGE = 5;  // 리뷰는 5개씩
    // 화면 너비가 768px 이하(모바일)면 6개, 아니면 12개 반환
    function getGridPerPage() {
        return window.innerWidth <= 768 ? 6 : 12;
    }

    let currentNickname = ''; // 닉네임 저장용 변수

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
            currentNickname = displayName; // 변수에 닉네임 저장
            userStatusElement.textContent = `${displayName} 님의 리뷰 목록입니다.`; // 기본 문구
            fetchUserReviews(user.uid, db);
            
            // [신규] 알림 불러오기 함수 호출
            fetchNotifications(user.uid); 
        } else {
            userStatusElement.innerHTML = '로그인이 필요합니다. <a href="auth.html">로그인 페이지로 이동</a>';
            reviewListContainer.innerHTML = '';
        }
    });

    // ----------------------------------------------------
    // 2. 리뷰 데이터 가져오기 (수정됨: 그리기 로직 분리)
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
                paginationContainer.innerHTML = ''; // 페이지네이션도 비움
                return;
            }

            // 데이터를 먼저 다 가공해서 배열에 담습니다.
            const reviewsWithTitles = querySnapshot.docs.map(async (doc_snapshot) => {
                const review = doc_snapshot.data();
                const reviewId = doc_snapshot.id;
                
                // 책 정보 가져오기
                const response = await fetch(`${serverUrl}/api/book-detail?isbn=${review.bookIsbn}`);
                const bookDetail = await response.json();
                
                const bookTitle = bookDetail.title || '책 제목을 찾을 수 없음';
                const bookImage = bookDetail.image || 'https://via.placeholder.com/120x170?text=No+Image';

                return { review, reviewId, bookTitle, bookImage };
            });

            // 전역 변수에 데이터를 저장하고, 1페이지를 그립니다.
            allReviewsData = await Promise.all(reviewsWithTitles);
            
            currentPage = 1; // 페이지 초기화
            renderPage(currentPage); // 1페이지 그리기 함수 호출

        } catch (e) {
            console.error("리뷰 목록 가져오기 실패:", e);
            reviewListContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
        }
    }

    // ----------------------------------------------------
    // 내 리뷰 화면 그리기 (공통 페이지네이션 적용)
    // ----------------------------------------------------
    function renderPage(page) {
        reviewsPage = page; // 현재 페이지 변수 업데이트
        reviewListContainer.innerHTML = ''; // 목록 비우기

        // 데이터가 없을 때 처리
        if (allReviewsData.length === 0) {
            reviewListContainer.innerHTML = '<p>작성하신 리뷰가 없습니다.</p>';
            reviewPagination.innerHTML = ''; // 버튼도 비움
            return;
        }

        // 1. 데이터 자르기 (5개씩)
        const startIndex = (page - 1) * REVIEWS_PER_PAGE;
        const endIndex = startIndex + REVIEWS_PER_PAGE;
        const currentItems = allReviewsData.slice(startIndex, endIndex);

        // 2. 리뷰 아이템 그리기
        currentItems.forEach((data) => {
            const { review, reviewId, bookTitle, bookImage } = data;
            
            let date = '날짜 없음';
            if (review.timestamp) {
                if (typeof review.timestamp.toDate === 'function') { 
                    date = review.timestamp.toDate().toLocaleString('ko-KR');
                } else { 
                    date = new Date(review.timestamp).toLocaleString('ko-KR');
                }
            }
            const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

            const reviewElement = document.createElement('div');
            reviewElement.classList.add('user-review-item');
            reviewElement.dataset.reviewId = reviewId;
            reviewElement.dataset.bookIsbn = review.bookIsbn;      
            reviewElement.dataset.currentRating = review.rating; 
            reviewElement.dataset.originalComment = review.comment;

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

        // 3. 버튼 이벤트 다시 연결
        attachEventListeners(); 

        // 4. [핵심] 페이지네이션 버튼 생성 (이제 reviewPagination 안에 그려집니다!)
        renderPaginationUI(allReviewsData.length, REVIEWS_PER_PAGE, page, reviewPagination, renderPage);
    }
    
    // ----------------------------------------------------
    // 수정/삭제 버튼
    // ----------------------------------------------------
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
    // 페이지네이션 버튼 그리기 함수
    // ----------------------------------------------------
    function renderPaginationUI(totalItems, itemsPerPage, currentPage, targetContainer, renderFunction) {
        targetContainer.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        if (totalPages <= 1) return; // 1페이지뿐이면 버튼 숨김

        // (1) 이전 버튼
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '«';
            prevBtn.className = 'page-btn';
            prevBtn.onclick = () => renderFunction(currentPage - 1);
            targetContainer.appendChild(prevBtn);
        }

        // (2) 숫자 버튼
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.onclick = () => renderFunction(i);
            targetContainer.appendChild(btn);
        }

        // (3) 다음 버튼
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '»';
            nextBtn.className = 'page-btn';
            nextBtn.onclick = () => renderFunction(currentPage + 1);
            targetContainer.appendChild(nextBtn);
        }
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
    
    // ----------------------------------------------------
    // 알림 불러오기 및 삭제 함수
    // ----------------------------------------------------
    async function fetchNotifications(userUid) {
        const notiSection = document.getElementById('notificationSection');
        const notiList = document.getElementById('notificationList');
        
        // 나에게 온 알림 중, 읽지 않은(read == false) 것만 가져옴 (최신순)
        const q = query(
            collection(db, "notifications"), 
            where("targetUid", "==", userUid),
            // where("read", "==", false), // (선택) 읽은 것도 보여주려면 이 줄 삭제
            orderBy("timestamp", "desc")
        );

        try {
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                notiSection.style.display = 'none'; // 알림 없으면 숨김
                return;
            }
            
            notiSection.style.display = 'block'; // 알림 있으면 보임
            notiList.innerHTML = '';

            snapshot.forEach(docSnap => {
                const noti = docSnap.data();
                const li = document.createElement('li');
                li.classList.add('noti-item');
                
                li.innerHTML = `
                    <a href="${noti.link}" class="noti-link">
                        ${noti.message}
                    </a>
                    <button class="noti-close-btn" data-id="${docSnap.id}">×</button>
                `;
                notiList.appendChild(li);
            });
            

            // 알림 삭제(닫기) 버튼 이벤트
            document.querySelectorAll('.noti-close-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const notiId = e.target.dataset.id;
                    // Firestore에서 알림 문서 삭제
                    await deleteDoc(doc(db, "notifications", notiId));
                    e.target.closest('.noti-item').remove(); // 화면에서 제거
                    
                    // 다 지웠으면 섹션 숨김
                    if (notiList.children.length === 0) {
                        notiSection.style.display = 'none';
                    }
                });
            });

        } catch (e) {
            console.error("알림 로딩 실패:", e);
            // 색인 오류가 날 수 있으므로 콘솔 확인 필요
            if (e.code === 'failed-precondition') {
                console.log('알림 쿼리 색인이 필요합니다. 콘솔 링크 확인');
            }
        }
    }
    // ----------------------------------------------------
    // 탭
    // ----------------------------------------------------
    // 1. [내 리뷰] 탭 클릭 시
    tabMyReviews.addEventListener('click', () => {
        // 1. 스타일 활성화/비활성화
        tabMyReviews.classList.add('active');
        tabMyReading.classList.remove('active');   // [추가됨] 읽는 중 끄기
        tabMyWishlist.classList.remove('active');  // 읽고 싶어요 끄기

        // 2. 섹션 보이기/숨기기
        sectionMyReviews.style.display = 'block';
        sectionMyReading.style.display = 'none';   // [추가됨] 읽는 중 숨기기
        sectionMyWishlist.style.display = 'none';

        // 3. 멘트 변경
        if (currentNickname) {
            userStatusElement.textContent = `${currentNickname} 님의 리뷰 목록입니다.`;
        }
    });

    // 2. [읽는 중] 탭 클릭 시
    tabMyReading.addEventListener('click', () => {
        // 1. 스타일 활성화/비활성화
        tabMyReading.classList.add('active');
        tabMyReviews.classList.remove('active');   // 내 리뷰 끄기
        tabMyWishlist.classList.remove('active');  // 읽고 싶어요 끄기
        
        // 2. 섹션 보이기/숨기기
        sectionMyReading.style.display = 'grid';   
        sectionMyReviews.style.display = 'none';
        sectionMyWishlist.style.display = 'none';

        // 3. 멘트 변경
        if (currentNickname) {
            userStatusElement.textContent = `${currentNickname} 님이 읽고 있는 책입니다.`;
        }
        
        fetchMyReading(); // 데이터 가져오기
    });

    // 3. [읽고 싶어요] 탭 클릭 시
    tabMyWishlist.addEventListener('click', () => {
        // 1. 스타일 활성화/비활성화
        tabMyWishlist.classList.add('active');
        tabMyReviews.classList.remove('active');   // 내 리뷰 끄기
        tabMyReading.classList.remove('active');   // [추가됨] 읽는 중 끄기

        // 2. 섹션 보이기/숨기기
        sectionMyWishlist.style.display = 'grid';  // 책장 모양(grid)으로 보이기
        sectionMyReviews.style.display = 'none';
        sectionMyReading.style.display = 'none';   // [추가됨] 읽는 중 숨기기
        
        // 3. 멘트 변경
        if (currentNickname) {
            userStatusElement.textContent = `${currentNickname} 님이 읽고 싶은 책들입니다.`;
        }
        
        fetchMyWishlist(); // 데이터 가져오기
    });

    // ----------------------------------------------------
    // 찜 목록
    // ----------------------------------------------------

    // [읽고 싶어요] 데이터 가져오기
    async function fetchMyWishlist() {
        if (!auth.currentUser) return;
        wishlistContainer.innerHTML = '<p>불러오는 중...</p>';
        
        try {
            const res = await fetch(`${serverUrl}/api/wishlist/my?userId=${auth.currentUser.email}`);
            const books = await res.json();

            // 데이터 저장
            wishlistData = books;
            
            // 1페이지 그리기
            renderWishlistPage(1);

        } catch (e) {
            console.error(e);
            wishlistContainer.innerHTML = '<p>목록을 불러오지 못했습니다.</p>';
        }
    }

    // [읽고 싶어요] 화면 그리기
    function renderWishlistPage(page) {
        wishlistPage = page;
        wishlistContainer.innerHTML = '';

        if (wishlistData.length === 0) {
            wishlistContainer.innerHTML = '<p>아직 찜한 책이 없습니다.</p>';
            wishlistPagination.innerHTML = '';
            return;
        }

        const startIndex = (page - 1) * GRID_PER_PAGE;
        const endIndex = startIndex + GRID_PER_PAGE;
        const currentItems = wishlistData.slice(startIndex, endIndex);
        
        const itemsCount = getGridPerPage(); 

        currentItems.forEach(book => {
            const card = document.createElement('div');
            card.classList.add('wish-card');
            card.innerHTML = `
                <a href="book-detail.html?isbn=${book.isbn}">
                    <img src="${book.image}" alt="${book.title}">
                </a>
                <div class="wish-info">
                    <p class="wish-title">${book.title}</p>
                    <p class="wish-author">${book.author}</p>
                    <button class="wish-remove-btn" data-isbn="${book.isbn}">삭제</button>
                </div>
            `;
            wishlistContainer.appendChild(card);
        });

        document.querySelectorAll('.wish-remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm('찜 목록에서 삭제할까요?')) return;
                await fetch(`${serverUrl}/api/wishlist/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.currentUser.email, isbn: e.target.dataset.isbn })
                });
                fetchMyWishlist();
            });
        });

        // 페이지네이션 버튼 생성
        renderPaginationUI(wishlistData.length, itemsCount, page, wishlistPagination, renderWishlistPage);
    }
    // ----------------------------------------------------
    // 읽는중 목록
    // ----------------------------------------------------
    // [읽는 중] 데이터 가져오기
    async function fetchMyReading() {
        if (!auth.currentUser) return;
        readingContainer.innerHTML = '<p>불러오는 중...</p>';
        
        try {
            const res = await fetch(`${serverUrl}/api/reading/my?userId=${auth.currentUser.email}`);
            const books = await res.json();

            // 데이터 전역 변수에 저장
            readingData = books;
            
            // 1페이지 그리기 호출
            renderReadingPage(1); 

        } catch (e) {
            console.error(e);
            readingContainer.innerHTML = '<p>목록을 불러오지 못했습니다.</p>';
        }
    }

    // [읽는 중] 화면 그리기 (페이지네이션 적용)
    function renderReadingPage(page) {
        readingPage = page; // 현재 페이지 업데이트
        readingContainer.innerHTML = '';

        if (readingData.length === 0) {
            readingContainer.innerHTML = '<p>읽고 있는 책이 없습니다.</p>';
            readingPagination.innerHTML = '';
            return;
        }

        // 함수를 호출해서 현재 화면에 맞는 개수 가져오기
        const itemsCount = getGridPerPage(); 

        // 데이터 자르기 (12개씩)
        const startIndex = (page - 1) * GRID_PER_PAGE;
        const endIndex = startIndex + GRID_PER_PAGE;
        const currentItems = readingData.slice(startIndex, endIndex);

        // 카드 생성
        currentItems.forEach(book => {
            const card = document.createElement('div');
            card.classList.add('wish-card');
            card.innerHTML = `
                <a href="book-detail.html?isbn=${book.isbn}">
                    <img src="${book.image}" alt="${book.title}">
                </a>
                <div class="wish-info">
                    <p class="wish-title">${book.title}</p>
                    <p class="wish-author">${book.author}</p>
                    <button class="reading-remove-btn" data-isbn="${book.isbn}">삭제</button>
                </div>
            `;
            readingContainer.appendChild(card);
        });

        // 삭제 이벤트 연결
        document.querySelectorAll('.reading-remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm('목록에서 삭제할까요?')) return;
                await fetch(`${serverUrl}/api/reading/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.currentUser.email, isbn: e.target.dataset.isbn })
                });
                fetchMyReading(); // 데이터 다시 로드
            });
        });

        // 페이지네이션 버튼 생성 호출
        renderPaginationUI(readingData.length, itemsCount, page, readingPagination, renderReadingPage);
    }

    // ----------------------------------------------------
    // 화면 크기가 바뀔 때마다 페이지네이션 다시 계산
    // ----------------------------------------------------
    window.addEventListener('resize', () => {
        // 현재 보고 있는 탭에 맞춰서 다시 그리기
        if (tabMyReading.classList.contains('active')) {
            renderReadingPage(1); // 1페이지로 리셋하면서 다시 그림
        } else if (tabMyWishlist.classList.contains('active')) {
            renderWishlistPage(1);
        }
    });
});
