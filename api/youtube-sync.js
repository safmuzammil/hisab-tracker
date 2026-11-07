// Vercel Serverless Function: YouTube Playlist Sync
// Fetches public or unlisted YouTube playlist feeds and returns clean video items

export default async function handler(req, res) {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let { playlistId, url } = req.query;

        if (!playlistId && url) {
            const match = url.match(/[?&]list=([^#&?]+)/);
            if (match) playlistId = match[1];
        }

        if (!playlistId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please provide a valid YouTube playlist ID or URL (e.g. list=PL...)' 
            });
        }

        // Fetch official YouTube Atom/RSS Feed for the playlist
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
        const response = await fetch(feedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: response.status === 404 
                    ? 'Playlist not found. Make sure the playlist is set to Public or Unlisted (Private playlists cannot be synced).'
                    : `YouTube returned status ${response.status}`
            });
        }

        const xml = await response.text();

        // Extract playlist title
        const feedTitleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>(.*?)<\/title>/);
        const playlistTitle = feedTitleMatch ? feedTitleMatch[1].replace(/&amp;/g, '&') : 'YouTube Playlist';

        // Parse video entries
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        const videos = [];

        while ((match = entryRegex.exec(xml)) !== null) {
            const block = match[1];
            const idMatch = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = block.match(/<title>(.*?)<\/title>/);
            const pubMatch = block.match(/<published>(.*?)<\/published>/);

            if (idMatch) {
                const vidId = idMatch[1].trim();
                let title = titleMatch ? titleMatch[1].trim() : 'YouTube Video';
                title = title
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");

                videos.push({
                    id: vidId,
                    title: title,
                    link: `https://www.youtube.com/watch?v=${vidId}`,
                    imageUrl: `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`,
                    published: pubMatch ? pubMatch[1] : null
                });
            }
        }

        return res.status(200).json({
            success: true,
            playlistId,
            playlistTitle,
            count: videos.length,
            videos
        });
    } catch (err) {
        console.error('YouTube sync error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while syncing playlist'
        });
    }
}
