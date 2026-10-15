"""Forward exported JSON via an Aegis receiver, using a secret from environment."""

import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request


def main():
    parser = argparse.ArgumentParser(description="Send an authorised product export to Aegis")
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--file", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = urlsplit(args.endpoint)
    if target.scheme != "https" and not (
        target.scheme == "http" and target.hostname in ("localhost", "127.0.0.1")
    ):
        raise SystemExit("Use HTTPS, or HTTP only on localhost")
    if target.username or target.password or target.query or target.fragment:
        raise SystemExit("Endpoint must not contain credentials, query or fragment")
    token = os.getenv("AEGIS_CONNECTOR_TOKEN")
    if not token:
        raise SystemExit("Set AEGIS_CONNECTOR_TOKEN locally; never pass the key in the URL")
    if args.check:
        endpoint = args.endpoint.removesuffix("/events") + "/check"
        data = None
    else:
        if not args.file:
            raise SystemExit("Provide --file, or use --check")
        if args.file.stat().st_size > 200_000:
            raise SystemExit("Maximum file size: 200 KB")
        data = args.file.read_bytes()
        json.loads(data)
        endpoint = args.endpoint
    request = Request(
        endpoint,
        data=data,
        method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    # Redirects must never forward a receiver key to another origin.
    from urllib.request import HTTPRedirectHandler, build_opener

    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    try:
        with build_opener(NoRedirect).open(request, timeout=20) as response:
            print(response.read().decode("utf-8"))
    except (HTTPError, URLError) as error:
        raise SystemExit(f"Transfer failed: {type(error).__name__}") from None


if __name__ == "__main__":
    main()
