"""
keep_engine.py — Angel OS / Google Keep bridge
================================================
Programmatic access to Google Keep for note creation, search, and sync.

ARCHITECTURE NOTE:
  Angel OS IS a distributed Google Keep on steroids.
  Google Keep is the PRIMARY cheapest cloud storage layer.
  Payload CMS is the structured internal layer.
  Keep → Payload sync happens when online.
  Payload → Keep backup keeps state portable across servers.
  Users "teleport" between servers because their Keep is their state.

USAGE:
  python keep_engine.py auth                    # first-time auth, saves master token
  python keep_engine.py create "Title" "Body"   # create a note
  python keep_engine.py search "rainmaker"      # search notes
  python keep_engine.py list [--label LABEL]    # list recent notes
  python keep_engine.py sync                    # sync titles/bodies to stdout JSON
  python keep_engine.py post "Title" < body.txt # create note from stdin body

AUTH SETUP (one-time):
  gkeepapi uses Google's account API. You need to generate an app password:
  1. Go to myaccount.google.com/apppasswords
  2. Create an app password for "Keep Engine"
  3. Run: python keep_engine.py auth
  4. Enter kenneth.courtney@gmail.com and the app password
  The master token is saved to keyring and reused on all subsequent calls.

DEPENDENCIES:
  pip install gkeepapi keyring
"""

import sys
import json
import time
import os
from pathlib import Path
from datetime import datetime

TOKEN_FILE = Path.home() / '.config' / 'angel-os' / 'keep_token.json'

# ── Auth helpers ──────────────────────────────────────────────────────────────

def load_token():
    """Load saved master token from disk."""
    if TOKEN_FILE.exists():
        data = json.loads(TOKEN_FILE.read_text())
        return data.get('master_token'), data.get('email')
    return None, None

def save_token(email: str, master_token: str):
    """Persist master token so we don't re-auth every run."""
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(json.dumps({
        'email': email,
        'master_token': master_token,
        'saved_at': datetime.now().isoformat(),
    }, indent=2))
    print(f'Token saved to {TOKEN_FILE}')

def get_keep():
    """Return an authenticated gkeepapi.Keep instance."""
    try:
        import gkeepapi
    except ImportError:
        print('[!] gkeepapi not installed. Run: pip install gkeepapi')
        sys.exit(1)

    master_token, email = load_token()
    keep = gkeepapi.Keep()

    if master_token and email:
        try:
            keep.resume(email, master_token)
            keep.sync()
            return keep
        except Exception as e:
            print(f'[!] Token resume failed: {e}')
            print('    Run: python keep_engine.py auth')
            sys.exit(1)
    else:
        print('[!] No saved token. Run: python keep_engine.py auth')
        sys.exit(1)

# ── Phases ────────────────────────────────────────────────────────────────────

def phase_auth():
    """Interactive first-time authentication — saves master token."""
    try:
        import gkeepapi
        import getpass
    except ImportError:
        print('[!] gkeepapi not installed. Run: pip install gkeepapi')
        sys.exit(1)

    email = input('Google email [kenneth.courtney@gmail.com]: ').strip()
    if not email:
        email = 'kenneth.courtney@gmail.com'

    print('App password (myaccount.google.com/apppasswords):')
    password = getpass.getpass('Password: ')

    keep = gkeepapi.Keep()
    try:
        keep.login(email, password)
        master_token = keep.getMasterToken()
        save_token(email, master_token)
        print(f'Auth successful. Master token saved.')
        print(f'Notes count: {len(list(keep.all()))}')
    except Exception as e:
        print(f'[!] Auth failed: {e}')
        print('    Make sure you are using an App Password, not your main Google password.')
        sys.exit(1)

def phase_create(title: str, body: str, labels: list = None):
    """Create a new Keep note."""
    keep = get_keep()
    note = keep.createNote(title, body)
    keep.sync()
    print(f'Created: {note.id} — {title[:60]}')
    return note.id

def phase_search(query: str, limit: int = 20):
    """Search notes by text content."""
    keep = get_keep()
    results = []
    for note in keep.find(query=query):
        results.append({
            'id': note.id,
            'title': note.title,
            'body': note.text[:200] if note.text else '',
            'labels': [l.name for l in note.labels.all()],
            'pinned': note.pinned,
            'archived': note.archived,
            'timestamps': {
                'created': str(note.timestamps.created) if note.timestamps else None,
                'updated': str(note.timestamps.updated) if note.timestamps else None,
            }
        })
        if len(results) >= limit:
            break

    print(json.dumps(results, indent=2, ensure_ascii=False))
    print(f'\n{len(results)} results for "{query}"', file=sys.stderr)
    return results

def phase_list(label_filter: str = None, limit: int = 30, pinned_only: bool = False):
    """List recent notes, optionally filtered by label."""
    keep = get_keep()
    notes = []

    for note in keep.all():
        if note.archived or note.trashed:
            continue
        if pinned_only and not note.pinned:
            continue
        if label_filter:
            label_names = [l.name for l in note.labels.all()]
            if label_filter.lower() not in [l.lower() for l in label_names]:
                continue
        notes.append({
            'id': note.id,
            'title': note.title or '(no title)',
            'preview': (note.text or '')[:100],
            'pinned': note.pinned,
            'labels': [l.name for l in note.labels.all()],
        })
        if len(notes) >= limit:
            break

    for n in notes:
        pin = '📌 ' if n['pinned'] else '   '
        labels = f" [{', '.join(n['labels'])}]" if n['labels'] else ''
        print(f"{pin}{n['title'][:60]}{labels}")
        if n['preview']:
            print(f"   {n['preview'][:80]}")

    print(f'\n{len(notes)} notes', file=sys.stderr)
    return notes

def phase_sync(output_file: str = None):
    """Dump all non-archived notes as JSON for Payload CMS import."""
    keep = get_keep()
    notes = []
    for note in keep.all():
        if note.archived or note.trashed:
            continue
        notes.append({
            'id': note.id,
            'title': note.title or '',
            'body': note.text or '',
            'pinned': note.pinned,
            'labels': [l.name for l in note.labels.all()],
            'synced_at': datetime.now().isoformat(),
        })

    output = json.dumps(notes, indent=2, ensure_ascii=False)

    if output_file:
        Path(output_file).write_text(output, encoding='utf-8')
        print(f'Synced {len(notes)} notes -> {output_file}')
    else:
        print(output)

    return notes

def phase_post_from_stdin(title: str):
    """Create a note with title from arg and body from stdin."""
    body = sys.stdin.read().strip()
    return phase_create(title, body)

# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'

    if cmd == 'auth':
        phase_auth()

    elif cmd == 'create':
        title = sys.argv[2] if len(sys.argv) > 2 else input('Title: ')
        body = sys.argv[3] if len(sys.argv) > 3 else input('Body: ')
        phase_create(title, body)

    elif cmd == 'search':
        query = sys.argv[2] if len(sys.argv) > 2 else input('Search: ')
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20
        phase_search(query, limit)

    elif cmd == 'list':
        label = sys.argv[2] if len(sys.argv) > 2 else None
        phase_list(label_filter=label)

    elif cmd == 'pinned':
        phase_list(pinned_only=True)

    elif cmd == 'sync':
        out = sys.argv[2] if len(sys.argv) > 2 else None
        phase_sync(out)

    elif cmd == 'post':
        title = sys.argv[2] if len(sys.argv) > 2 else input('Title: ')
        phase_post_from_stdin(title)

    else:
        print(__doc__)
