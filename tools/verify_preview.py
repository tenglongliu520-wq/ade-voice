"""Verify HTTP preview resources without a browser or third-party packages."""
import importlib.util
import json
import threading
import urllib.request
import urllib.error
from pathlib import Path

spec = importlib.util.spec_from_file_location('preview', Path(__file__).with_name('preview.py'))
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)
server = preview.ThreadingHTTPServer(('127.0.0.1', 0), preview.Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
origin = f'http://127.0.0.1:{server.server_port}'

def get(route):
    with urllib.request.urlopen(origin + route, timeout=5) as response:
        assert response.status == 200, route
        return response.read()

try:
    assert b'<html' in get('/')
    get('/examples/preview.js')
    for route in ('/.git/config', '/.env', '/examples/../../README.md', '/voice-i/%2e%2e/selected.json'):
        try:
            get(route)
            raise AssertionError('Unexpectedly accessible: ' + route)
        except urllib.error.HTTPError as error:
            assert error.code == 404, route
    if preview.ROOT.name == 'ade-voice':
        data = json.loads(get('/voice-i/manifest.json'))
        assert len(data['clips']) == 22
        for clip in data['clips']:
            assert get(clip['src'])[:4] == b'RIFF'
    else:
        assert get('/src/web/ade-puppet-atlas-20261112.png')[:8] == b'\x89PNG\r\n\x1a\n'
        get('/src/web/ade-motion-model.js')
        get('/src/web/companion-avatar.js')
        if preview.VOICE.is_dir():
            data = json.loads(get('/voice-i/manifest.json'))
            assert get(data['clips'][0]['src'])[:4] == b'RIFF'
    print('PASS: preview resources, media routes, and directory isolation')
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=3)
