export default async function handler(req, res) {
  const { symbol } = req.query;
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`, {
      headers: {
        // This is the magic line that tricks Yahoo into thinking we are a real Chrome browser
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch from Yahoo" });
  }
}
