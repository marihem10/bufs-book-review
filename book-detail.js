import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, setDoc, orderBy} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isbn = urlParams.get('isbn');
    const bookDetailContainer = document.getElementById('bookDetail');
    const backButton = document.getElementById('backButton');
    const db = window.db; 
    const auth = window.auth; 
    const reviewTextarea = document.getElementById('reviewText');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    const userReviewsContainer = document.getElementById('userReviews');
    let selectedRating = 0;
    const serverUrl = 'https://bufs-book-review.onrender.com';

    function showButtonLoading(button) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = '<span class="button-loader"></span> 등록중...';
    }
    function hideButtonLoading(button) {
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
        }
        button.disabled = false;
    }
    if (!isbn) {
        bookDetailContainer.innerHTML = '<h2>오류: 책 정보를 찾을 수 없습니다.</h2>';
        return;
    }
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back(); 
        });
    }
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
    // [C] 함수 정의: 리뷰 목록 (답글 포함)
    // ----------------------------------------------------
    async function fetchAndDisplayReviews(bookIsbn) {
        userReviewsContainer.innerHTML = '<h4>리뷰를 불러오는 중입니다...</h4>';
        try {
            const reviewsQuery = query(collection(db, "reviews"), where("bookIsbn", "==", bookIsbn));
            const querySnapshot = await getDocs(reviewsQuery);
            
            if (querySnapshot.empty) {
                userReviewsContainer.innerHTML = '<p>아직 이 책에 대한 리뷰가 없습니다.</p>';
                return;
            }
            userReviewsContainer.innerHTML = ''; 

            const reviewPromises = querySnapshot.docs.map(async (docSnap) => {
                const review = docSnap.data();
                const reviewId = docSnap.id;
                
                // [수정] 답글 가져오기 (컬렉션 경로 명확하게 지정)
                const repliesRef = collection(db, "reviews", reviewId, "replies");
                
                // [수정] orderBy 사용 시 에러가 난다면, 일단 정렬 없이 가져온 뒤 JS로 정렬하는 방법도 있습니다.
                // 여기서는 orderBy를 그대로 쓰되, import가 잘 되었는지 확인이 중요합니다.
                const qReplies = query(repliesRef, orderBy("timestamp", "asc")); 
                
                const repliesSnap = await getDocs(qReplies);
                const replies = [];
                repliesSnap.forEach(rDoc => replies.push(rDoc.data()));

                return { id: reviewId, data: review, replies: replies };
            });

            const reviewsData = await Promise.all(reviewPromises);

            reviewsData.forEach(({ id, data, replies }) => {
                const review = data;
                const reviewId = id;
                
                let date = '날짜 없음';
                if (review.timestamp) {
                    const ts = review.timestamp.toDate ? review.timestamp.toDate() : new Date(review.timestamp);
                    date = ts.toLocaleDateString('ko-KR');
                }
                
                const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                const displayName = review.nickname || review.userId.split('@')[0];

                const likes = review.likes || [];
                const likeCount = likes.length;
                const isLiked = auth.currentUser && likes.includes(auth.currentUser.email);
                const heartIcon = isLiked ? '♥' : '♡'; 
                const heartClass = isLiked ? 'liked' : '';

                const reviewItem = document.createElement('div');
                reviewItem.classList.add('user-review-item');
                
                let html = `
                    <div class="review-header">
                        <strong>${displayName}</strong> <span class="review-date">(${date})</span>
                    </div>
                    <p class="review-rating">${starsHtml}</p>
                    <p class="review-comment">${review.comment}</p>
                    
                    <div class="review-actions">
                        <button class="like-btn ${heartClass}" data-id="${reviewId}">
                            ${heartIcon} 좋아요 ${likeCount}
                        </button>
                        <button class="reply-toggle-btn">💬 답글 ${replies.length}</button>
                    </div>
                    
                    <div class="reply-section" style="display: none;">
                        <div class="reply-list">
                `;

                if (replies.length > 0) {
                    replies.forEach(reply => {
                        // [수정] 답글 날짜 처리 안전하게
                        let rDate = '';
                        if (reply.timestamp) {
                             const rTs = reply.timestamp.toDate ? reply.timestamp.toDate() : new Date(reply.timestamp);
                             rDate = rTs.toLocaleDateString();
                        }
                        html += `
                            <div class="reply-item">
                                <b>└ ${reply.nickname}</b>: ${reply.content} <span class="reply-date">${rDate}</span>
                            </div>
                        `;
                    });
                } else {
                    html += `<p class="no-reply">아직 답글이 없습니다.</p>`;
                }

                html += `
                        </div>
                        <div class="reply-form">
                            <input type="text" class="reply-input" placeholder="답글을 입력하세요...">
                            <button class="reply-submit-btn" data-id="${reviewId}">등록</button>
                        </div>
                    </div>
                    <hr>
                `;
                
                reviewItem.innerHTML = html;
                userReviewsContainer.appendChild(reviewItem);

                // 1. 좋아요 버튼
                const likeBtn = reviewItem.querySelector('.like-btn');
                likeBtn.addEventListener('click', async () => {
                    // [핵심 수정] window.auth를 통해 최신 로그인 상태 확인
                    const currentUser = window.auth.currentUser;
                    
                    if (!currentUser) { 
                        alert('로그인이 필요합니다.'); return; 
                    }
                    
                    // 본인 리뷰인지 확인
                    if (review.userId === currentUser.email || review.uid === currentUser.uid) {
                        alert('본인의 리뷰에는 좋아요를 누를 수 없습니다.');
                        return;
                    }
                    
                    try {
                        const response = await fetch(`${serverUrl}/api/review-like`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                reviewId: reviewId, 
                                userId: currentUser.email 
                            })
                        });
                        
                        if (!response.ok) throw new Error('서버 응답 오류');
                        
                        const result = await response.json();
                        
                        // [핵심 수정] 전체 새로고침 대신 버튼 숫자만 업데이트 (속도 향상)
                        likeBtn.innerHTML = `${result.likes.includes(currentUser.email) ? '♥' : '♡'} 좋아요 ${result.likes.length}`;
                        likeBtn.classList.toggle('liked');

                    } catch (e) { 
                        console.error(e); 
                        alert('좋아요 처리 실패');
                    }
                });

                const replyToggleBtn = reviewItem.querySelector('.reply-toggle-btn');
                const replySection = reviewItem.querySelector('.reply-section');
                replyToggleBtn.addEventListener('click', () => {
                    if (replySection.style.display === 'none') {
                        replySection.style.display = 'block';
                    } else {
                        replySection.style.display = 'none';
                    }
                });

                const replyInput = reviewItem.querySelector('.reply-input');
                const replySubmitBtn = reviewItem.querySelector('.reply-submit-btn');
                
                replySubmitBtn.addEventListener('click', async () => {
                    if (!auth.currentUser) { alert('로그인이 필요합니다.'); return; }
                    const content = replyInput.value.trim();
                    if (!content) return;

                    try {
                        const user = auth.currentUser;
                        const nickname = user.displayName || user.email.split('@')[0];

                        await fetch(`${serverUrl}/api/review-reply`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                reviewId: reviewId, 
                                userId: user.email,
                                nickname: nickname,
                                content: content
                            })
                        });
                        alert('답글이 등록되었습니다.');
                        fetchAndDisplayReviews(bookIsbn); 
                    } catch (e) { 
                        console.error(e); 
                        alert('답글 등록 실패');
                    }
                });
            });

        } catch (e) {
            console.error("리뷰 목록 가져오기 실패:", e);
            userReviewsContainer.innerHTML = '<p>리뷰 목록을 불러오는 데 실패했습니다.</p>';
        }
    }


    // ----------------------------------------------------
    // [D] 메인 실행 및 초기 로드
    // ----------------------------------------------------
    const book = await fetchBookDetails(isbn);
    if (book) {
        document.getElementById('pageTitle').textContent = book.title;
        const bookRef = doc(db, "books", isbn);
        const docSnap = await getDoc(bookRef); 
        let totalReviews = 0;
        let averageRating = 0;
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            totalReviews = firestoreData.reviews || 0;
            averageRating = firestoreData.averageRating || 0;
        }
        const ratingDisplay = averageRating.toFixed(1);
        const fullStars = '★'.repeat(Math.round(averageRating));
        const emptyStars = '☆'.repeat(5 - Math.round(averageRating));
        const starsHtml = fullStars + emptyStars;
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
        await fetchAndDisplayReviews(isbn); 
    } else {
         bookDetailContainer.innerHTML = '<h2>책 상세 정보를 불러올 수 없습니다.</h2>';
    }

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

    // ----------------------------------------------------
    // [E-2] 리뷰 "등록" 버튼
    // ----------------------------------------------------
    submitReviewBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            alert('리뷰를 등록하려면 먼저 로그인해주세요.');
            return;
        }
        
        // [신규] 이메일 인증 여부 확인
        if (!auth.currentUser.emailVerified) {
            alert('이메일 인증을 완료해야 리뷰를 작성할 수 있습니다.');
            return;
        }
        
        if (selectedRating === 0 || reviewTextarea.value.trim() === '') {
            alert('별점과 감상평을 모두 입력해주세요.');
            return;
        }
        const cleanIsbn = isbn ? isbn.replace(/\D/g, '').trim() : ''; 
        if (cleanIsbn.length !== 13) { 
            alert('오류: 책 정보(ISBN)가 유효하지 않습니다.');
            return;
        }

        showButtonLoading(submitReviewBtn); 

        try {
            const user = auth.currentUser;
            const uid = user.uid;
            const nickname = user.displayName || user.email.split('@')[0]; // 닉네임
            
            const docId = `${uid}_${cleanIsbn}`;
            const reviewRef = doc(db, "reviews", docId);

            const reviewDoc = await getDoc(reviewRef);
            if (reviewDoc.exists()) {
                alert('이미 이 책에 대한 리뷰를 작성했습니다.');
                hideButtonLoading(submitReviewBtn); 
                return; 
            }

            const reviewData = {
                bookIsbn: cleanIsbn, 
                uid: uid,                   // <-- uid 저장
                nickname: nickname,         // <-- 닉네임 저장
                userId: user.email,         // (혹시 모르니 email도 'userId'로 저장)
                rating: selectedRating,
                comment: reviewTextarea.value.trim(),
                timestamp: new Date()
            };

            await setDoc(reviewRef, reviewData);

            const bookRef = doc(db, "books", cleanIsbn);
            const bookDoc = await getDoc(bookRef);
            if (bookDoc.exists()) {
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
                const displayedTitle = document.querySelector('.detail-text h1').textContent.trim();
                const displayedImage = document.querySelector('.detail-image').src;
                await setDoc(bookRef, {
                    isbn: cleanIsbn,
                    title: displayedTitle, 
                    image: displayedImage,
                    reviews: 1,
                    ratingSum: selectedRating,
                    averageRating: selectedRating
                });
            }

            alert('리뷰가 성공적으로 등록되었습니다.');
            
            reviewTextarea.value = '';
            ratingStars.forEach(s => s.classList.remove('selected'));
            selectedRating = 0;
            
            await fetchAndDisplayReviews(isbn); 
            await fetchBookDetails(isbn); 
            hideButtonLoading(submitReviewBtn); 
        } catch (e) {
            console.error("리뷰 등록 실패: ", e);
            if (e.code === 'permission-denied') {
                alert('리뷰 등록에 실패했습니다. (DB 쓰기 권한 오류 - 이메일 인증을 확인하세요)');
            } else {
                alert('리뷰 등록 중 오류가 발생했습니다.');
            }
            hideButtonLoading(submitReviewBtn); 
        }
    });
});