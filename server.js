const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');  

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

try {
    initializeApp({
      credential: cert(serviceAccount)
    });
} catch (e) {
    console.error("Firebase Admin SDK 초기화 실패 (키 오류 가능성):", e.message);
    process.exit(1);
}

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

    // 필수 필드 확인 (bookIsbn을 사용)
    if (!bookIsbn || !userId || !rating || !comment) {
        const missingFields = [];
        if (!bookIsbn) missingFields.push('ISBN');
        // ... (나머지 필수 필드 누락 오류 처리 로직 유지) ...
        return res.status(400).json({ error: `필수 리뷰 정보가 누락되었습니다: ...` });
    }
    
    // 1. Firebase에서 책 정보가 있는지 확인
    const bookRef = db.collection('books').doc(bookIsbn); 
    const bookDoc = await bookRef.get();
    let bookData;

    if (!bookDoc.exists) {
        // 2. 책 정보가 없으면 네이버 API에서 가져와서 저장
        try {
            const apiResponse = await axios.get(apiHost, {
                params: { 
                    d_isbn: bookIsbn, // 클린된 bookIsbn 사용
                    display: 1 
                },
                headers: {
                    'X-Naver-Client-Id': clientId,
                    'X-Naver-Client-Secret': clientSecret
                }
            });

            const items = apiResponse.data.items;
            const apiBook = items && items.length > 0 ? items[0] : null;

            if (!apiResponse.data.items || apiResponse.data.items.length === 0 || !apiBook) { 
                throw new Error('네이버 API에서 유효한 책 정보를 찾을 수 없습니다.');
            }

            // 책 정보 객체 생성 및 저장
            bookData = { 
                title: apiBook.title.replace(/<[^>]*>?/g, ''),
                author: apiBook.author || '저자 없음',
                publisher: apiBook.publisher || '출판사 없음',
                isbn: bookIsbn, // bookIsbn 사용
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
    
    // 3. 리뷰 데이터 reviews 컬렉션에 저장 (bookIsbn 사용)
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
});


app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    try {
        const response = await axios.get(apiHost, {
            params: {
                query: query,
                display: 12
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

// ------------------------------------------------------------------
// [새로운 엔드포인트 1]: 인기 도서 목록 가져오기
// ------------------------------------------------------------------
app.get('/api/popular-books', async (req, res) => {
    try {
        const booksRef = db.collection('books');
        
        // 1순위: 평균 별점, 2순위: 리뷰 수로 정렬
        const q = query(
            booksRef, 
            orderBy("averageRating", "desc"),
            orderBy("reviews", "desc"), 
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return res.json([]); // 데이터가 없으면 빈 배열 반환
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
// [새로운 엔드포인트 2]: 마이페이지 리뷰 목록 가져오기
// ------------------------------------------------------------------
app.get('/api/my-reviews', async (req, res) => {
    const userEmail = req.query.userId; // 클라이언트에서 userId를 쿼리로 받음

    if (!userEmail) {
        return res.status(400).json({ error: '사용자 ID가 누락되었습니다.' });
    }

    try {
        const reviewsQuery = query(collection(db, "reviews"), where("userId", "==", userEmail));
        const querySnapshot = await getDocs(reviewsQuery);

        if (querySnapshot.empty) {
            return res.json([]); // 리뷰가 없으면 빈 배열 반환
        }

        // 리뷰 목록과 책 제목을 조합
        const reviewsWithTitles = querySnapshot.docs.map(async (document) => {
            const review = document.data();
            const reviewId = document.id;
            let bookTitle = '책 제목 정보 없음';
            
            // books 컬렉션에서 책 정보를 가져옴
            const bookRef = doc(db, "books", review.bookIsbn);
            const bookDoc = await getDoc(bookRef);
            if (bookDoc.exists()) {
                bookTitle = bookDoc.data().title || bookTitle;
            }

            return { 
                review, 
                reviewId, 
                bookTitle, 
                reviewDate: review.timestamp ? new Date(review.timestamp.toDate()).toLocaleDateString('ko-KR') : '날짜 없음'
            };
        });

        const finalReviews = await Promise.all(reviewsWithTitles);
        res.json(finalReviews);

    } catch (error) {
        console.error('마이페이지 리뷰 가져오기 실패 (서버 측):', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// ------------------------------------------------------------------
// [새로운 엔드포인트 3]: 마이페이지 리뷰 삭제 (통계 업데이트 포함)
// ------------------------------------------------------------------
app.delete('/api/review-delete', async (req, res) => {
    // [핵심]: 클라이언트가 보낸 JSON 본문에서 데이터를 가져옵니다.
    const { reviewId, bookIsbn, deletedRating } = req.body;

    if (!reviewId || !bookIsbn || deletedRating === undefined) {
        return res.status(400).json({ error: '필수 삭제 정보(reviewId, bookIsbn, rating)가 누락되었습니다.' });
    }

    try {
        const db = getFirestore(); // Firestore 인스턴스 가져오기

        // 1. [서버 로직]: books 컬렉션의 통계 데이터 업데이트 (리뷰 수 감소)
        const bookRef = db.collection('books').doc(bookIsbn);
        const bookDoc = await bookRef.get();

        if (bookDoc.exists()) {
            const firestoreData = bookDoc.data();
            const currentReviews = firestoreData.reviews || 0;
            const currentRatingSum = firestoreData.ratingSum || 0;

            if (currentReviews > 0) {
                const newReviews = currentReviews - 1;
                const newRatingSum = currentRatingSum - deletedRating;
                const newAverageRating = newReviews > 0 ? (newRatingSum / newReviews) : 0;

                await bookRef.update({
                    reviews: newReviews,
                    ratingSum: newRatingSum,
                    averageRating: newAverageRating
                });
            }
        }

        // 2. [서버 로직]: reviews 컬렉션에서 해당 리뷰 문서 삭제
        await db.collection('reviews').doc(reviewId).delete();

        res.status(200).json({ message: '리뷰 삭제 및 통계 업데이트가 성공적으로 완료되었습니다.' });

    } catch (error) {
        console.error('서버 측 리뷰 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류로 인해 리뷰 삭제에 실패했습니다.' });
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