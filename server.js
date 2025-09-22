// server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const xml2js = require('xml2js');
const app = express();
const port = 3000;

// 국립중앙도서관 API 설정
// 여러분의 API 인증키를 입력하세요
const authKey = 'fa443f95d8a2012baf3e4fbbc0e62a90c28c22ae9d0d4e61746a530c30a44e22';
const host = 'http://api.nl.go.kr/NLC_BOOK_V1.0/search';

// 모든 도메인에서 요청을 허용하도록 CORS 설정
app.use(cors());

// 프론트엔드에서 책 정보를 요청하는 API 엔드포인트
app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    try {
        const response = await axios.get(host, {
            params: {
                key: authKey,
                kwd: query,
                pageSize: 10
            }
        });

        // XML 응답을 JSON으로 변환
        xml2js.parseString(response.data, (err, result) => {
            if (err || !result.channel || !result.channel.item) {
                console.error('API 응답 오류:', err);
                return res.status(404).json({ error: '책 정보를 찾을 수 없습니다.' });
            }

            const books = result.channel.item.map(apiBook => ({
                title: apiBook.title_info[0] || '제목 없음',
                author: apiBook.author_info[0] || '저자 없음',
                publisher: apiBook.pub_info[0] || '출판사 없음',
                isbn: apiBook.isbn[0] || Date.now().toString()
            }));

            res.json(books);
        });

    } catch (error) {
        console.error('API 호출 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});