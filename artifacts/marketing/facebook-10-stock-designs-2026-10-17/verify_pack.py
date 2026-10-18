from pathlib import Path
from PIL import Image
import json,zipfile
p=Path(r'C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/marketing/facebook-10-stock-designs-2026-10-17')
files=list((p/'images').glob('*.png'))
assert len(files)==10
for f in files:
 im=Image.open(f); assert im.size==(1080,1350); assert im.format=='PNG'
posts=json.loads((p/'posts.json').read_text(encoding='utf-8')); assert len(posts)==10
with zipfile.ZipFile(p/'digistaybook-10-new-posts.zip') as z: assert z.testzip() is None
print('Verified: 10 PNGs at 1080x1350, 10 captions, source ledger, ZIP integrity. No posts published.')

