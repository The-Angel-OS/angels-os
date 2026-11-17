import urllib.request
import json
import re
import os

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
}

def find_continuation_token(obj):
    if isinstance(obj, dict):
        if 'continuationCommand' in obj and 'token' in obj['continuationCommand']:
            return obj['continuationCommand']['token']
        for v in obj.values():
            tok = find_continuation_token(v)
            if tok:
                return tok
    elif isinstance(obj, list):
        for item in reversed(obj):  # usually at the end
            tok = find_continuation_token(item)
            if tok:
                return tok
    return None

def extract_videos_from_list(items, videos):
    for item in items:
        if 'lockupViewModel' in item:
            lvm = item['lockupViewModel']
            title = lvm.get('metadata', {}).get('lockupMetadataViewModel', {}).get('title', {}).get('content', '')
            endpoint = lvm.get('rendererContext', {}).get('commandContext', {}).get('onTap', {}).get('innertubeCommand', {}).get('watchEndpoint', {})
            vid = endpoint.get('videoId')
            # Extract duration overlay if present
            duration = ''
            overlays = lvm.get('contentImage', {}).get('thumbnailViewModel', {}).get('overlays', [])
            for ov in overlays:
                if 'thumbnailOverlayTimeStatusViewModel' in ov:
                    duration = ov['thumbnailOverlayTimeStatusViewModel'].get('text', '')
            if vid and title:
                videos.append({
                    'videoId': vid,
                    'title': title,
                    'duration': duration,
                    'url': f'https://www.youtube.com/watch?v={vid}'
                })
        elif 'playlistVideoRenderer' in item:
            pvr = item['playlistVideoRenderer']
            vid = pvr.get('videoId')
            title = pvr.get('title', {}).get('runs', [{}])[0].get('text', '')
            duration = pvr.get('lengthText', {}).get('simpleText', '')
            if vid and title:
                videos.append({
                    'videoId': vid,
                    'title': title,
                    'duration': duration,
                    'url': f'https://www.youtube.com/watch?v={vid}'
                })

def fetch_full_playlist(playlist_id):
    print(f"\n==========================================")
    print(f"Fetching playlist: {playlist_id}...")
    url = f'https://www.youtube.com/playlist?list={playlist_id}'
    req = urllib.request.Request(url, headers={'User-Agent': HEADERS['User-Agent']})
    html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')

    match = re.search(r'var ytInitialData = ({.*?});</script>', html)
    if not match:
        print(f"Failed to find ytInitialData for {playlist_id}")
        return []

    data = json.loads(match.group(1))
    videos = []

    # Process first batch
    try:
        tabs = data['contents']['twoColumnBrowseResultsRenderer']['tabs']
        tab_content = tabs[0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents']
        extract_videos_from_list(tab_content, videos)
    except Exception as e:
        print(f"Error reading initial contents: {e}")

    # Find token
    token = find_continuation_token(data)
    page_num = 1
    print(f"Page 1: extracted {len(videos)} videos. Next token: {bool(token)}")

    while token:
        page_num += 1
        print(f"  Fetching page {page_num}...")
        body = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20241115.00.00"
                }
            },
            "continuation": token
        }
        token = None
        req = urllib.request.Request("https://www.youtube.com/youtubei/v1/browse", data=json.dumps(body).encode('utf-8'), headers=HEADERS)
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=20).read().decode('utf-8'))
            actions = resp.get('onResponseReceivedActions', [])
            for a in actions:
                if 'appendContinuationItemsAction' in a:
                    c_items = a['appendContinuationItemsAction'].get('continuationItems', [])
                    extract_videos_from_list(c_items, videos)
                    token = find_continuation_token(c_items)
            print(f"    Page {page_num} total videos so far: {len(videos)}. Next token: {bool(token)}")
        except Exception as err:
            print(f"Continuation error: {err}")
            break

    # Deduplicate preserving order
    seen = set()
    unique = []
    for v in videos:
        if v['videoId'] not in seen:
            seen.add(v['videoId'])
            unique.append(v)

    print(f"Finished playlist {playlist_id}: total unique videos = {len(unique)}")
    return unique

# 1. Fetch both playlists
all_episodes = fetch_full_playlist('PLsFQI9PYz0b0fVG8EtTJoFXR97zPHg_Op')
mlb_clips = fetch_full_playlist('PLsFQI9PYz0b1d876LobigAz6RQhxXBjcw')

# 2. Save raw playlist output
out = {
    'allEpisodes': all_episodes,
    'mlbClips': mlb_clips
}
os.makedirs('src/data', exist_ok=True)
with open('src/data/mlb-youtube-playlists.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)

print(f"\nSaved {len(all_episodes)} All Episodes and {len(mlb_clips)} MLB Clips to src/data/mlb-youtube-playlists.json!")

# 3. Compare with existing mlb-archive.json
with open('src/data/mlb-archive.json', encoding='utf-8') as f:
    archive = json.load(f)

existing_episodes = archive.get('episodes', [])
existing_ids = set()
for ep in existing_episodes:
    v_url = ep.get('videoUrl') or ep.get('ytUrl') or ''
    m = re.search(r'v=([a-zA-Z0-9_-]{11})', v_url)
    if m:
        existing_ids.add(m.group(1))

print(f"\nExisting archive has {len(existing_episodes)} episodes ({len(existing_ids)} unique video IDs in archive).")

missing_from_episodes = [v for v in all_episodes if v['videoId'] not in existing_ids]
print(f"Found {len(missing_from_episodes)} videos in 'All Episodes' playlist that are NOT in current archive!")
for idx, v in enumerate(missing_from_episodes):
    print(f"  #{idx+1}: [{v['videoId']}] {v['title']}")

missing_from_clips = [v for v in mlb_clips if v['videoId'] not in existing_ids]
print(f"\nFound {len(missing_from_clips)} videos in 'MLB Clips' playlist that are NOT in current archive!")
for idx, v in enumerate(missing_from_clips[:15]):
    print(f"  #{idx+1}: [{v['videoId']}] {v['title']}")
if len(missing_from_clips) > 15:
    print(f"  ... and {len(missing_from_clips) - 15} more clips.")
