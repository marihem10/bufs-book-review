// 1. 모듈 가져오기
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

app.get('/', (req, res) => {
    res.status(200).send('Server is awake!');
});

// 2. 서비스 계정 설정
const firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!firebaseServiceAccountJson) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되지 않았습니다.");
    process.exit(1); 
}

let serviceAccount;
try {
    const cleanJsonString = firebaseServiceAccountJson.replace(/(\r\n|\n|\r)/gm, "").trim(); 
    serviceAccount = JSON.parse(cleanJsonString);
} catch (e) {
    console.error("JSON 파싱 오류:", e);
    process.exit(1);
}

// 3. Firebase 앱 초기화
let firebaseApp; 
try {
    firebaseApp = initializeApp({
    credential: cert(serviceAccount)
    });
} catch (e) {
    console.error("Firebase 초기화 실패:", e.message);
    process.exit(1);
}

const db = getFirestore(firebaseApp); 
const adminAuth = getAuth(firebaseApp);

// 4. Express 앱 설정
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors()); 

// 5. 네이버 API 설정
const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;
const apiHost = 'https://openapi.naver.com/v1/search/book.json';


// ------------------------------------------------------------------
// 리뷰 등록
// ------------------------------------------------------------------
app.post('/api/review-submit', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: '요청 본문(리뷰 데이터)가 누락되었습니다.' });
    }
    const { bookIsbn, userId, rating, comment } = req.body; 
    if (!bookIsbn || !userId || !rating || !comment) {
        return res.status(400).json({ error: `필수 리뷰 정보가 누락되었습니다.` });
    }
    const bookRef = db.collection('books').doc(bookIsbn); 
    const bookDoc = await bookRef.get();
    let bookData;
    if (!bookDoc.exists) {
        try {
            const apiResponse = await axios.get(apiHost, {
                params: { d_isbn: bookIsbn, display: 1 },
                headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }
            });
            const items = apiResponse.data.items;
            const apiBook = items && items.length > 0 ? items[0] : null;
            if (!apiResponse.data.items || apiResponse.data.items.length === 0 || !apiBook) { 
                throw new Error('네이버 API에서 유효한 책 정보를 찾을 수 없습니다.');
            }
            bookData = { 
                title: apiBook.title.replace(/<[^>]*>?/g, ''),
                author: apiBook.author || '저자 없음',
                publisher: apiBook.publisher || '출판사 없음',
                isbn: bookIsbn,
                image: apiBook.image || '',
                reviews: 0, 
                ratingSum: 0 
            };
            await bookRef.set(bookData); 
        } catch (e) {
            console.error("책 정보 자동 저장 실패:", e.message);
            return res.status(500).json({ error: '리뷰 등록 실패: 책 정보 자동 생성에 실패했습니다. (API 서버 연결 오류)' });
        }
    } else {
        bookData = bookDoc.data();
    }
    const reviewRef = await db.collection('reviews').add({
        bookIsbn: bookIsbn,
        userId: userId,
        rating: rating,
        comment: comment,
        timestamp: FieldValue.serverTimestamp()
    });
    const newReviews = (bookData.reviews || 0) + 1;
    const newRatingSum = (bookData.ratingSum || 0) + rating;
    const newAverageRating = newRatingSum / newReviews;
    await bookRef.update({
        reviews: newReviews,
        ratingSum: newRatingSum,
        averageRating: newAverageRating
    });
    res.status(200).json({ message: '리뷰가 성공적으로 등록되고 책 정보가 저장/업데이트되었습니다.', reviewId: reviewRef.id });
});

// ------------------------------------------------------------------
// 검색
// ------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
    const { query, sort, page } = req.query;
    if (!query) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }
    const display = 12;
    const pageNum = parseInt(page) || 1;
    const start = 1 + (pageNum - 1) * display;
    const sortOption = sort === 'date' ? 'date' : 'sim';
    try {
        const response = await axios.get(apiHost, {
            params: { query: query, display: display, start: start, sort: sortOption },
            headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }
        });
        const totalResults = response.data.total || 0;
        const effectiveTotal = Math.min(totalResults, 1000); 
        const totalPages = Math.ceil(effectiveTotal / display);
        const books = response.data.items.map(book => ({
            title: book.title.replace(/<[^>]*>?/g, ''),
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn || Date.now().toString(),
            image: book.image || ''
        }));
        res.json({ books: books, currentPage: pageNum, totalPages: totalPages, totalResults: totalResults });
    } catch (error) {
        console.error(`API 호출 실패 (Query: ${query}, Start: ${start}, Sort: ${sortOption}):`, error.message);
        if (error.response && error.response.status === 400) {
            return res.status(400).json({ error: '잘못된 요청입니다. (검색 범위를 초과했을 수 있습니다)', details: error.response.data });
        }
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// ------------------------------------------------------------------
// 인기 도서
// ------------------------------------------------------------------
app.get('/api/popular-books', async (req, res) => {
    try {
        const booksRef = db.collection('books');
        const querySnapshot = await booksRef
            .where("reviews", ">", 0)
            .orderBy("averageRating", "desc")
            .orderBy("reviews", "desc") 
            .limit(5)
            .get();
        if (querySnapshot.empty) {
            return res.json([]);
        }
        const popularBooks = [];
        querySnapshot.forEach((doc) => {
            popularBooks.push(doc.data());
        });
        res.json(popularBooks);
    } catch (error) {
        console.error('인기 도서 목록 가져오기 실패 (서버 측):', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});


// ------------------------------------------------------------------
// 마이페이지 리뷰 목록
// ------------------------------------------------------------------
app.get('/api/my-reviews', async (req, res) => {
    const userEmail = req.query.userId;
    if (!userEmail) {
        return res.status(400).json({ error: '사용자 ID가 누락되었습니다.' });
    }
    try {
        const reviewsQuery = db.collection("reviews").where("userId", "==", userEmail);
        const querySnapshot = await reviewsQuery.get();
        if (querySnapshot.empty) {
            return res.json([]);
        }
        const reviewsWithTitles = querySnapshot.docs.map(async (document) => {
            const review = document.data();
            const reviewId = document.id;
            let bookTitle = '책 제목 정보 없음';
            const bookRef = db.collection("books").doc(review.bookIsbn);
            const bookDoc = await bookRef.get();
            if (bookDoc.exists) {
                bookTitle = bookDoc.data().title || bookTitle;
            }
            let reviewDate = '날짜 없음';
            if (review.timestamp) {
                if (typeof review.timestamp.toDate === 'function') {
                    reviewDate = new Date(review.timestamp.toDate()).toLocaleDateString('ko-KR');
                } else {
                    reviewDate = new Date(review.timestamp).toLocaleDateString('ko-KR');
                }
            }
            return { review, reviewId, bookTitle, reviewDate: reviewDate };
        });
        const finalReviews = await Promise.all(reviewsWithTitles);
        res.json(finalReviews);
    } catch (error) {
        console.error('마이페이지 리뷰 가져오기 실패 (서버 측):', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// ------------------------------------------------------------------
// 리뷰 삭제
// ------------------------------------------------------------------
app.delete('/api/review-delete', async (req, res) => { 
    const { reviewId, bookIsbn } = req.query;
    const deletedRating = parseInt(req.query.deletedRating);

    if (!reviewId || !bookIsbn || isNaN(deletedRating)) {
        return res.status(400).json({ error: '정보 부족' });
    }

    console.log(`[리뷰 삭제 요청] reviewId: ${reviewId}`);

    try {
        // 1. 책 통계 업데이트
        const bookRef = db.collection('books').doc(bookIsbn);
        const bookDoc = await bookRef.get();

        if (bookDoc.exists) { 
            const firestoreData = bookDoc.data();
            const currentReviews = firestoreData.reviews || 0;
            const currentRatingSum = firestoreData.ratingSum || 0;

            if (currentReviews > 0) {
                const newReviews = currentReviews - 1;
                const newRatingSum = currentRatingSum - deletedRating;
                const newAverageRating = (newReviews > 0) ? (newRatingSum / newReviews) : 0;
                await bookRef.update({ reviews: newReviews, ratingSum: newRatingSum, averageRating: newAverageRating });
            }
        }

        // 2. 해당 리뷰에 달린 답글 모두 삭제
        const repliesRef = db.collection('reviews').doc(reviewId).collection('replies');
        const repliesSnapshot = await repliesRef.get();

        if (!repliesSnapshot.empty) {
            const batch = db.batch(); // 일괄 처리를 위해 배치 생성
            repliesSnapshot.forEach(doc => {
                batch.delete(doc.ref); // 답글 문서 삭제 명령 추가
            });
            await batch.commit(); // 실행
            console.log(`[리뷰 삭제] 연관된 답글 ${repliesSnapshot.size}개 삭제 완료`);
        }

        // 3. 리뷰 본문 삭제
        await db.collection('reviews').doc(reviewId).delete();
        
        res.status(200).json({ message: '리뷰와 답글이 모두 삭제되었습니다.' });

    } catch (error) {
        console.error('리뷰 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// 마이페이지 리뷰 수정
// ------------------------------------------------------------------
app.put('/api/review-edit', async (req, res) => {
    // 1. 클라이언트로부터 정보를 받기
    const { reviewId, bookIsbn, newComment, newRating } = req.body;
    
    //newRating과 oldRating을 숫자로 변환하고 NaN 검사
    const oldRating = parseInt(req.body.oldRating, 10);

    // 데이터 유효성 검사
    if (!reviewId || !bookIsbn || !newComment || isNaN(newRating) || isNaN(oldRating)) {
        const errors = [];
        if (!reviewId) errors.push('reviewId');
        if (!bookIsbn) errors.push('bookIsbn');
        if (!newComment) errors.push('newComment');
        if (isNaN(newRating)) errors.push('newRating (is NaN)');
        if (isNaN(oldRating)) errors.push('oldRating (is NaN)');
        
        return res.status(400).json({ 
            error: '필수 수정 정보가 누락되었거나 유효하지 않습니다.',
            details: errors
        });
    }
    
    console.log(`[수정 요청 수신] reviewId: ${reviewId}`);

    try {
        const bookRef = db.collection('books').doc(bookIsbn);
        const reviewRef = db.collection('reviews').doc(reviewId);

        // 1단계: books 컬렉션 통계 업데이트
        const bookDoc = await bookRef.get();
        if (bookDoc.exists) {
            const bookData = bookDoc.data();
            const currentRatingSum = bookData.ratingSum || 0;
            const currentReviews = bookData.reviews || 0;
            
            // 새 통계 계산
            const newRatingSum = (currentRatingSum - oldRating) + newRating;
            const newAverageRating = (currentReviews > 0) ? (newRatingSum / currentReviews) : 0;

            console.log(`[수정 - 1단계] ${bookIsbn} 통계 업데이트 중...`);
            await bookRef.update({
                ratingSum: newRatingSum,
                averageRating: newAverageRating
            });
        } else {
            console.warn(`[수정 - 1단계 경고] ${bookIsbn} 책 통계 문서를 찾을 수 없습니다.`);
        }

        // 2단계: reviews 컬렉션에서 리뷰 내용 업데이트
        console.log(`[수정 - 2단계] ${reviewId} 리뷰 업데이트 중...`);
        await reviewRef.update({
            comment: newComment,
            rating: newRating,
            timestamp: FieldValue.serverTimestamp() // 수정 시간을 최신으로
        });

        console.log(`[수정 성공] ${reviewId} 처리 완료.`);
        res.status(200).json({ message: '리뷰 수정 및 통계 업데이트가 성공적으로 완료되었습니다.' });

    } catch (error) {
        console.error('서버 측 리뷰 수정 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 리뷰 수정에 실패했습니다.', details: error.message });
    }
});

// ------------------------------------------------------------------
// 책 상세 정보
// ------------------------------------------------------------------
app.get('/api/book-detail', async (req, res) => {
    const isbn = req.query.isbn; 

    if (!isbn) {
        return res.status(400).json({ error: 'ISBN이 필요합니다.' });
    }

    try {
        const response = await axios.get(apiHost, {
            params: {
                query: isbn,
                display: 1
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            }
        });

        if (!response.data.items || response.data.items.length === 0) {
            return res.status(404).json({ error: '해당 ISBN의 책을 찾을 수 없습니다.' });
        }
        
        const book = response.data.items.find(item => item.isbn === isbn);

        if (!book) {
            return res.status(404).json({ error: 'ISBN이 정확히 일치하는 책을 찾을 수 없습니다.' });
        }

        const bookDetail = {
            title: book.title.replace(/<[^>]*>?/g, ''),
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn,
            image: book.image || 'https://via.placeholder.com/200x300'
        };

        res.json(bookDetail);

    } catch (error) {
        console.error('책 상세 정보 API 호출 실패:', error);
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다. (API 확인 필요)' });
    }
});

// ------------------------------------------------------------------
// 계정 삭제
// ------------------------------------------------------------------
app.delete('/api/delete-account', async (req, res) => {
    
    // 토큰 검증
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
    }

    const uid = decodedToken.uid;
    if (!uid) {
        return res.status(400).json({ error: '토큰에서 사용자 UID를 찾을 수 없습니다.' });
    }
    
    console.log(`[계정 삭제 시작] UID: ${uid}`);

    try {
        const batch = db.batch(); // 리뷰/유저 삭제는 배치로 처리

        // Firestore 이 사용자가 쓴 모든 reviews 찾기
        const reviewsQuery = db.collection('reviews').where('uid', '==', uid);
        const snapshot = await reviewsQuery.get();

        if (!snapshot.empty) {
            console.log(`${snapshot.size}개의 리뷰를 삭제하고 통계를 업데이트합니다.`);
            
            // 통계 업데이트가 필요한 책들을 Map으로 관리
            const bookStatsToUpdate = new Map();
            
            snapshot.forEach(doc => {
                const review = doc.data();
                const bookIsbn = review.bookIsbn;
                const rating = parseInt(review.rating, 10);

                if (bookIsbn && !isNaN(rating)) {
                    // 통계 역산 준비
                    if (!bookStatsToUpdate.has(bookIsbn)) {
                        bookStatsToUpdate.set(bookIsbn, { 
                            reviewsToDecrement: 0, 
                            ratingToDecrement: 0 
                        });
                    }
                    const bookStat = bookStatsToUpdate.get(bookIsbn);
                    bookStat.reviewsToDecrement += 1;
                    bookStat.ratingToDecrement += rating;
                }
                // 리뷰 삭제는 배치에 추가
                batch.delete(doc.ref);
            });

            // 책 통계 업데이트
            for (const [isbn, stat] of bookStatsToUpdate.entries()) {
                const bookRef = db.collection('books').doc(isbn);
                
                try {
                    await db.runTransaction(async (transaction) => {
                        const bookDoc = await transaction.get(bookRef);
                        
                        if (bookDoc.exists) {
                            const data = bookDoc.data();
                            const currentReviews = data.reviews || 0;
                            const currentRatingSum = data.ratingSum || 0;

                            const newReviews = Math.max(0, currentReviews - stat.reviewsToDecrement);
                            const newRatingSum = Math.max(0, currentRatingSum - stat.ratingToDecrement);
                            // 평균 별점 재계산
                            const newAverageRating = (newReviews > 0) ? (newRatingSum / newReviews) : 0;

                            console.log(`통계 업데이트 ${isbn}: ${newReviews}개, ${newAverageRating.toFixed(1)}점`);
                            
                            transaction.update(bookRef, {
                                reviews: newReviews,
                                ratingSum: newRatingSum,
                                averageRating: newAverageRating
                            });
                        }
                    });
                } catch (e) {
                    console.warn(`[계정 삭제] ${isbn} 책의 통계 업데이트 실패: ${e.message}`);
                    // 트랜잭션이 실패해도 계정 삭제는 계속 진행
                }
            }
            
            // Firestore 리뷰 삭제 배치 실행
            await batch.commit();
            console.log('모든 Firestore 리뷰 정리 완료.');

        } else {
            console.log('삭제할 리뷰가 없습니다.');
        }

        // Auth에서 사용자 계정 삭제
        await adminAuth.deleteUser(uid);
        
        // Firestore users 컬렉션에서도 프로필 삭제
        await db.collection('users').doc(uid).delete();
        
        console.log(`[계정 삭제 성공] ${uid} 계정 및 데이터 삭제 완료.`);
        res.status(200).json({ message: '계정 및 모든 리뷰가 성공적으로 삭제되었습니다.' });

    } catch (error) {
        console.error("서버 측 계정 삭제 오류:", error);
        res.status(500).json({ error: '계정 삭제 중 서버 오류가 발생했습니다.', details: error.message });
    }
});

// ------------------------------------------------------------------
// 닉네임 변경
// ------------------------------------------------------------------
app.put('/api/update-nickname', async (req, res) => {
    
    // 1. 토큰 검증
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
    }

    const uid = decodedToken.uid;
    const { newNickname } = req.body;
    const newNicknameLower = newNickname.toLowerCase();

    // 2. 닉네임 유효성 검사
    if (!newNickname || newNickname.length < 2 || newNickname.length > 10) {
        return res.status(400).json({ error: '닉네임은 2자 이상 10자 이하여야 합니다.' });
    }

    console.log(`[닉네임 변경 시작] UID: ${uid}, 새 닉네임: ${newNickname}`);

    try {
        // 3. users 컬렉션에서 새 닉네임이 이미 있는지 확인
        const usersRef = db.collection('users');
        const q = usersRef.where('nickname_lowercase', '==', newNicknameLower);
        const snapshot = await q.get();

        if (!snapshot.empty) {
            // 중복된 닉네임이 있지만, 그게 나 자신인지 확인
            let isMe = false;
            snapshot.forEach(doc => {
                if (doc.id === uid) {
                    isMe = true;
                }
            });
            
            if (!isMe) {
                console.log('닉네임 중복됨.');
                return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
            }
        }
        
        // 4. Firebase Auth 프로필의 displayName 변경
        await adminAuth.updateUser(uid, {
            displayName: newNickname
        });

        // 5. 'users'와 'reviews' 컬렉션을 일괄 업데이트
        const batch = db.batch();
        
        // 5-1. 'users' 컬렉션 업데이트
        const userRef = db.collection('users').doc(uid);
        batch.update(userRef, {
            nickname: newNickname,
            nickname_lowercase: newNicknameLower
        });

        // 5-2. 이 유저가 쓴 모든 'reviews'를 찾아서 닉네임 업데이트
        const reviewsQuery = db.collection('reviews').where('uid', '==', uid);
        const reviewsSnapshot = await reviewsQuery.get();
        
        if (!reviewsSnapshot.empty) {
            console.log(`${reviewsSnapshot.size}개의 리뷰 닉네임을 업데이트합니다.`);
            reviewsSnapshot.forEach(doc => {
                batch.update(doc.ref, { nickname: newNickname });
            });
        }

        // 6. 일괄 작업 실행
        await batch.commit();

        console.log(`[닉네임 변경 성공] ${uid}의 닉네임이 ${newNickname}(으)로 변경됨.`);
        res.status(200).json({ message: '닉네임이 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error("서버 측 닉네임 변경 오류:", error);
        res.status(500).json({ error: '닉네임 변경 중 서버 오류가 발생했습니다.', details: error.message });
    }
});

// ------------------------------------------------------------------
// 이달의 인기 도서
// ------------------------------------------------------------------
app.get('/api/popular-books-monthly', async (req, res) => {
    console.log('[API] 이달의 인기 도서 요청 수신');
    
    try {
        // 1. 이번 달의 시작 날짜 계산
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // 2. Firestore 'reviews' 컬렉션에서 이번 달 리뷰만 쿼리
        const reviewsRef = db.collection('reviews');
        const q = reviewsRef.where('timestamp', '>=', startOfMonth);
        const snapshot = await q.get();

        if (snapshot.empty) {
            console.log('이번 달 리뷰 없음.');
            return res.json([]);
        }

        // 3. 리뷰를 책(isbn)별로 집계
        const monthlyStats = new Map();
        snapshot.forEach(doc => {
            const review = doc.data();
            const isbn = review.bookIsbn;
            const rating = parseInt(review.rating, 10);

            if (!isbn || isNaN(rating)) return;

            if (!monthlyStats.has(isbn)) {
                monthlyStats.set(isbn, { reviewCount: 0, ratingSum: 0 });
            }
            const stat = monthlyStats.get(isbn);
            stat.reviewCount += 1;
            stat.ratingSum += rating;
        });

        // 4. 집계된 데이터를 배열로 변환
        let sortedStats = Array.from(monthlyStats.entries()).map(([isbn, data]) => ({
            isbn: isbn,
            reviewCount: data.reviewCount,
            averageRating: (data.ratingSum / data.reviewCount)
        }));

        // 5. 정렬: 1순위(평균 별점), 2순위(리뷰 개수)
        sortedStats.sort((a, b) => {
            if (b.averageRating !== a.averageRating) {
                // 1순위: 평균 별점 (내림차순)
                return b.averageRating - a.averageRating;
            } else {
                // 2순위: 리뷰 개수 (내림차순)
                return b.reviewCount - a.reviewCount;
            }
        });

        // 6. 상위 10개만 추출
        const top10Stats = sortedStats.slice(0, 10);
        const top10Isbns = top10Stats.map(stat => stat.isbn);

        // 7. Firestore 상위 10개 책의 상세 정보 가져오기
        const bookPromises = top10Isbns.map(isbn => db.collection('books').doc(isbn).get());
        const bookDocs = await Promise.all(bookPromises);

        // 8. 최종 데이터 조합
        const popularBooks = bookDocs
            .map((doc) => { 
                if (!doc.exists) return null; 
                const bookData = doc.data();
                
                const stat = top10Stats.find(s => s.isbn === bookData.isbn);
                if (!stat) return null;
                
                return {
                    ...bookData, 
                    reviews: stat.reviewCount, // 이달의 리뷰 수
                    averageRating: stat.averageRating // 이달의 평균 별점
                };
            })
            .filter(book => book !== null);
            
        // 9. 최종 순서로 다시 정렬
        popularBooks.sort((a, b) => {
            if (b.averageRating !== a.averageRating) {
                return b.averageRating - a.averageRating;
            } else {
                return b.reviews - a.reviews;
            }
        });

        console.log(`[API] 이달의 인기 도서 ${popularBooks.length}권 반환`);
        res.json(popularBooks);

    } catch (error) {
        console.error('이달의 인기 도서 목록 가져오기 실패 (서버 측):', error);
        if (error.code === 'failed-precondition') {
            return res.status(500).json({ error: '데이터베이스 색인 오류가 발생했습니다. (reviews/timestamp)' });
        }
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// ------------------------------------------------------------------
// 리뷰 좋아요 토글
// ------------------------------------------------------------------
app.post('/api/review-like', async (req, res) => {
    const { reviewId, userId } = req.body;
    if (!reviewId || !userId) return res.status(400).json({ error: '정보 부족' });

    try {
        const reviewRef = db.collection('reviews').doc(reviewId);
        const doc = await reviewRef.get();
        
        if (!doc.exists) return res.status(404).json({ error: '리뷰 없음' });
        
        const data = doc.data();
        const likes = data.likes || []; // 기존 좋아요 배열 (없으면 빈 배열)
        
        let newLikes;
        if (likes.includes(userId)) {
            // 이미 좋아요 누름 -> 취소 (배열에서 제거)
            newLikes = likes.filter(id => id !== userId);
        } else {
            // 안 누름 -> 추가 (배열에 추가)
            newLikes = [...likes, userId];
        }
        
        await reviewRef.update({ likes: newLikes });
        res.json({ success: true, likes: newLikes });

    } catch (error) {
        console.error('좋아요 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// 리뷰 답글 등록 
// ------------------------------------------------------------------
app.post('/api/review-reply', async (req, res) => {
    const { reviewId, userId, nickname, content } = req.body;
    if (!reviewId || !userId || !content) return res.status(400).json({ error: '정보 부족' });

    try {
        // 1. 답글 저장
        const replyRef = db.collection('reviews').doc(reviewId).collection('replies');
        await replyRef.add({
            userId,
            nickname: nickname || '익명',
            content,
            timestamp: FieldValue.serverTimestamp()
        });
        
        // ---------------------------------------------------------
        // 2. 알림 생성 로직
        // ---------------------------------------------------------
        
        // 리뷰 정보 가져오기 (작성자가 누군지 알아야 함)
        const reviewDoc = await db.collection('reviews').doc(reviewId).get();
        if (reviewDoc.exists) {
            const reviewData = reviewDoc.data();
            const authorUid = reviewData.uid; // 리뷰 쓴 사람 UID
            const authorEmail = reviewData.userId; // 리뷰 쓴 사람 이메일
            
            // 본인이 본인 글에 쓴 게 아닐 때만 알림 보냄
            if (authorEmail !== userId && authorUid) {
                
                // 책 제목 가져오기 (알림 메시지용)
                const bookDoc = await db.collection('books').doc(reviewData.bookIsbn).get();
                const bookTitle = bookDoc.exists ? bookDoc.data().title : '책';
                
                // notifications 컬렉션에 알림 저장
                await db.collection('notifications').add({
                    targetUid: authorUid, // 알림 받을 사람
                    type: 'reply',
                    message: `'${bookTitle}' 리뷰에 ${nickname}님이 답글을 남겼습니다.`,
                    link: `book-detail.html?isbn=${reviewData.bookIsbn}`, // 클릭 시 이동할 주소
                    read: false, // 아직 안 읽음
                    timestamp: FieldValue.serverTimestamp()
                });
                console.log(`[알림 생성] ${authorEmail}님에게 답글 알림 전송 완료`);
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('답글 등록 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// 답글 수정 API
// ------------------------------------------------------------------
app.put('/api/reply-edit', async (req, res) => {
    const { reviewId, replyId, userId, content } = req.body;
    
    if (!reviewId || !replyId || !userId || !content) {
        return res.status(400).json({ error: '필수 정보 누락' });
    }

    try {
        const replyRef = db.collection('reviews').doc(reviewId).collection('replies').doc(replyId);
        const doc = await replyRef.get();
        
        if (!doc.exists) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
        if (doc.data().userId !== userId) return res.status(403).json({ error: '수정 권한이 없습니다.' });
        
        await replyRef.update({ 
            content: content,
            timestamp: FieldValue.serverTimestamp() // 수정 시간 업데이트
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('답글 수정 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// 답글 삭제 API
// ------------------------------------------------------------------
app.delete('/api/reply-delete', async (req, res) => {
    const { reviewId, replyId, userId } = req.query;
    
    if (!reviewId || !replyId || !userId) {
        return res.status(400).json({ error: '필수 정보 누락' });
    }

    try {
        const replyRef = db.collection('reviews').doc(reviewId).collection('replies').doc(replyId);
        const doc = await replyRef.get();
        
        if (!doc.exists) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
        if (doc.data().userId !== userId) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
        
        await replyRef.delete();
        res.json({ success: true });
    } catch (error) {
        console.error('답글 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// 찜하기 토글
// ------------------------------------------------------------------
app.post('/api/wishlist/toggle', async (req, res) => {
    const { userId, isbn, title, image, author } = req.body;
    if (!userId || !isbn) return res.status(400).json({ error: '정보 부족' });

    try {
        const wishlistRef = db.collection('wishlists');
        const bookRef = db.collection('books').doc(isbn); // 책 정보 문서

        const snapshot = await wishlistRef
            .where('userId', '==', userId)
            .where('isbn', '==', isbn)
            .get();

        const batch = db.batch(); // 일괄 처리

        let isWished = false;
        let message = '';
        let change = 0; // 숫자 변화량

        if (!snapshot.empty) {
            // [취소] 찜 삭제 및 카운트 -1
            snapshot.forEach(doc => batch.delete(doc.ref));
            isWished = false;
            message = '찜하기가 취소되었습니다.';
            change = -1;
        } else {
            // 찜 추가 및 카운트 +1
            // 1. 책 문서가 없을 수도 있으니 먼저 안전하게 생성/업데이트
            await bookRef.set({
                isbn, title: title || '', image: image || '', author: author || ''
            }, { merge: true });

            const newDocRef = wishlistRef.doc();
            batch.set(newDocRef, {
                userId, isbn, title, image, author,
                timestamp: FieldValue.serverTimestamp()
            });
            isWished = true;
            message = '책을 찜했습니다!';
            change = 1;
        }

        // 책 문서의 wishlistCount 필드 업데이트
        batch.update(bookRef, {
            wishlistCount: FieldValue.increment(change)
        });

        await batch.commit(); // 저장 실행

        // 최신 카운트 값을 가져와서 반환
        const updatedBookDoc = await bookRef.get();
        const newCount = updatedBookDoc.data().wishlistCount || 0;

        return res.json({ isWished, message, newCount });

    } catch (error) {
        console.error('찜하기 토글 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});


// ------------------------------------------------------------------
// 특정 책 찜 여부 확인 (상세페이지용)
// ------------------------------------------------------------------
app.get('/api/wishlist/check', async (req, res) => {
    const { userId, isbn } = req.query;
    if (!userId || !isbn) return res.json({ isWished: false });

    try {
        const snapshot = await db.collection('wishlists')
            .where('userId', '==', userId)
            .where('isbn', '==', isbn)
            .get();
        
        res.json({ isWished: !snapshot.empty });
    } catch (error) {
        console.error('찜 여부 확인 오류:', error);
        res.json({ isWished: false });
    }
});

// ------------------------------------------------------------------
// 내 찜 목록 가져오기 (마이페이지용)
// ------------------------------------------------------------------
app.get('/api/wishlist/my', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID 누락' });

    try {
        const snapshot = await db.collection('wishlists')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .get();

        if (snapshot.empty) return res.json([]);

        const books = [];
        snapshot.forEach(doc => books.push(doc.data()));
        res.json(books);
    } catch (error) {
        console.error('찜 목록 로딩 오류:', error);
        // 색인 오류가 날 경우를 대비해 빈 배열 반환
        res.json([]); 
    }
});

// ------------------------------------------------------------------
// 읽는 중 여부 확인
// ------------------------------------------------------------------
app.get('/api/reading/check', async (req, res) => {
    const { userId, isbn } = req.query;
    if (!userId || !isbn) return res.json({ isReading: false });

    try {
        const snapshot = await db.collection('readings')
            .where('userId', '==', userId)
            .where('isbn', '==', isbn)
            .get();
        res.json({ isReading: !snapshot.empty });
    } catch (error) {
        res.json({ isReading: false });
    }
});

// ------------------------------------------------------------------
// 내 읽는 중 목록 가져오기
// ------------------------------------------------------------------
app.get('/api/reading/my', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID 누락' });

    try {
        const snapshot = await db.collection('readings')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .get();

        if (snapshot.empty) return res.json([]);
        
        const books = [];
        snapshot.forEach(doc => books.push(doc.data()));
        res.json(books);
    } catch (error) {
        console.error('읽는 중 목록 로딩 오류:', error);
        res.json([]); 
    }
});

// ------------------------------------------------------------------
// 읽는 중 토글 
// ------------------------------------------------------------------
app.post('/api/reading/toggle', async (req, res) => {
    const { userId, isbn, title, image, author } = req.body;
    if (!userId || !isbn) return res.status(400).json({ error: '정보 부족' });

    try {
        const readingRef = db.collection('readings');
        const bookRef = db.collection('books').doc(isbn);

        const snapshot = await readingRef
            .where('userId', '==', userId)
            .where('isbn', '==', isbn)
            .get();

        const batch = db.batch();
        let isReading = false;
        let message = '';
        let change = 0;

        if (!snapshot.empty) {
            // [취소]
            snapshot.forEach(doc => batch.delete(doc.ref));
            isReading = false;
            message = '독서 상태가 취소되었습니다.';
            change = -1;
        } else {
            await bookRef.set({
                isbn, title, image, author
            }, { merge: true });

            const newDocRef = readingRef.doc();
            batch.set(newDocRef, {
                userId, isbn, title, image, author,
                timestamp: FieldValue.serverTimestamp()
            });
            isReading = true;
            message = '읽는 중인 책으로 등록했습니다!';
            change = 1;
        }

        // 책 문서의 readingCount 필드 업데이트
        batch.update(bookRef, {
            readingCount: FieldValue.increment(change)
        });

        await batch.commit();

        const updatedBookDoc = await bookRef.get();
        const newCount = updatedBookDoc.data().readingCount || 0;

        return res.json({ isReading, message, newCount });

    } catch (error) {
        console.error('읽는 중 토글 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// ------------------------------------------------------------------
// [서버 시작]
// ------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});