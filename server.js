const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// APIエンドポイント
const apiUrl = 'https://explorer-api.zklink.io/tokens/balance/list?page=1&limit=100&tokenAddress=0xC967dabf591B1f4B86CFc74996EAD065867aF19E';

// 静的ファイル（HTMLファイルなど）を提供する
app.use(express.static('public'));

// 対応する文字列とアドレス
const addressLabels = {
  '0xC9A3Cf506180757AcfCbE8D78B73E5335926e65B': 'Community Treasury',
  '0x82C1889F00EfcDaB3Cde8Ce2DBAAEa57f8Dd6D0B': 'Ecosystem Development',
  '0x9F2891F29efABd0016a0Aa30F4Dc5C866a3b00dE': 'Ecosystem Development2',
  '0x223e33eBBD7005D5a7C6ef4BAA35eBd74C691D79': 'Team & Advisors',
  '0x262cac775BBe38f161275B5d25bD365B20a2Ed00': 'Early Private Purchasers',
  '0x2123f6d10B580BAf5Eb25a16Bf62F2782cc514C6': 'Liquidity Reserve',
  '0xC407E348DC24d80201396864c588e0dec42a70FE': 'Liquidity Reserve2',
  '0xf89d7b9c864f589bbF53a82105107622B35EaA40': 'Bybit',
  '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe': 'gate.io'
};

// APIからデータを取得し、整形する
app.get('/get-balances', async (req, res) => {
  try {
    const response = await axios.get(apiUrl);
    const balances = response.data.map(item => {
      const formattedBalance = Math.floor(item.balance).toLocaleString();
      item.balance = formattedBalance + ' ZKL';
      
      // アドレスに対応するラベルを追加し、" :"を付け加える
      if (addressLabels[item.address]) {
        item.label = addressLabels[item.address] + ' :';
      }
      
      return item;
    });

    const rankedBalances = balances.map((item, index) => {
      item.Ranking = index + 1;
      return item;
    });

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

