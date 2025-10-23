// server.js
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurable values via ENV
const API_URL = process.env.EXPLORER_API_URL || 'https://explorer-api.zklink.io/tokens/balance/list?page=1&limit=100&tokenAddress=0xC967dabf591B1f4B86CFc74996EAD065867aF19E';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000; // 5 minutes
const ARCHIVE_SECRET = process.env.ARCHIVE_SECRET || ''; // optional secret to protect /save-to-archive
const ARCHIVE_USER_AGENT = process.env.ARCHIVE_USER_AGENT || 'zkl-top100-bot/1.0 (+https://yourdomain.example)';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// optional labels mapping (you can extend this)
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

// Simple in-memory cache
let balancesCache = {
  ts: 0,
  data: null
};

// Utility: parse balances from API response (robust)
function parseBalancesResponse(apiResponse) {
  // The explorer API might return { data: [...] } or [...] directly
  const raw = apiResponse && apiResponse.data ? apiResponse.data : apiResponse;
  // Sometimes nested: { data: { items: [...] } }
  const arr = Array.isArray(raw) ? raw : (raw && raw.items ? raw.items : []);
  return arr;
}

// GET /get-balances
app.get('/get-balances', async (req, res) => {
  try {
    const now = Date.now();
    if (balancesCache.data && (now - balancesCache.ts) < CACHE_TTL_MS) {
      return res.json(balancesCache.data);
    }

    const response = await axios.get(API_URL, { timeout: 15000 });
    const rawList = parseBalancesResponse(response.data);

    // Normalize items: ensure { address, balance } and parse numeric amount
    const normalized = rawList.map(item => {
      // handle shapes like { address, balance } or { owner: address, balance: '123' }
      const address = item.address || item.owner || item.holder || item.account;
      const balanceStr = item.balance || item.amount || item.value || '0';
      const balanceNum = Number(String(balanceStr).replace(/,/g, '')) || 0;
      return {
        ...item,
        address,
        balanceNum
      };
    }).filter(it => it.address);

    const total = normalized.reduce((s, it) => s + (Number(it.balanceNum) || 0), 0) || 0.0;

    // Format items and ranking
    const sorted = normalized.sort((a, b) => Number(b.balanceNum) - Number(a.balanceNum));
    const result = sorted.map((it, idx) => {
      const formattedBalance = Number(it.balanceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ZKL';
      const percentage = total > 0 ? (Number(it.balanceNum) / total * 100) : 0;
      return {
        Ranking: idx + 1,
        address: it.address,
        rawBalance: Number(it.balanceNum),
        balance: formattedBalance,
        percentage: Number(percentage.toFixed(6)),
        label: addressLabels[it.address] ? addressLabels[it.address] + ' :' : undefined
      };
    });

    // cache
    balancesCache = { ts: Date.now(), data: result };

    res.json(result);
  } catch (error) {
    console.error('Error fetching balances:', error && error.message ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

/**
 * POST /save-to-archive
 * Body: { url: 'https://example.com' }
 * Optional header: X-ARCHIVE-SECRET (if ARCHIVE_SECRET is set)
 *
 * This endpoint will call https://web.archive.org/save/<encoded-url>
 * and return the snapshot URL (if available).
 */
const recentSaves = new Map(); // simple in-memory rate control: url -> timestamp

app.post('/save-to-archive', async (req, res) => {
  try {
    const providedSecret = req.header('X-ARCHIVE-SECRET') || req.body.secret || '';
    if (ARCHIVE_SECRET && providedSecret !== ARCHIVE_SECRET) {
      return res.status(403).json({ error: 'Invalid archive secret' });
    }

    const target = (req.body && req.body.url) ? String(req.body.url).trim() : '';
    if (!target || !/^https?:\/\//i.test(target)) {
      return res.status(400).json({ error: 'Invalid or missing url in body' });
    }

    // Simple rate-limit: same URL cannot be snapped more than once per 6 hours (configurable)
    const MIN_INTERVAL_MS = Number(process.env.ARCHIVE_MIN_INTERVAL_MS) || (6 * 60 * 60 * 1000);
    const last = recentSaves.get(target) || 0;
    const now = Date.now();
    if (now - last < MIN_INTERVAL_MS && !ARCHIVE_SECRET) { // allow bypass with secret
      return res.status(429).json({ error: 'Recently saved. Please wait before saving again.' });
    }

    // Perform save request
    const saveApi = 'https://web.archive.org/save/' + encodeURIComponent(target);
    let snapshotUrl = null;
    try {
      // We expect a redirect (302) to the snapshot; set maxRedirects: 0 to capture Location header
      await axios.get(saveApi, {
        timeout: 30000,
        maxRedirects: 0,
        headers: {
          'User-Agent': ARCHIVE_USER_AGENT,
          'Accept': 'text/html'
        },
        validateStatus: null
      }).then(response => {
        // 302/301 redirect handling
        if (response.status === 302 || response.status === 301) {
          const loc = response.headers.location || response.headers['content-location'];
          if (loc) {
            snapshotUrl = loc.startsWith('http') ? loc : ('https://web.archive.org' + loc);
          }
        } else if (response.status === 200) {
          // Some responses may return 200 and include 'content-location' header
          const cl = response.headers['content-location'] || response.headers.location;
          if (cl) snapshotUrl = cl.startsWith('http') ? cl : ('https://web.archive.org' + cl);
        } else {
          // Could be 429 or 503 - capture body message later
        }
      });
    } catch (err) {
      // axios throws for non-2xx only if validateStatus defaults; we set validateStatus:null so this should be rare.
      console.warn('Archive save axios error:', err && err.message);
    }

    recentSaves.set(target, now);

    if (snapshotUrl) {
      return res.json({ success: true, snapshot: snapshotUrl });
    } else {
      // If we couldn't get the redirect, return a helpful URL where user can try manually
      const manual = 'https://web.archive.org/save/' + encodeURIComponent(target);
      return res.status(202).json({ success: false, message: 'Save request accepted but snapshot URL not returned. You can try the manual save URL.', manualSaveUrl: manual });
    }
  } catch (err) {
    console.error('save-to-archive error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to request archive snapshot' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
