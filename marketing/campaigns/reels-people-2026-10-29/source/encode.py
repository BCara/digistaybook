from pathlib import Path
import subprocess,json,zipfile
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1]
ff=imageio_ffmpeg.get_ffmpeg_exe()
data=json.loads((R/'content.json').read_text(encoding='utf-8'))
def run(args):
 subprocess.run([ff,'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
enc=['-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-r','30','-video_track_timescale','15360']
for r in data['reels']:
 name=r['id'];ref=R/'reference';work=R/'source'
 run(['-i',R/'footage'/f'{r["clip"]}.mp4','-loop','1','-i',ref/f'{name}-overlay-1.png','-loop','1','-i',ref/f'{name}-overlay-2.png','-filter_complex',"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v];[v][1:v]overlay=enable='lt(t,3.5)'[a];[a][2:v]overlay=enable='gte(t,3.5)'[out]",'-map','[out]','-t','7',*enc,work/f'{name}-live.mp4'])
 for kind,duration in [('product',5),('end',3)]:
  run(['-loop','1','-i',ref/f'{name}-{kind}.png','-t',duration,'-vf','setsar=1',*enc,work/f'{name}-{kind}.mp4'])
 listing=work/f'{name}-concat.txt';listing.write_text(''.join(f"file '{(work/f'{name}-{part}.mp4').as_posix()}'\n" for part in ['live','product','end']),encoding='utf-8')
 out=R/'assets'/f'{name}.mp4';run(['-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',out])
 run(['-i',out,'-f','null','-'])
 for t in [1,5,9,13,14.8]:run(['-ss',t,'-i',out,'-frames:v','1','-vf','scale=360:640',R/'reference'/f'{name}-qa-{t}.jpg'])
 run(['-ss','1','-i',out,'-frames:v','1','-vf','scale=540:960',R/'assets'/f'{name}-poster.jpg'])
 print(f'{name}: finished and fully decoded ({out.stat().st_size} bytes)',flush=True)
with zipfile.ZipFile(R/'DigiStayBook-people-reels.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in [*(R/'assets').glob('*'),R/'CAPTIONS.md',R/'SOURCES.md'] :z.write(f,f.relative_to(R))
print('Two Reels + download pack ready.',flush=True)
