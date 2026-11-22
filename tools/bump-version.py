"""index.html の APP_VERSION と version.json を同じ版番号にそろえる。公開する前に毎回実行する。"""
import json, pathlib, re, datetime

root = pathlib.Path(__file__).resolve().parent.parent
version = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y.%m.%d-%H%M%S")
html = root / "index.html"
text = html.read_text(encoding="utf-8")
text, n = re.subn(r'const APP_VERSION="[^"]*"', f'const APP_VERSION="{version}"', text)
assert n == 1, "APP_VERSION が見つからない"
html.write_text(text, encoding="utf-8")
(root / "version.json").write_text(json.dumps({"version": version}) + "\n", encoding="utf-8")
print(version)
