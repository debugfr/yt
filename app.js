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

let currentApiInstance = null;
let isWispInitialized = false;

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchView = document.getElementById("search-view");
const watchView = document.getElementById("watch-view");
const videoGrid = document.getElementById("video-grid");
const videoPlayer = document.getElementById("video-player");

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

function showHome() {
  videoPlayer.pause();
  watchView.classList.remove("active");
  searchView.classList.add("active");
  videoGrid.innerHTML = `<div class="empty-state"><h2>Welcome to BerryTube</h2><p>Search for something to start watching.</p></div>`;
}

async function fetchPiped(endpoint) {
  // 1. Try direct fetch
  const instancesToTry = currentApiInstance ? [currentApiInstance, ...PIPED_INSTANCES] : PIPED_INSTANCES;
  for (const instance of instancesToTry) {
    try {
      const res = await fetch(`${instance}${endpoint}`);
      if (!res.ok) throw new Error();
      currentApiInstance = instance;
      return await res.json();
    } catch (e) {}
  }

  // 2. Direct blocked. Try libcurl.
  if (typeof libcurl !== "undefined") {
    console.warn("Direct blocked. Trying libcurl via Wisp...");
    try {
      if (!isWispInitialized) {
        await libcurl.load_wasm(); 
        isWispInitialized = true;
      }
      for (const wisp of WISP_SERVERS) {
        try {
          await libcurl.set_wisp_url(wisp);
          for (const instance of PIPED_INSTANCES) {
            try {
              const res = await libcurl.fetch(`${instance}${endpoint}`);
              if (!res.ok) throw new Error();
              currentApiInstance = instance;
              console.log("Success via libcurl");
              return await res.json();
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (err) {}
  }

  // 3. libcurl failed. Try Epoxy.
  if (typeof EpoxyTransport !== "undefined") {
    console.warn("libcurl failed. Trying Epoxy via Wisp...");
    for (const wisp of WISP_SERVERS) {
      try {
        const client = new EpoxyTransport.EpoxyClient({ wisp: wisp });
        for (const instance of PIPED_INSTANCES) {
          try {
            const res = await client.fetch(`${instance}${endpoint}`);
            if (!res.ok) throw new Error();
            currentApiInstance = instance;
            console.log("Success via Epoxy");
            return await res.json();
          } catch (e) {}
        }
      } catch (e) {}
    }
  }

  throw new Error("All APIs, libcurl, and Epoxy proxies are blocked.");
}

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  videoGrid.innerHTML = "<h2>Searching...</h2>";
  searchView.classList.add("active");
  watchView.classList.remove("active");

  try {
    const data = await fetchPiped(`/search?q=${encodeURIComponent(query)}&filter=videos`);
    videoGrid.innerHTML = "";
    if (!data.items || data.items.length === 0) {
      videoGrid.innerHTML = `<div class="empty-state"><h2>No results found</h2></div>`;
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
        <div class="info-row">
          <div class="info-avatar"></div>
          <div class="info-text">
            <h3>${item.title}</h3>
            <p>${item.uploaderName}</p>
            <p>${formatNumber(item.views)} views • ${item.uploadedDate}</p>
          </div>
        </div>
      `;
      card.addEventListener("click", () => loadVideo(videoId));
      videoGrid.appendChild(card);
    });
  } catch (err) {
    videoGrid.innerHTML = `<div class="empty-state"><h2>Error searching.</h2><p>${err.message}</p></div>`;
  }
});

async function loadVideo(videoId) {
  searchView.classList.remove("active");
  watchView.classList.add("active");
  window.scrollTo(0, 0);

  videoPlayer.src = "";
  document.getElementById("video-title").textContent = "Loading...";
  
  try {
    const data = await fetchPiped(`/streams/${videoId}`);
    
    document.getElementById("video-title").textContent = data.title;
    document.getElementById("channel-name").textContent = data.uploader;
    document.getElementById("channel-subs").textContent = `${formatNumber(data.uploaderSubscriberCount)} subscribers`;
    document.getElementById("video-views").textContent = `${formatNumber(data.views)} views`;
    document.getElementById("video-likes").innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path></svg> <span>${formatNumber(data.likes)}</span>`;
    document.getElementById("video-desc").textContent = data.description || "No description provided.";

    if (data.livestream && data.hls) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(data.hls);
        hls.attachMedia(videoPlayer);
      } else {
        videoPlayer.src = data.hls;
      }
    } else {
      videoPlayer.src = data.proxyUrl || data.videoStreams[0]?.url;
    }

    loadComments(videoId);
  } catch (err) {
    document.getElementById("video-title").textContent = "Error loading video.";
  }
}

async function loadComments(videoId) {
  const list = document.getElementById("comments-list");
  list.innerHTML = "<p>Loading comments...</p>";
  try {
    const data = await fetchPiped(`/comments/${videoId}`);
    document.getElementById("comments-count").textContent = `${formatNumber(data.commentCount)} Comments`;
    list.innerHTML = "";
    
    if (data.comments && data.comments.length > 0) {
      data.comments.slice(0, 20).forEach(comment => {
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
        list.appendChild(el);
      });
    } else {
      list.innerHTML = "<p>No comments found.</p>";
    }
  } catch (err) {
    list.innerHTML = "<p>Error loading comments.</p>";
  }
}
