const PIPED_INSTANCE = "https://pipedapi.kavin.rocks";

async function piped(path) {
  const res = await fetch(`${PIPED_INSTANCE}${path}`);
  if (!res.ok) throw new Error(`Piped error: ${res.status}`);
  return res.json();
}

export async function search(query) {
  const data = await piped(`/search?q=${encodeURIComponent(query)}&filter=videos`);
  return (data.items || []).map(item => ({
    id: item.url?.replace("/watch?v=", "") || "",
    title: item.title,
    thumbnail: item.thumbnail,
    uploader: item.uploaderName,
    uploaderAvatar: item.uploaderAvatar,
    duration: item.duration,
    views: item.views,
    uploaded: item.uploadedDate,
    isLive: false, // search results don't flag live; you'd check per-video
  }));
}

export async function getVideo(videoId) {
  const data = await piped(`/streams/${videoId}`);
  return {
    id: videoId,
    title: data.title,
    description: data.description,
    thumbnail: data.thumbnailUrl,
    uploader: data.uploader,
    uploaderAvatar: data.uploaderAvatar,
    likes: data.likes,
    dislikes: data.dislikes,
    views: data.views,
    duration: data.duration,
    isLive: data.livestream,
    hls: data.hls,               // livestream manifest
    dash: data.dash,             // DASH manifest (VOD)
    proxyUrl: data.proxyUrl,     // Piped's own video proxy
    videoStreams: data.videoStreams,
    audioStreams: data.audioStreams,
    related: data.relatedStreams,
    subtitles: data.subtitles,
  };
}

export async function getComments(videoId, nextpage = null) {
  const query = nextpage ? `?nextpage=${encodeURIComponent(nextpage)}` : "";
  const data = await piped(`/comments/${videoId}${query}`);
  return {
    comments: data.comments,
    nextpage: data.nextpage,
    disabled: data.disabled,
  };
}

export function proxiedThumb(url) {
  // Rewrite Piped's thumbnail URLs through your own origin
  // so they don't get blocked by school filters.
  return `/proxy?url=${encodeURIComponent(url)}`;
}
