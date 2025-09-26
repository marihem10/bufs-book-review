const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// 네이버 API 설정
const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;
const apiHost = 'https://openapi.naver.com/v1/search/book.json';

// 모든 도메인에서 요청 허용
app.use(cors());

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
    // 쿼리 파라미터에서 ISBN을 안전하게 가져옵니다.
    const isbn = req.query.isbn; 

    if (!isbn) {
        // ISBN이 없으면 400 Bad Request 에러 반환
        return res.status(400).json({ error: 'ISBN이 필요합니다.' });
    }

    try {
        // 네이버 도서 API를 호출합니다.
        const response = await axios.get(apiHost, {
            params: {
                d_isbn: isbn, // [핵심]: ISBN 검색은 'd_isbn' 파라미터를 사용합니다.
                display: 1    // 검색 결과는 1개만 요청합니다.
            },
            headers: {
                // 환경 변수로 설정된 Client ID와 Secret을 사용합니다.
                'X-Naver-Client-Id': clientId, 
                'X-Naver-Client-Secret': clientSecret
            }
        });

        // 결과 항목이 없거나 오류가 있으면 처리
        if (!response.data.items || response.data.items.length === 0) {
            return res.status(404).json({ error: '해당 ISBN의 책 정보를 찾을 수 없습니다.' });
        }
        
        const book = response.data.items[0];

        // 클라이언트로 보낼 책 상세 정보 객체
        const bookDetail = {
            title: book.title.replace(/<[^>]*>?/g, ''), // HTML 태그 제거
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn,
            image: book.image || 'https://via.placeholder.com/200x300' // 이미지가 없을 경우 대체 이미지 사용
        };

        res.json(bookDetail);

    } catch (error) {
        console.error('책 상세 정보 API 호출 실패:', error);
        // 서버 측에서 오류가 나면 500 에러 반환
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다. (API 확인 필요)' });
    }
});