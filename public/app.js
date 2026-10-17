const PIPED_API = "https://pipedapi.kavin.rocks";
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

// Utility functions
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

// Search Logic
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  videoGrid.innerHTML = "<p>Searching...</p>";
  showSearch();

  try {
    const res = await fetch(`${PIPED_API}/search?q=${encodeURIComponent(query)}&filter=videos`);
    const data = await res.json();
    
    videoGrid.innerHTML = "";
    if (!data.items || data.items.length === 0) {
      videoGrid.innerHTML = "<p>No results found.</p>";
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
    videoGrid.innerHTML = "<p>Error searching. Piped API might be down.</p>";
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
  commentsList.innerHTML = "<p>Loading comments...</p>";
  loadMoreBtn.hidden = true;

  try {
    const res = await fetch(`${PIPED_API}/streams/${videoId}`);
    const data = await res.json();

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
    const url = `${PIPED_API}/comments/${videoId}${nextpage ? `?nextpage=${encodeURIComponent(nextpage)}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!nextpage) commentsList.innerHTML = "";

    if (data.comments && data.comments.length > 0) {
      data.comments.forEach(comment => {
        const el = document.createElement("div");
        el.className = "comment";
        el.innerHTML = `
          <img src="${comment.thumbnail}" class="comment-avatar" />
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
      commentsList.innerHTML = "<p>No comments found.</p>";
    }

    currentNextPage = data.nextpage;
    loadMoreBtn.hidden = !currentNextPage;
  } catch (err) {
    commentsList.innerHTML = "<p>Error loading comments.</p>";
  }
}

loadMoreBtn.addEventListener("click", () => {
  if (currentNextPage) loadComments(currentVideoId, currentNextPage);
});
