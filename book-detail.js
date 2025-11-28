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
                
                const repliesRef = collection(db, "reviews", reviewId, "replies");
                const qReplies = query(repliesRef, orderBy("timestamp", "asc")); 
                const repliesSnap = await getDocs(qReplies);
                
                // [수정] 답글 ID도 같이 저장해야 수정/삭제 가능
                const replies = [];
                repliesSnap.forEach(rDoc => {
                    replies.push({ id: rDoc.id, ...rDoc.data() });
                });

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
                const currentUser = auth.currentUser;
                const isLiked = currentUser && likes.includes(currentUser.email);
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
                        let rDate = '';
                        if (reply.timestamp) {
                             const rTs = reply.timestamp.toDate ? reply.timestamp.toDate() : new Date(reply.timestamp);
                             rDate = rTs.toLocaleDateString();
                        }
                        
                        // [신규] 내 답글인지 확인
                        const isMyReply = currentUser && reply.userId === currentUser.email;
                        const replyButtons = isMyReply ? 
                            `<span class="reply-btn-group">
                                <button class="reply-edit-btn" data-rid="${reply.id}">수정</button>
                                <button class="reply-delete-btn" data-rid="${reply.id}">삭제</button>
                             </span>` : '';

                        html += `
                            <div class="reply-item" id="reply-${reply.id}">
                                <div class="reply-content-box">
                                    <b>└ ${reply.nickname}</b>: <span class="reply-text">${reply.content}</span>
                                    <span class="reply-date">${rDate}</span>
                                </div>
                                ${replyButtons}
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

                // --- 이벤트 리스너 ---
                
                // 1. 좋아요
                const likeBtn = reviewItem.querySelector('.like-btn');
                likeBtn.addEventListener('click', async () => {
                    const curUser = auth.currentUser;
                    if (!curUser) { alert('로그인이 필요합니다.'); return; }
                    if (review.userId === curUser.email || review.uid === curUser.uid) {
                        alert('본인의 리뷰에는 좋아요를 누를 수 없습니다.'); return;
                    }
                    try {
                        await fetch(`${serverUrl}/api/review-like`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reviewId: reviewId, userId: curUser.email })
                        });
                        fetchAndDisplayReviews(bookIsbn);
                    } catch (e) { console.error(e); }
                });

                // 2. 답글 토글
                const replyToggleBtn = reviewItem.querySelector('.reply-toggle-btn');
                const replySection = reviewItem.querySelector('.reply-section');
                replyToggleBtn.addEventListener('click', () => {
                    replySection.style.display = (replySection.style.display === 'none') ? 'block' : 'none';
                });

                // 3. 답글 등록
                const replyInput = reviewItem.querySelector('.reply-input');
                const replySubmitBtn = reviewItem.querySelector('.reply-submit-btn');
                replySubmitBtn.addEventListener('click', async () => {
                    const curUser = auth.currentUser;
                    if (!curUser) { alert('로그인이 필요합니다.'); return; }
                    const content = replyInput.value.trim();
                    if (!content) return;

                    try {
                        const nickname = curUser.displayName || curUser.email.split('@')[0];
                        await fetch(`${serverUrl}/api/review-reply`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reviewId, userId: curUser.email, nickname, content })
                        });
                        alert('답글이 등록되었습니다.');
                        fetchAndDisplayReviews(bookIsbn);
                    } catch (e) { console.error(e); alert('등록 실패'); }
                });
                
                // 4. [신규] 답글 수정/삭제 버튼
                reviewItem.querySelectorAll('.reply-delete-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        if(!confirm('답글을 삭제하시겠습니까?')) return;
                        const replyId = e.target.dataset.rid;
                        try {
                            await fetch(`${serverUrl}/api/reply-delete?reviewId=${reviewId}&replyId=${replyId}&userId=${auth.currentUser.email}`, {
                                method: 'DELETE'
                            });
                            alert('삭제되었습니다.');
                            fetchAndDisplayReviews(bookIsbn);
                        } catch(err) { console.error(err); alert('삭제 실패'); }
                    });
                });

                reviewItem.querySelectorAll('.reply-edit-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const replyId = e.target.dataset.rid;
                        const newContent = prompt('답글을 수정해주세요:');
                        if(newContent === null || newContent.trim() === '') return;
                        
                        try {
                            await fetch(`${serverUrl}/api/reply-edit`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    reviewId, replyId, 
                                    userId: auth.currentUser.email, 
                                    content: newContent 
                                })
                            });
                            alert('수정되었습니다.');
                            fetchAndDisplayReviews(bookIsbn);
                        } catch(err) { console.error(err); alert('수정 실패'); }
                    });
                });
            });

        } catch (e) {
            console.error("리뷰 목록 오류:", e);
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