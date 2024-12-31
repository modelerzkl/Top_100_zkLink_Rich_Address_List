const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// APIエンドポイント
const apiUrl = 'https://explorer-api.zklink.io/tokens/balance/list?page=1&limit=100&tokenAddress=0xC967dabf591B1f4B86CFc74996EAD065867aF19E';

// 静的ファイル（HTMLファイルなど）を提供する
app.use(express.static('public'));

// APIからデータを取得し、整形する
app.get('/get-balances', async (req, res) => {
  try {
    // APIからデータを取得
    const response = await axios.get(apiUrl);
    
    // 取得したデータのbalance部分に対して小数点を削除して3桁ごとにカンマを追加
    const balances = response.data.map(item => {
      const formattedBalance = Math.floor(item.balance).toLocaleString();
      item.balance = formattedBalance + ' ZKL';
      return item;
    });

    // ランキングを付ける（数値として連番）
    const rankedBalances = balances.map((item, index) => {
      item.Ranking = index + 1;  // ランキングを数値として付与
      return item;
    });

    // クライアントに返す
    res.json(rankedBalances);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// サーバーを開始
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

