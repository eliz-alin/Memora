// content.js — runs on every page, extracts meaningful words for games
(function() {
  function extractPageWords() {
    const stopWords = new Set([
      "the","a","an","and","or","but","in","on","at","to","for","of","with",
      "is","are","was","were","be","been","being","have","has","had","do","does",
      "did","will","would","could","should","may","might","shall","can","need",
      "this","that","these","those","i","you","he","she","it","we","they","my",
      "your","his","her","its","our","their","what","which","who","whom","how",
      "when","where","why","not","no","so","if","then","than","more","also",
      "from","by","as","up","about","into","through","during","before","after",
      "above","below","between","each","other","such","same","own","just","over",
    ]);

    // Collect text from meaningful elements
    const selectors = "h1,h2,h3,h4,h5,p,li,td,th,dt,dd,figcaption,blockquote,article,section";
    const elements = document.querySelectorAll(selectors);
    const raw = [...elements].map(el => el.innerText || "").join(" ");

    // Also grab page title and meta description
    const title = document.title || "";
    const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
    const combined = `${title} ${metaDesc} ${raw}`;

    // Extract words: 4–12 chars, letters only, unique
    const words = combined
      .toUpperCase()
      .match(/\b[A-Z]{4,12}\b/g) || [];

    const freq = {};
    for (const w of words) {
      if (!stopWords.has(w.toLowerCase())) {
        freq[w] = (freq[w] || 0) + 1;
      }
    }

    // Sort by frequency, take top 40
    const topWords = Object.entries(freq)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 40)
      .map(([w]) => w);

    return {
      words: topWords,
      title: title.slice(0, 60),
      url: location.hostname,
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_PAGE_WORDS") {
      sendResponse(extractPageWords());
    }
  });
})();