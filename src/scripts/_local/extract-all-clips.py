import urllib.request
import json
import re
import os

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
}

def parse_items(raw_items, video_list):
    for item in raw_items:
        if 'lockupViewModel' in item:
            lvm = item['lockupViewModel']
            vid = lvm.get('contentId')
            endpoint = lvm.get('rendererContext', {}).get('commandContext', {}).get('onTap', {}).get('innertubeCommand', {}).get('watchEndpoint', {})
            if not vid:
                vid = endpoint.get('videoId')
            
            title = lvm.get('metadata', {}).get('lockupMetadataViewModel', {}).get('title', {}).get('content', '')
            duration = ''
            overlays = lvm.get('contentImage', {}).get('thumbnailViewModel', {}).get('overlays', [])
            for ov in overlays:
                if 'thumbnailBottomOverlayViewModel' in ov:
                    badges = ov['thumbnailBottomOverlayViewModel'].get('badges', [])
                    for b in badges:
                        if 'thumbnailBadgeViewModel' in b:
                            duration = b['thumbnailBadgeViewModel'].get('text', '')
            if vid and title:
                video_list.append({
                    'videoId': vid,
                    'title': title,
                    'duration': duration,
                    'url': f'https://www.youtube.com/watch?v={vid}',
                    'thumbnailUrl': f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
                })

def fetch_playlist_all(playlist_id):
    print(f"Fetching playlist {playlist_id}...")
    url = f'https://www.youtube.com/playlist?list={playlist_id}'
    req = urllib.request.Request(url, headers={'User-Agent': HEADERS['User-Agent']})
    html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    match = re.search(r'var ytInitialData = ({.*?});</script>', html)
    if not match:
        print("Failed to find ytInitialData")
        return []

    data = json.loads(match.group(1))
    videos = []

    # 1. Page 1
    tabs = data['contents']['twoColumnBrowseResultsRenderer']['tabs']
    contents = tabs[0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents']
    parse_items(contents, videos)
    print(f"  Page 1: {len(videos)} videos")

    # Find continuation token
    token = None
    if len(contents) > 100:
        c_item = contents[100]
        if 'continuationItemViewModel' in c_item:
            token = c_item['continuationItemViewModel'].get('continuationCommand', {}).get('innertubeCommand', {}).get('continuationCommand', {}).get('token')

    # 2. Continuations
    page = 1
    while token:
        page += 1
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
                    parse_items(c_items, videos)
                    # Check if last item has continuation
                    if c_items and 'continuationItemViewModel' in c_items[-1]:
                        token = c_items[-1]['continuationItemViewModel'].get('continuationCommand', {}).get('innertubeCommand', {}).get('continuationCommand', {}).get('token')
            print(f"  Page {page}: total videos now {len(videos)}, next token: {bool(token)}")
        except Exception as e:
            print(f"Continuation error on page {page}: {e}")
            break

    # Deduplicate
    seen = set()
    unique = []
    for v in videos:
        if v['videoId'] not in seen:
            seen.add(v['videoId'])
            unique.append(v)
    return unique

clips = fetch_playlist_all('PLsFQI9PYz0b1d876LobigAz6RQhxXBjcw')
print(f"\nExtracted total {len(clips)} unique clips from MLB CLIPS playlist!")

# Save to src/data/mlb-clips.json
os.makedirs('src/data', exist_ok=True)
with open('src/data/mlb-clips.json', 'w', encoding='utf-8') as f:
    json.dump(clips, f, indent=2)

print("Saved to src/data/mlb-clips.json successfully!")
