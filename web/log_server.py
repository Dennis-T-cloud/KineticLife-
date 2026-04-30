#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys


class KineticLifeHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        if self.path == "/__log":
            return
        super().log_message(format, *args)

    def do_POST(self):
        if self.path != "/__log":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(min(length, 4096)).decode("utf-8", "replace")
        print(f"[web] {self.client_address[0]} {body}", flush=True)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_OPTIONS(self):
        if self.path == "/__log":
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        super().do_OPTIONS()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
    server = ThreadingHTTPServer(("0.0.0.0", port), KineticLifeHandler)
    print(f"Serving KineticLife web with host logs on http://0.0.0.0:{port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
