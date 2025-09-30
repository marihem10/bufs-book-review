const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore'); 

const firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!firebaseServiceAccountJson) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되지 않았습니다.");
    // 환경 변수가 없으면 서버 실행을 중지하여 배포 오류 방지
    process.exit(1); 
}
let serviceAccount;
try {
    serviceAccount = JSON.parse(firebaseServiceAccountJson); // JSON 문자열을 JavaScript 객체로 파싱합니다.
} catch (e) {
    console.error("Firebase Service Account JSON 파싱 오류. JSON 형식을 확인하세요:", e); 
    process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(); // Firestore 인스턴스 초기화

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

// 모든 도메인에서 요청 허용
app.use(cors());

// [새로운 엔드포인트]: 리뷰 등록 시 책 정보와 리뷰를 동시에 저장/업데이트
app.post('/api/review-submit', async (req, res) => {

    if (!req.body) {
        return res.status(400).json({ error: '요청 본문(리뷰 데이터)이 누락되었습니다.' });
    }

    const { bookIsbn, userId, rating, comment } = req.body; 

    // [핵심 점검]: 필수 필드가 비어있는지 확인합니다.
    if (!bookIsbn || !userId || !rating || !comment) {
        // [수정]: 누락된 필드를 명시하여 클라이언트에게 정확한 정보를 반환합니다.
        const missingFields = [];
        if (!bookIsbn) missingFields.push('ISBN');
        if (!userId) missingFields.push('로그인 정보(userId)');
        if (!rating) missingFields.push('별점');
        if (!comment) missingFields.push('감상평');

        return res.status(400).json({ error: `필수 리뷰 정보가 누락되었습니다: ${missingFields.join(', ')}` });
    }
    
    // 1. Firebase에서 책 정보가 있는지 확인
    const bookRef = db.collection('books').doc(bookIsbn);
    const bookDoc = await bookRef.get();
    let bookData;

    if (!bookDoc.exists) {
        // 2. 책 정보가 없으면 네이버 API에서 가져와서 저장
        try {
            // ISBN에서 하이픈 등 불필요한 문자를 제거하고 검색
            const cleanIsbn = bookIsbn.replace(/[^0-9]/g, '');

            const apiResponse = await axios.get(apiHost, {
                params: { 
                    d_isbn: cleanIsbn, // 클린된 ISBN 사용
                    display: 1 
                },
                headers: {
                    'X-Naver-Client-Id': clientId,
                    'X-Naver-Client-Secret': clientSecret
                }
            });
            
            // API가 오류 코드를 반환했는지 확인합니다.
            if (apiResponse.data.errorCode) {
                 throw new Error(`네이버 API 오류: ${apiResponse.data.errorMessage}`);
            }

            const apiBook = apiResponse.data.items[0];
            if (!apiBook) throw new Error('API에서 책 정보를 찾을 수 없습니다.');

            // ... (bookData 객체 생성 및 저장 로직 유지) ...

        } catch (e) {
            console.error("책 정보 자동 저장 실패:", e.message);
            return res.status(500).json({ error: ' 책 정보 자동 생성에 실패했습니다. (API 확인 필요)' });
        }
    } else {
    
    // 3. 리뷰 데이터 reviews 컬렉션에 저장
    const reviewRef = await db.collection('reviews').add({
        bookIsbn: bookIsbn,
        userId: userId,
        rating: rating,
        comment: comment,
        timestamp: FieldValue.serverTimestamp()
    });

    // 4. books 컬렉션의 통계 데이터 업데이트 (리뷰 수 및 평균 별점)
    const newReviews = (bookData.reviews || 0) + 1;
    const newRatingSum = (bookData.ratingSum || 0) + rating;
    const newAverageRating = newRatingSum / newReviews;

    await bookRef.update({
        reviews: newReviews,
        ratingSum: newRatingSum,
        averageRating: newAverageRating // 새 평균 별점
    });

    res.status(200).json({ message: '리뷰가 성공적으로 등록되고 책 정보가 저장/업데이트되었습니다.', reviewId: reviewRef.id });
}});


app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    try {
        const response = await axios.get(apiHost, {
            params: {
                query: query,
                display: 10
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            }
        });

        const books = response.data.items.map(book => ({
            title: book.title.replace(/<[^>]*>?/g, ''),
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn || Date.now().toString(),
            image: book.image || ''
        }));

        res.json(books);

    } catch (error) {
        console.error('API 호출 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// ISBN으로 책 상세 정보를 가져오는 엔드포인트
app.get('/api/book-detail', async (req, res) => {
    const isbn = req.query.isbn; 

    if (!isbn) {
        return res.status(400).json({ error: 'ISBN이 필요합니다.' });
    }

    try {
        const response = await axios.get(apiHost, {
            params: {
                query: isbn, // [핵심 수정]: d_isbn 대신 일반 query 파라미터에 ISBN을 넣음
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
        
        // 검색 결과 중 ISBN이 정확히 일치하는 항목을 찾습니다.
        const book = response.data.items.find(item => item.isbn === isbn);

        if (!book) {
            return res.status(404).json({ error: 'ISBN이 정확히 일치하는 책을 찾을 수 없습니다.' });
        }

        // 필요한 데이터만 추출
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