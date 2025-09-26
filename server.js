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

// server.js (일부)

app.get('/api/book-detail', async (req, res) => {
    const isbn = req.query.isbn; 

    if (!isbn) {
        return res.status(400).json({ error: 'ISBN이 필요합니다.' });
    }

    try {
        const response = await axios.get(apiHost, {
            params: {
                d_isbn: isbn, // [핵심 수정]: ISBN 검색 파라미터 d_isbn 사용
                display: 1
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            }
        });
        
        // ... (이후 결과 처리 로직은 그대로 유지) ...
        // ... (결과가 없거나 오류가 있으면 처리) ...

        const book = response.data.items[0];

        // 필요한 데이터만 추출
        const bookDetail = {
            title: book.title.replace(/<[^>]*>?/g, ''),
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn,
            image: book.image || ''
        };

        res.json(bookDetail);

    } catch (error) {
        console.error('책 상세 정보 API 호출 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});