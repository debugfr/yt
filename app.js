const PIPED_INSTANCES = [
  "https://pipedapi.adminforge.de",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.nosebs.ru",
  "https://piapi.ggtyler.dev",
  "https://pipedapi.kavin.rocks"
];

const WISP_SERVERS = [
  "wss://wandlyninns.com/wisp/",
  "wss://i-ready.math.bostoncareercounselor.com/wisp/",
  "wss://glseries.net/wisp/",
  "wss://wisp.rhw.one/wisp/",
  "wss://seminar.drama.english.assignment.literature.homebrewer.org/wisp/",
  "wss://i-ready.math.loaf.systems/wisp/",
  "wss://wisp.mercurywork.shop/wisp/",
  "wss://theavancehotel.com/fairs/",
  "wss://science-340154168.b-cdn.net/api/",
  "wss://wispserver.dev/wisp/",
  "wss://nebulaservices.org/wisp/",
  "wss://anura.pro/"
];

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchView = document.getElementById("search-view");
const watchView = document.getElementById("watch-view");
const videoGrid = document.getElementById("video-grid");
const videoPlayer = document.getElementById("video-player");
const commentsList = document.getElementById("comments-list");
const loadMoreBtn = document.getElementById("load-more-comments");

let currentNextPage = null;
let currentVideoId = null;
let activeApiInstance = null;

// UTILS
function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(seconds) {
  if (!seconds) return "LIVE";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showSearch() {
  videoPlayer.pause();
  watchView.classList.remove("active");
  searchView.classList.add("active");
}

// THE CORE LOGIC: Fetch Directly -> Fallback to Wisp
async function fetchPiped(endpoint) {
  // 1. Try standard fetch (Fastest)
  const instancesToTry = activeApiInstance ? [activeApiInstance, ...PIPED_INSTANCES] : PIPED_INSTANCES;
  
  for (const instance of instancesToTry) {
    try {
      const res = await fetch(`${instance}${endpoint}`);
      if (!res.ok) throw new Error();
      activeApiInstance = instance; // Remember the working one
      return await res.json();
    } catch (e) {} // Silent fail, try next
  }

  // 2. School blocked it? Route through Wisp
  console.warn("Direct API blocked. Switching to Wisp proxy...");
  
  if (typeof libcurl === "undefined") {
    throw new Error("libcurl not loaded");
  }

  for (const wisp of WISP_SERVERS) {
    try {
      await libcurl.setWispUrl(wisp);
      for (const instance of PIPED_INSTANCES) {
        try {
          const res = await libcurl.fetch(`${instance}${endpoint}`);
          if (!res.ok) throw new Error();
          activeApiInstance = instance;
          return await res.json();
        } catch (e) {}
      }
    } catch (e) {
      console.warn(`Wisp ${wisp} failed.`);
    }
  }
  
  throw new Error("All direct and Wisp requests failed.");
}

// Search Logic
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  videoGrid.innerHTML = "<div class='empty-state'><h2>Searching...</h2></div>";
  showSearch();

  try {
    const data = await fetchPiped(`/search?q=${encodeURIComponent(query)}&filter=videos`);
    
    videoGrid.innerHTML = "";
    if (!data.items || data.items.length === 0) {
      videoGrid.innerHTML = "<div class='empty-state'><h2>No results found.</h2></div>";
      return;
    }

    data.items.forEach(item => {
      if (!item.url) return;
      const videoId = item.url.replace("/watch?v=", "");
      
      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <div class="thumbnail">
          <img src="${item.thumbnail}" loading="lazy" />
          <span class="duration">${formatDuration(item.duration)}</span>
        </div>
        <div class="info">
          <h3>${item.title}</h3>
          <p>${item.uploaderName}</p>
          <p>${formatNumber(item.views)} views</p>
        </div>
      `;
      card.addEventListener("click", () => loadVideo(videoId));
      videoGrid.appendChild(card);
    });
  } catch (err) {
    videoGrid.innerHTML = "<div class='empty-state'><h2>Error searching.</h2><p>All APIs and Wisp proxies are blocked.</p></div>";
  }
});

// Video Playback Logic
async function loadVideo(videoId) {
  currentVideoId = videoId;
  searchView.classList.remove("active");
  watchView.classList.add("active");
  window.scrollTo(0, 0);

  videoPlayer.src = "";
  document.getElementById("video-title").textContent = "Loading...";
  document.getElementById("channel-name").textContent = "...";
  document.getElementById("video-views").textContent = "0 views";
  document.getElementById("video-likes").textContent = "👍 0";
  document.getElementById("video-dislikes").textContent = "👎 0";
  commentsList.innerHTML = "<p style='color:var(--text-secondary)'>Loading comments...</p>";
  loadMoreBtn.hidden = true;

  try {
    const data = await fetchPiped(`/streams/${videoId}`);

    document.getElementById("video-title").textContent = data.title;
    document.getElementById("channel-name").textContent = data.uploader;
    document.getElementById("video-views").textContent = `${formatNumber(data.views)} views`;
    document.getElementById("video-likes").textContent = `👍 ${formatNumber(data.likes)}`;
    document.getElementById("video-dislikes").textContent = `👎 ${formatNumber(data.dislikes)}`;

    // Handle Livestream vs Normal Video
    if (data.livestream && data.hls) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(data.hls);
        hls.attachMedia(videoPlayer);
      } else {
        videoPlayer.src = data.hls;
      }
    } else {
      // Use Piped's proxyUrl to bypass YouTube IP locks and school filters
      videoPlayer.src = data.proxyUrl || data.videoStreams[0]?.url;
    }

    loadComments(videoId);
  } catch (err) {
    document.getElementById("video-title").textContent = "Error loading video.";
  }
}

// Comments Logic
async function loadComments(videoId, nextpage = null) {
  try {
    const endpoint = `/comments/${videoId}${nextpage ? `?nextpage=${encodeURIComponent(nextpage)}` : ""}`;
    const data = await fetchPiped(endpoint);

    if (!nextpage) commentsList.innerHTML = "";

    if (data.comments && data.comments.length > 0) {
      data.comments.forEach(comment => {
        const el = document.createElement("div");
        el.className = "comment";
        el.innerHTML = `
          <img src="${comment.thumbnail}" class="comment-avatar" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0iTTEyIDh2NG0wIDR2LjAxIi8+PC9zdmc+'" />
          <div class="comment-content">
            <div class="comment-header">
              <strong>${comment.author}</strong>
              <span>${comment.commentedTime}</span>
            </div>
            <p>${comment.commentText}</p>
          </div>
        `;
        commentsList.appendChild(el);
      });
    } else if (!nextpage) {
      commentsList.innerHTML = "<p style='color:var(--text-secondary)'>No comments found.</p>";
    }

    currentNextPage = data.nextpage;
    loadMoreBtn.hidden = !currentNextPage;
  } catch (err) {
    commentsList.innerHTML = "<p style='color:var(--text-secondary)'>Error loading comments.</p>";
  }
}

loadMoreBtn.addEventListener("click", () => {
  if (currentNextPage) loadComments(currentVideoId, currentNextPage);
});
