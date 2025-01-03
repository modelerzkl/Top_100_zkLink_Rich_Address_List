import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { readContract } from "thirdweb";

// create the client with your clientId, or secretKey if in a server environment
const client = createThirdwebClient({
  clientId: "[Your ClientID]", // ClientIDを追加 https://thirdweb.com/
  secretKey: "[Your SecretKey]" // SecretKeyを追加 https://thirdweb.com/
});

// connect to your contract
const contract = getContract({
  client,
  chain: defineChain(810180),
  address: "0xd6d05CBdb8A70d3839166926f1b14d74d9953A08",
});

async function fetchData(tokenId) {
  try {
    const data = await readContract({
      contract,
      method: "function ownerOf(uint256 tokenId) view returns (address)",
      params: [tokenId],
    });
    console.log(`Token ID: ${tokenId}, Owner Address: ${data}`); // 結果をコンソールに出力
  } catch (error) {
    console.error(`Error reading token ID ${tokenId}:`, error);
  }
}

// トークンIDを4000から9999までループして取得
for (let tokenId = 4000; tokenId <= 9999; tokenId++) {
  fetchData(tokenId);
}

