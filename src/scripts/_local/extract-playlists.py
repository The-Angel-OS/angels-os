import urllib.request
import re
import json

def fetch_playlist_html(playlist_id):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    url = f'https://www.youtube.com/playlist?list={playlist_id}'
    req = urllib.request.Request(url, headers=headers)
    return urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')

def extract_videos_from_html(html):
    match = re.search(r'var ytInitialData = ({.*?});</script>', html)
    if not match:
        print("No ytInitialData match in html!")
        return []
    
    raw_str = match.group(1)
    data = json.loads(raw_str)
    
    videos = []
    
    def search_videos(obj):
        if isinstance(obj, dict):
            # Check if this dict represents a playlist video item
            if 'videoId' in obj and ('title' in obj or 'headline' in obj):
                vid = obj.get('videoId')
                title_obj = obj.get('title', {})
                title = ''
                if isinstance(title_obj, dict):
                    if 'runs' in title_obj:
                        title = title_obj['runs'][0].get('text', '')
                    elif 'simpleText' in title_obj:
                        title = title_obj.get('simpleText', '')
                    elif 'accessibility' in title_obj:
                        title = title_obj.get('accessibility', {}).get('accessibilityData', {}).get('label', '')
                elif isinstance(title_obj, str):
                    title = title_obj
                
                # Duration
                length = ''
                if 'lengthText' in obj:
                    lt = obj['lengthText']
                    if isinstance(lt, dict):
                        length = lt.get('simpleText', '')
                elif 'thumbnailOverlays' in obj:
                    for ov in obj['thumbnailOverlays']:
                        if 'thumbnailOverlayTimeStatusRenderer' in ov:
                            t_rend = ov['thumbnailOverlayTimeStatusRenderer']
                            if 'text' in t_rend:
                                length = t_rend['text'].get('simpleText', '')
                
                if vid and len(vid) == 11 and title:
                    videos.append({
                        'videoId': vid,
                        'title': title,
                        'length': length,
                        'url': f'https://www.youtube.com/watch?v={vid}'
                    })
            
            for v in obj.values():
                search_videos(v)
        elif isinstance(obj, list):
            for item in obj:
                search_videos(item)

    search_videos(data.get('contents', {}))
    return videos

p1_html = fetch_playlist_html('PLsFQI9PYz0b0fVG8EtTJoFXR97zPHg_Op') # All Episodes
p1_vids = extract_videos_from_html(p1_html)
print(f"All Episodes playlist: found {len(p1_vids)} videos")

p2_html = fetch_playlist_html('PLsFQI9PYz0b1d876LobigAz6RQhxXBjcw') # MLB Clips
p2_vids = extract_videos_from_html(p2_html)
print(f"MLB Clips playlist: found {len(p2_vids)} videos")

# Deduplicate
seen1 = set()
unique_p1 = []
for v in p1_vids:
    if v['videoId'] not in seen1:
        seen1.add(v['videoId'])
        unique_p1.append(v)

seen2 = set()
unique_p2 = []
for v in p2_vids:
    if v['videoId'] not in seen2:
        seen2.add(v['videoId'])
        unique_p2.append(v)

print(f"Unique All Episodes: {len(unique_p1)}")
print(f"Unique MLB Clips: {len(unique_p2)}")

# Save to src/data/mlb-youtube-playlists.json
out_data = {
    'allEpisodes': unique_p1,
    'mlbClips': unique_p2
}

with open('src/data/mlb-youtube-playlists.json', 'w', encoding='utf-8') as f:
    json.dump(out_data, f, indent=2)

print("Saved to src/data/mlb-youtube-playlists.json successfully!")
