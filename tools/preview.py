"""Python 3.9+ local preview. No external dependencies; loopback only."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse

ROOT = Path(__file__).resolve().parents[1]
VOICE = ROOT if ROOT.name == 'ade-voice' else ROOT.parent / 'ade-voice'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, request):
        route = unquote(urlsplit(request).path)
        if route == '/':
            route = '/examples/index.html'
        base = ROOT
        if route.startswith('/voice-i/'):
            base = VOICE / 'voices' / 'I'
            relative = route[len('/voice-i/'):]
        elif route == '/src/web/ade-puppet-atlas-20261112.png':
            relative = 'assets/hanfu-20261112/ade-puppet-atlas-20261112.png'
        elif route.startswith(('/examples/', '/src/web/')):
            relative = route.lstrip('/')
        else:
            return str(ROOT / '.not-served')
        candidate = (base / relative).resolve()
        if (not candidate.is_relative_to(base.resolve()) or
                any(part.startswith('.') for part in Path(relative).parts) or
                not candidate.is_file()):
            return str(ROOT / '.not-served')
        return str(candidate)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4190 if ROOT.name == 'ade-voice' else 4191)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    print(f'Open http://127.0.0.1:{server.server_port}/ (Ctrl+C to stop)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
