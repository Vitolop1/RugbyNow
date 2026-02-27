import json
import sys

# uso:
# python scripts/jsonl_to_json.py logs/flashscore_xxx.jsonl public/flashscore_dump.json

src = sys.argv[1]
dst = sys.argv[2]

rows = []
with open(src, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))

with open(dst, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f"wrote {len(rows)} rows -> {dst}")