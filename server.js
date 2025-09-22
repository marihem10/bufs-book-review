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

        const books = response.data.items.reduce((uniqueBooks, book) => {
    // 1. 책 제목에서 HTML 태그 제거
    const uniqueTitle = book.title.replace(/<[^>]*>?/g, '');

    // 2. 제목에 한글이 포함되어 있는지 확인합니다.
    const isKorean = /[가-힣]/.test(uniqueTitle);

    // 3. 한글이 없으면 건너뜁니다.
    if (!isKorean) return uniqueBooks;

    const existingBookIndex = uniqueBooks.findIndex(item => item.title === uniqueTitle);
    
    // 4. 이미 같은 제목의 책이 배열에 있다면
    if (existingBookIndex !== -1) {
        // 이미 저장된 책에 이미지가 없는데, 지금 책에 이미지가 있다면 업데이트합니다.
        if (!uniqueBooks[existingBookIndex].image && book.image) {
            uniqueBooks[existingBookIndex] = {
                title: uniqueTitle,
                author: book.author || '저자 없음',
                publisher: book.publisher || '출판사 없음',
                isbn: book.isbn,
                image: book.image
            };
        }
    } else {
        // 5. 같은 제목의 책이 배열에 없다면, 새롭게 추가합니다.
        uniqueBooks.push({
            title: uniqueTitle,
            author: book.author || '저자 없음',
            publisher: book.publisher || '출판사 없음',
            isbn: book.isbn,
            image: book.image || ''
        });
    }

    return uniqueBooks;
}, []);

        res.json(books);

    } catch (error) {
        console.error('API 호출 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});