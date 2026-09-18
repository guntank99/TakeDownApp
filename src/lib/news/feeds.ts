export interface NewsFeed {
  id: string;
  /** Outlet name shown to users. */
  name: string;
  url: string;
}

/**
 * Official RSS feeds published by Indonesian news outlets for syndication.
 * Only the headline, a short snippet and the link are used, and every item
 * links back to the publisher. Availability was checked on 2026-09-19;
 * feeds can change or disappear, which the service tolerates. Outlets that
 * refuse automated access (e.g. Tribunnews answered 403) are left out rather
 * than worked around.
 */
export const NEWS_FEEDS: NewsFeed[] = [
  { id: "antara", name: "Antara", url: "https://www.antaranews.com/rss/terkini.xml" },
  { id: "antara-top", name: "Antara", url: "https://www.antaranews.com/rss/top-news.xml" },
  { id: "cnn", name: "CNN Indonesia", url: "https://www.cnnindonesia.com/rss" },
  { id: "tempo", name: "Tempo", url: "https://rss.tempo.co/nasional" },
  { id: "republika", name: "Republika", url: "https://www.republika.co.id/rss" },
  { id: "bbc", name: "BBC News Indonesia", url: "https://www.bbc.com/indonesia/index.xml" },
  { id: "jpnn", name: "JPNN", url: "https://www.jpnn.com/index.php?mib=rss" },
  { id: "okezone", name: "Okezone", url: "https://www.okezone.com/rss" },
];
