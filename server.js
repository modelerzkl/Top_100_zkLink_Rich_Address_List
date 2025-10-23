const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// API endpoint (kept as you provided)
const apiUrl = 'https://explorer-api.zklink.io/tokens/balance/list?page=1&limit=100&tokenAddress=0xC967dabf591B1f4B86CFc74996EAD065867aF19E';

// Address labels (unchanged)
const addressLabels = {
  '0xC9A3Cf506180757AcfCbE8D78B73E5335926e65B': 'Community Treasury',
  '0x82C1889F00EfcDaB3Cde8Ce2DBAAEa57f8Dd6D0B': 'Ecosystem Development',
  '0x9F2891F29efABd0016a0Aa30F4Dc5C866a3b00dE': 'Ecosystem Development2',
  '0x223e33eBBD7005D5a7C6ef4BAA35eBd74C691D79': 'Team & Advisors',
  '0x262cac775BBe38f161275B5d25bD365B20a2Ed00': 'Early Private Purchasers',
  '0x2123f6d10B580BAf5Eb25a16Bf62F2782cc514C6': 'Liquidity Reserve',
  '0xC407E348DC24d80201396864c588e0dec42a70FE': 'Liquidity Reserve2',
  '0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23': 'Bitget',
  '0xf89d7b9c864f589bbF53a82105107622B35EaA40': 'Bybit',
  '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe': 'gate.io'
};

// serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// lightweight CORS for GETs (helps if CI or other origin requests the API)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/get-balances', async (req, res) => {
  try {
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'zkltop100-bot/1.0 (+https://zkltop100.net)'
      }
    });

    const raw = response.data;

    // Normalize API response shapes to an array
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && Array.isArray(raw.data)) {
      items = raw.data;
    } else if (raw && Array.isArray(raw.result)) {
      items = raw.result;
    } else if (raw && Array.isArray(raw.list)) {
      items = raw.list;
    } else {
      // Try to find the first array anywhere (defensive)
      for (const k of Object.keys(raw || {})) {
        if (Array.isArray(raw[k])) { items = raw[k]; break; }
      }
    }

    // Ensure we always return an array of items shaped the way the frontend expects
    const balances = items.map(item => {
      // Accept different property names safely
      const rawBalance = item.balance ?? item.amount ?? item.value ?? 0;
      const balanceNum = Number(String(rawBalance).replace(/,/g, '')) || 0;
      const formattedBalance = Number(balanceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ZKL';
      const label = item.address && addressLabels[item.address] ? addressLabels[item.address] + ' :' : undefined;
      return {
        ...item,
        balance: formattedBalance,
        label
      };
    });

    const ranked = balances.map((it, idx) => ({ ...it, Ranking: idx + 1 }));
    return res.json(ranked);
  } catch (error) {
    console.error('Error fetching data from explorer API:', error.message || error);
    // Return an empty array (200) to avoid client-side JS throwing when fetch() resolves
    return res.json([]);
  }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});