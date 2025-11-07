const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

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
    console.error("Firebase Service Account JSON 파싱 오류. JSON 형식을 확인하세요:", e);
    process.exit(1);
}

let firebaseApp; // 앱 변수 선언
try {
    firebaseApp = initializeApp({ // [수정 2] 기본 앱이 아닌 'app' 변수에 초기화
      credential: cert(serviceAccount)
    });

} catch (e) {
    console.error("Firebase Admin SDK 초기화 실패 (키 오류 가능성):", e.message);
    process.exit(1);
}

const db = getFirestore(firebaseApp); 
const adminAuth = getAuth(firebaseApp);


const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors()); 

// 네이버 API 설정
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
        return res.status(400).json({ error: '필수 삭제 정보(reviewId, bookIsbn, rating)가 누락되었습니다.' });
    }
    console.log(`[삭제 요청 수신] reviewId: ${reviewId}, bookIsbn: ${bookIsbn}, rating: ${deletedRating}`);
    try {
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
                console.log(`[삭제 - 1단계] ${bookIsbn} 통계 업데이트 중...`);
                await bookRef.update({
                    reviews: newReviews,
                    ratingSum: newRatingSum,
                    averageRating: newAverageRating
                });
            } else {
                console.log(`[삭제 - 1단계] ${bookIsbn} 리뷰가 0이라 통계 업데이트 스킵.`);
            }
        } else {
            console.warn(`[삭제 - 1단계 경고] ${bookIsbn} 책 통계 문서를 찾을 수 없습니다.`);
        }
        console.log(`[삭제 - 2단계] ${reviewId} 리뷰 삭제 중...`);
        await db.collection('reviews').doc(reviewId).delete();
        console.log(`[삭제 성공] ${reviewId} 처리 완료.`);
        res.status(200).json({ message: '리뷰 삭제 및 통계 업데이트가 성공적으로 완료되었습니다.' });
    } catch (error) {
        console.error('서버 측 리뷰 삭제 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 리뷰 삭제에 실패했습니다.', details: error.message });
    }
});

// ------------------------------------------------------------------
// 마이페이지 리뷰 수정
// ------------------------------------------------------------------
app.put('/api/review-edit', async (req, res) => {
    // 1. 클라이언트로부터 정보를 받습니다.
    const { reviewId, bookIsbn, newComment } = req.body;
    
    //newRating과 oldRating을 숫자로 변환하고 NaN 검사를 합니다.
    const newRating = parseInt(req.body.newRating, 10);
    const oldRating = parseInt(req.body.oldRating, 10);

    // 데이터 유효성 검사 (NaN 검사 포함)
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
// 계정 삭제 (데이터 및 통계 포함)
// ------------------------------------------------------------------
app.delete('/api/delete-account', async (req, res) => {
    
    // 1. 클라이언트가 보낸 ID 토큰을 헤더에서 추출
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    let decodedToken;
    try {
        // 2. ID 토큰 검증 (이 사용자가 진짜 본인인지 확인)
        decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
    }

    const uid = decodedToken.uid;
    const userEmail = decodedToken.email;

    if (!uid || !userEmail) {
        return res.status(400).json({ error: '토큰에서 사용자 정보를 찾을 수 없습니다.' });
    }
    
    console.log(`[계정 삭제 시작] UID: ${uid}, Email: ${userEmail}`);

    try {
        const batch = db.batch(); // 여러 작업을 한 번에 처리하기 위한 배치

        // 3. (Firestore) 이 사용자가 쓴 모든 'reviews' 찾기
        const reviewsQuery = db.collection('reviews').where('userId', '==', userEmail);
        const snapshot = await reviewsQuery.get();

        if (!snapshot.empty) {
            console.log(`${snapshot.size}개의 리뷰를 삭제하고 통계를 업데이트합니다.`);
            
            // 4. (Firestore) 모든 리뷰를 순회하며 통계 업데이트 및 삭제 배치
            for (const doc of snapshot.docs) {
                const review = doc.data();
                const bookIsbn = review.bookIsbn;
                const rating = review.rating;
                
                if (bookIsbn && rating) {
                    const bookRef = db.collection('books').doc(bookIsbn);
                    
                    batch.update(bookRef, {
                        reviews: FieldValue.increment(-1),
                        ratingSum: FieldValue.increment(-rating)
                    });
                }
                // 리뷰 문서 삭제
                batch.delete(doc.ref);
            }
            
            // 5. (Firestore) 배치 작업 실행
            await batch.commit();
        } else {
            console.log('삭제할 리뷰가 없습니다.');
        }

        // 6. (Auth) Firestore 데이터 정리 후, Auth에서 사용자 계정 삭제
        await adminAuth.deleteUser(uid);
        
        console.log(`[계정 삭제 성공] ${userEmail} 계정 및 데이터 삭제 완료.`);
        res.status(200).json({ message: '계정 및 모든 리뷰가 성공적으로 삭제되었습니다.' });

    } catch (error) {
        console.error("서버 측 계정 삭제 오류:", error);
        res.status(500).json({ error: '계정 삭제 중 서버 오류가 발생했습니다.', details: error.message });
    }
});

// ------------------------------------------------------------------
// [서버 시작]
// ------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});