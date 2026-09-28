from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=Path(__file__).resolve().parents[1]/'public/icons';p.mkdir(exist_ok=True)
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#192c42"/><path d="M124 146h92c24 0 40 13 40 32v196c0-19-16-32-40-32h-92zM388 146h-92c-24 0-40 13-40 32v196c0-19 16-32 40-32h92z" fill="none" stroke="#f0eee7" stroke-width="17" stroke-linejoin="round"/><path d="M164 202h49M164 244h49M299 202h49M299 244h49" stroke="#b8a06f" stroke-width="12" stroke-linecap="round"/><path d="M256 170v206" stroke="#b8a06f" stroke-width="12"/></svg>'''
(p/'icon.svg').write_text(svg)
def draw_icon(size,mask=False):
 s=3;im=Image.new('RGB',(512*s,512*s),'#192c42');d=ImageDraw.Draw(im);factor=.8 if mask else 1;offset=51.2 if mask else 0
 def pts(v):return [((x*factor+offset)*s,(y*factor+offset)*s) for x,y in v]
 for v in [[(124,146),(216,146),(234,151),(250,165),(256,178),(256,374),(250,360),(234,347),(216,342),(124,342),(124,146)],[(388,146),(296,146),(278,151),(262,165),(256,178),(256,374),(262,360),(278,347),(296,342),(388,342),(388,146)]]:d.line(pts(v),fill='#f0eee7',width=round(17*s*factor),joint='curve')
 for v in [[(164,202),(213,202)],[(164,244),(213,244)],[(299,202),(348,202)],[(299,244),(348,244)],[(256,170),(256,376)]]:d.line(pts(v),fill='#b8a06f',width=round(12*s*factor))
 return im.resize((size,size),Image.Resampling.LANCZOS)
for name,size in [('icon-192.png',192),('icon-512.png',512),('apple-touch-icon.png',180)]:draw_icon(size).save(p/name)
draw_icon(512,True).save(p/'maskable-512.png')
im=Image.new('RGB',(1200,630),'#f2f4f6');d=ImageDraw.Draw(im);font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
im.paste(draw_icon(104),(82,96));d.text((217,110),'openlawtw',font=ImageFont.truetype(bold,62),fill='#192c42');d.line((85,292,1115,292),fill='#c5d1da',width=2);d.text((85,341),'TAIWAN BUILDING LAW ATLAS',font=ImageFont.truetype(font,33),fill='#47647f');d.text((85,427),'OFFICIAL SOURCES. CLEARER READING.',font=ImageFont.truetype(font,27),fill='#687d90');d.text((85,550),'openlawtw.vercel.app',font=ImageFont.truetype(font,21),fill='#806c43');im.save(p/'social.png')
