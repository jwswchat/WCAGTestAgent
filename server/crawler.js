
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Crawls the given startUrl to find internal links.
 * Limits the crawl to maxPages to avoid infinite loops.
 * 
 * @param {string} startUrl - The URL to start crawling from.
 * @param {number} maxPages - Maximum number of pages to find.
 * @returns {Promise<string[]>} - List of discovered unique URLs.
 */
async function crawl(startUrl, maxPages = 20) {
    const visited = new Set();
    const queue = [startUrl];
    const pages = [];
    
    // helper to normalize URL
    const normalize = (u) => {
        try {
            const urlObj = new URL(u);
            urlObj.hash = ''; // ignore hash
            if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
                urlObj.pathname = urlObj.pathname.slice(0, -1);
            }
            return urlObj.toString();
        } catch (e) {
            return null;
        }
    };

    const domain = new URL(startUrl).hostname;

    console.log(`Starting crawl at ${startUrl}`);

    while (queue.length > 0 && pages.length < maxPages) {
        const currentUrl = queue.shift();
        const normUrl = normalize(currentUrl);

        if (!normUrl || visited.has(normUrl)) {
            continue;
        }
        
        visited.add(normUrl);

        // Check if it's the same domain
        if (new URL(normUrl).hostname !== domain) {
            continue;
        }

        pages.push(normUrl);
        console.log(`Found: ${normUrl} (${pages.length}/${maxPages})`);

        try {
            const response = await fetch(normUrl);
            // Only parse text/html
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/html')) {
                continue;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    try {
                        const nextUrl = new URL(href, normUrl).toString();
                        const nextNorm = normalize(nextUrl);
                        if (nextNorm && !visited.has(nextNorm) && new URL(nextNorm).hostname === domain) {
                            queue.push(nextUrl);
                        }
                    } catch (e) {
                        // ignore invalid urls
                    }
                }
            });

        } catch (err) {
            console.error(`Failed to fetch ${normUrl}: ${err.message}`);
        }
    }

    return pages;
}

module.exports = { crawl };
