import math, os, subprocess, wave
from pathlib import Path
import cv2 as cv
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(os.environ['CNY_BUILD'])
out = Path(os.environ['CNY_OUTPUT'])
ff = imageio_ffmpeg.get_ffmpeg_exe()
fps, sr = 30, 48000
W,H = 900,1600
rng=np.random.default_rng(1929)
dialogue = [
    ('mom',2.65,2.78), ('hesitate',5.46,1.09), ('vo',6.61,2.2),
    ('pressure',8.94,4.14), ('dinner',13.32,4.93), ('tired',18.64,4.05)
]
n=25*sr
mix=np.zeros((n,2),np.float32)
speech={}
voice_dir=Path(os.environ['CNY_VOICE_DIR'])
def place(y,start,pan=0):
    k=int(start*sr)
    y=y[:len(mix)-k]
    mix[k:k+len(y)] += y[:,None]*np.array([1-pan,1+pan])
def filt(a,frequency,kind):
    alpha=math.exp(-2*math.pi*frequency/sr)
    y=np.empty_like(a)
    acc=0.
    for i,x in enumerate(a):
        acc=alpha*acc+(1-alpha)*x
        y[i]=acc
    return y if kind=='low' else a-y
def decode(path, fx=''):
    args=[ff,'-v','error','-i',str(path)]
    if fx: args+=['-af',fx]
    return np.frombuffer(subprocess.check_output(args+['-ac','1','-ar',str(sr),'-f','f32le','-']),np.float32)
for name,start,window in dialogue:
    p=voice_dir/f'{name}.wav'
    fx = {
        'mom': 'highpass=f=210,lowpass=f=3180,equalizer=f=480:t=q:w=1:g=2.0,acompressor=threshold=0.13:ratio=2',
        'hesitate': 'highpass=f=75,treble=g=-2.6',
        'pressure': 'highpass=f=69,equalizer=f=205:t=q:w=1:g=1.5',
        'dinner': 'highpass=f=75,treble=g=-0.9',
        'tired': 'highpass=f=72,equalizer=f=275:t=q:w=1:g=1.4,treble=g=-2.7',
    }.get(name, 'highpass=f=75')
    y=decode(p,fx)
    pause_edits = {'hesitate': (1.51,2.51), 'pressure': (.72,1.31), 'dinner': (2.85,3.25), 'tired': (3.82,4.28)}
    if name in pause_edits:
        pause_start, pause_end = (int(sec*sr) for sec in pause_edits[name])
        join = int(.016*sr)
        taper = np.linspace(0,1,join)
        overlap = y[pause_start-join:pause_start]*(1-taper) + y[pause_end:pause_end+join]*taper
        y = np.concatenate((y[:pause_start-join],overlap,y[pause_end+join:]))
    hop = 240
    energy = np.sqrt(np.mean(y[:(len(y)//hop)*hop].reshape(-1,hop)**2, axis=1))
    above = np.flatnonzero(energy > max(.0018, energy.max()*.031))*hop
    lo=max(0,above[0]-int(.038*sr))
    hi=min(len(y),above[-1]+hop+int(.070*sr))
    y=y[lo:hi].copy()
    if len(y)>sr*window:
        factor=len(y)/(sr*window)
        wav=root/f'{name}-trim.wav'
        with wave.open(str(wav),'wb') as f:
            f.setparams((1,2,sr,0,'NONE','not compressed'))
            f.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
        y=decode(wav,f'atempo={factor:.5f}').copy()
    y=y[:round(sr*window)]
    fade=min(len(y)//3,720)
    y[:fade]*=np.linspace(0,1,fade)
    y[-fade:]*=np.linspace(1,0,fade)
    gains = {'mom': .40, 'hesitate': .27, 'vo': .43, 'pressure': .48, 'dinner': .43, 'tired': .42}
    y *= gains[name]/max(.10,np.max(np.abs(y)))
    fraction = np.linspace(0,1,len(y))
    if name == 'pressure':
        y *= np.interp(fraction,[0,.17,.52,.74,1],[.74,.94,1.,1.15,.86])
    elif name == 'dinner':
        y *= np.interp(fraction,[0,.38,.53,.72,1],[1.0,1.04,.81,.92,.78])
    elif name == 'tired':
        y *= np.interp(fraction,[0,.44,.52,.79,1],[1.0,1.04,.79,.87,.69])
    speech[name]=(start,y)
    place(y,start,-.06 if name=='mom' else 0)
    with wave.open(str(root/f'{name}-fitted.wav'),'wb') as f:
        f.setparams((1,2,sr,0,'NONE','not compressed'))
        f.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
    print(name,round(len(y)/sr,2),flush=True)

t=np.arange(n)/sr
room=filt(rng.standard_normal(n).astype(np.float32),280,'low')*.016
mix+=(room*(1-np.clip((t-24.4)/.6,0,1)))[:,None]
for j,start in enumerate([.08,.19,.31,.46,.54,.67,.84,.96,1.07]):
    a=np.arange(3360)/sr
    y=(.65*rng.standard_normal(len(a))+.8*np.sin(2*np.pi*(1050+j*23)*a))*np.exp(-a*210)
    place(.053*y,start,-.26)
for start in (1.19,1.60):
    a=np.arange(int(.29*sr))/sr
    e=np.clip(a/.018,0,1)*np.clip((.29-a)/.065,0,1)
    y=(np.sin(2*np.pi*109*a)+.32*np.sin(2*np.pi*218*a)+.14*rng.standard_normal(len(a)))*e
    place(.075*y,start,.13)
static=np.zeros(n,np.float32)
for start,end in [(2.28,6.6),(8.7,24.6)]:
    k,m=int(start*sr),int(end*sr)
    a=np.arange(m-k)/sr
    static[k:m]=np.clip(a/.17,0,1)*np.clip((end-start-a)/.27,0,1)
mix+=(filt(rng.standard_normal(n).astype(np.float32),2800,'low')*.0055*static)[:,None]
def note(midi,start,length,amp,pan):
    a=np.arange(int(length*sr))/sr
    hz=440*2**((midi-69)/12)
    y=(np.sin(2*np.pi*hz*a)+.26*np.sin(4*np.pi*hz*a)*np.exp(-a*2.4)+.11*np.sin(6*np.pi*hz*a)*np.exp(-a*4))
    y*=np.minimum(a/.027,1)*np.exp(-a*2)*np.minimum((length-a)/.34,1)
    place(y*amp,start,pan)

for j,(start,midi) in enumerate([(6.51,62),(7.05,69),(8.1,74),(9.7,65),(11.1,69),(13.18,58),(13.88,65),(14.6,69),(16.2,72),(18.32,60),(19.15,67),(20.28,72),(21.52,65),(23.0,62),(23.18,69),(23.45,74)]):
    note(midi,start,min(2.8,25-start),.032 if start<22 else .040,(-1)**j*.21)
    if j%4==0:
        note(midi-12,start,min(3.1,25-start),.027,-.17)
mix*=np.minimum((25-t)/.13,1)[:,None]
audio=root/'mix-v2.wav'
with wave.open(str(audio),'wb') as f:
    f.setparams((2,2,sr,0,'NONE','not compressed'))
    f.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())

if os.environ.get('CNY_AUDIO_ONLY') == '1':
    raise SystemExit(0)

def mouth(t,name):
    st,y=speech[name]
    k=int((t-st)*sr)
    if k<0 or k>=len(y): return 0.
    a=y[max(0,k-1024):k+950]
    env=np.sqrt(np.mean(a*a))
    return float(np.clip((env-.008)/.104,0,1))*(.78+.22*math.sin(t*34))

files=sorted(Path(os.environ['CNY_ASSETS']).glob('*.png'))
stills=[None]+[cv.cvtColor(np.asarray(Image.open(f).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)),cv.COLOR_RGB2BGR) for f in files]
gy,gx=np.mgrid[0:800:2,0:450:2].astype(np.float32)
def gauss(x,y,sx,sy):
    return np.exp(-.5*((gx-x)/sx)**2-.5*((gy-y)/sy)**2)
props={
    1: ((300,232),None,(),(103,478),(360,430)),
    2: ((365,201),None,(),(199,436),(342,606)),
    3: ((279,244),(268,391,25,9),((206,300,13),(282,278,18)),(148,360),(270,596)),
    6: ((255,235),(246,325,14,6),((211,280,10),(257,269,12)),(177,320),(367,493)),
    7: ((209,246),(256,350,17,7),((213,286,11),(266,270,12)),(147,378),(284,507)),
    9: ((220,227),(270,305,22,8),((226,260,13),(287,241,14)),(163,327),(275,472)),
}
rigs={}
for k,(head,lips,eyes,hand,torso) in props.items():
    h=gauss(*head,63 if k in (1,6) else 83,92)
    body=gauss(*torso,128,143)
    grip=gauss(*hand,55 if k==2 else 24,100 if k==2 else 48)
    if k==2:
        grip=(gauss(186,405,68,145)*1.28).clip(0,1)
    if lips:
        x,y,sw,sh=lips
        lx=(gx-x)/sw
        ly=(gy-y)/sh
        mm=gauss(x,y,sw*1.14,sh*1.5)
        lower=gauss(x,y+21,sw*1.5,20)
        sculpt=(lx*mm,ly*mm,lower)
        dark=gauss(x,y,sw*.52,sh*.48)
    else:
        sculpt=(0.,0.,0.)
        dark=None
    blink=[(gy-ey)*gauss(ex,ey,ew,7) for ex,ey,ew in eyes]
    rigs[k]=(h,body,grip,sculpt,dark,blink)

def ease(x):
    q=np.clip(x,0,1)
    return q*q*(3-2*q)
def render_person(k,t,start,end):
    a=t-start
    q=ease(a/(end-start))
    h,body,grip,(lx,ly,jaw),dark,blink=rigs[k]
    breath=math.sin(t*2.85)
    dx=h*(math.sin(a*2.2)*2.2+({1:-5,2:3,3:3,6:-3,7:7,9:5}[k])*q) + body*breath*1.0
    dy=h*(math.sin(a*2.05)*2.3+({1:9,2:3,3:5,6:3,7:-7,9:-7}[k])*q) -body*breath*1.6
    rot=.026*math.sin(a*1.7)+(.021 if k in (7,9) else -.019)*q
    hx,hy=props[k][0]
    dx += -rot*(gy-hy)*h
    dy += rot*(gx-hx)*h
    if k==1:
        dx+=grip*math.sin(a*25)*1.8*(1-ease((a-.95)/.18))
        dy+=grip*math.sin(a*39)*1.9*(1-ease((a-.95)/.18))
    else:
        dx+=grip*({2:12,3:-4,6:3,7:-9,9:-5}[k])*q
        dy+=grip*(1.7*math.sin(a*2.9)+({2:-10,3:-3,6:2,7:12,9:4}[k])*q)
    name={3:'hesitate',6:'pressure',7:'dinner',9:'tired'}.get(k)
    amp=mouth(t,name) if name else 0.
    dx+=lx*amp*2.9
    dy+=ly*amp*5.0 + jaw*amp*2.9
    for when in ({3:[.59,2.75],6:[.92,3.21],7:[.43,2.61,4.57],9:[.63,3.89]}.get(k,[])):
        lid=math.exp(-((a-when)/.070)**2)
        for b in blink:
            dy-=b*lid*.92
    zoom=1.035+({1:.03,2:.055,3:.075,6:.033,7:.018,9:.067}[k])*q
    x=(gx-225)/zoom+225+({1:2,2:-5,3:2,6:3,7:-2,9:1}[k])*q-dx
    y=(gy-395)/zoom+395-dy
    frame=cv.remap(stills[k],cv.resize((x*2).astype(np.float32),(W,H)),cv.resize((y*2).astype(np.float32),(W,H)),cv.INTER_LINEAR,borderMode=cv.BORDER_REFLECT_101)
    if dark is not None and amp>.12:
        shade=cv.resize(dark,(W,H))
        frame=(frame*(1-.16*amp*shade[:,:,None])).astype(np.uint8)
    return frame

def overlay(frame, im, x,y, opacity=1):
    if opacity<=0:return
    iy,ix=im.shape[:2]
    target=frame[y:y+iy,x:x+ix]
    a=im[:,:,3:4].astype(np.float32)*(opacity/255)
    target[:]=target*(1-a)+im[:,:,:3]*a

fontroot=Path('C:/Windows/Fonts')
normal=ImageFont.truetype(str(fontroot/'msyh.ttc'),41)
bold=ImageFont.truetype(str(fontroot/'msyhbd.ttc'),43)
small=ImageFont.truetype(str(fontroot/'msyhbd.ttc'),26)
title=ImageFont.truetype(str(fontroot/'msyhbd.ttc'),59)
def rgba(im): return np.asarray(im)[:,:,[2,1,0,3]].copy()
def captions(lines):
    im=Image.new('RGBA',(810,164))
    d=ImageDraw.Draw(im)
    y=83-(len(lines)-1)*30
    for line in lines:
        d.text((405,y+2),line,font=bold,anchor='mm',fill=(15,17,16,255),stroke_width=4,stroke_fill=(10,16,18,125))
        d.text((405,y),line,font=bold,anchor='mm',fill='#fff8e9',stroke_width=1,stroke_fill=(20,18,14,150))
        y+=61
    return rgba(im)
def voice_cues(name, fraction):
    start, clip = speech[name]
    end = start + len(clip)/sr
    expected = int(fraction*len(clip))
    radius = int(sr*.24)
    lo = max(0, expected-radius)
    hi = min(len(clip)-1440, expected+radius)
    choices = np.arange(lo, hi+1, 480)
    magnitudes = np.array([np.sqrt(np.mean(clip[i:i+1440]**2)) for i in choices])
    scores = magnitudes + 0.015*np.abs(choices-expected)/radius
    return start, start + (choices[np.argmin(scores)]+720)/sr, end

mom_a, mom_b, mom_end = voice_cues('mom', .50)
press_a, press_b, press_end = voice_cues('pressure', .56)
dinner_a, dinner_b, dinner_end = voice_cues('dinner', .52)
tired_a, tired_b, tired_end = voice_cues('tired', .57)

subs=[
 (.22,2.28,['春节前 · 连续加班第 8 天']),
 (mom_a,mom_b,['有女朋友没？']),
 (mom_b,mom_end+.08,['没有就回来相亲。']),
 (speech['hesitate'][0],6.55,['妈，我……']),
 (6.65,8.81,['不知道怎么说，来得体说哦。']),
 (press_a,press_b,['妈，最近一直加班。']),
 (press_b,press_end+.12,['也怕裁员轮到我。']),
 (dinner_a,dinner_b,['今年先别安排相亲了。']),
 (dinner_b,dinner_end+.13,['我想回家吃顿你做的饭。']),
 (tired_a,tired_b,['下次，先问我累不累吧。']),
 (tired_b,min(22.91,tired_end+.15),['我其实挺想听你问这一句。']),
]
def voice_cues(name, fraction):
    start, clip = speech[name]
    end = start + len(clip)/sr
    expected = int(fraction*len(clip))
    radius = int(sr*.24)
    lo = max(0, expected-radius)
    hi = min(len(clip)-1440, expected+radius)
    choices = np.arange(lo, hi+1, 480)
    magnitudes = np.array([np.sqrt(np.mean(clip[i:i+1440]**2)) for i in choices])
    scores = magnitudes + 0.015*np.abs(choices-expected)/radius
    return start, start + (choices[np.argmin(scores)]+720)/sr, end

mom_a, mom_b, mom_end = voice_cues('mom', .50)
press_a, press_b, press_end = voice_cues('pressure', .56)
dinner_a, dinner_b, dinner_end = voice_cues('dinner', .52)
tired_a, tired_b, tired_end = voice_cues('tired', .57)

subs=[(a,b,captions(s)) for a,b,s in subs]
hud=Image.new('RGBA',(385,178))
d=ImageDraw.Draw(hud)
d.rounded_rectangle((1,1,383,176),radius=28,fill=(12,22,22,217),outline=(200,230,211,82),width=2)
d.text((25,16),'23:48',font=title,fill='#fff3dc')
d.text((28,113),'公司通知 · 岗位或将调整',font=small,fill='#d6e2da')
hud=rgba(hud)
caller=Image.new('RGBA',(156,59))
d=ImageDraw.Draw(caller)
d.rounded_rectangle((1,1,155,58),radius=28,fill=(14,42,35,230),outline=(151,205,178,165),width=2)
d.text((78,30),'妈 来电',anchor='mm',font=small,fill='#edfff1')
caller=rgba(caller)
def ui_inset(k):
    im=Image.fromarray(cv.cvtColor(stills[k],cv.COLOR_BGR2RGB))
    fragment=im.crop((50,317,850,601)).resize((516,183),Image.Resampling.LANCZOS)
    mask=Image.new('L',fragment.size,0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,515,182),22,fill=255)
    card=Image.new('RGBA',(560,231))
    d=ImageDraw.Draw(card)
    d.rounded_rectangle((16,16,552,215),radius=29,fill=(4,14,12,123))
    card.paste(fragment,(9,11),mask)
    return rgba(card)
insets={k:ui_inset(k) for k in (5,8)}

shots=[
    (0,2.30,1),(2.30,3.59,2),(3.59,6.57,3),(6.57,8.78,4),
    (8.78,13.22,6),(13.22,18.46,7),(18.46,23.07,9),(23.07,25,10)
]
def scene(shot,t):
    start,end,k=shot
    dt=max(0,t-start)
    if k in props:
        frame=render_person(k,max(start,t),start,end)
    else:
        frame=stills[k].copy()
    if k==1:
        overlay(frame,hud,44,110,float(ease(dt/.24)))
        overlay(frame,caller,112,1020,float(ease((dt-1.19)/.18)))
    if k==4:
        a=dt-1.63
        if 0<a<.36:
            x,y=448,1127
            cv.circle(frame,(x,y),round(16+63*a/.36),(113,150,93),2,cv.LINE_AA)
    if k in (6,7):
        appear=dt-.11
        opacity=float(ease(appear/.22)*(1-ease((appear-1.09)/.29)))
        overlay(frame,insets[5 if k==6 else 8],170,1046+int(24*(1-ease(appear/.22))),opacity)
    return frame

xx,yy=np.meshgrid(np.linspace(-1,1,W,dtype=np.float32),np.linspace(0,1,H,dtype=np.float32))
vignette=(1-.14*np.clip((np.abs(xx)-.2)/.8,0,1)**1.8-.44*np.clip((yy-.69)/.31,0,1)**1.22)[:,:,None]
proc=subprocess.Popen([ff,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(fps),'-i','-','-i',str(audio),
    '-vf','scale=1080:1920:flags=lanczos,setsar=1','-c:v','libx264','-preset','fast','-threads','8','-crf','17','-pix_fmt','yuv420p',
    '-af','loudnorm=I=-17:TP=-1.7:LRA=8','-ar','48000','-c:a','aac','-b:a','192k','-movflags','+faststart','-t','25',str(out)],stdin=subprocess.PIPE)
for f in range(25*fps):
    t=f/fps
    idx=max(i for i,s in enumerate(shots) if s[0]<=t)
    shot=shots[idx]
    start,end,k=shot
    frame=scene(shot,t)
    transition={4:.17,6:.16,10:.22}.get(k,0)
    if transition and t-start<transition:
        previous=scene(shots[idx-1],start-.001)
        amount=float(ease((t-start)/transition))
        frame=cv.addWeighted(previous,1-amount,frame,amount,0)
    if k not in (4,10):
        frame=(frame*vignette).astype(np.uint8)
    for a,b,label in subs:
        if a<=t<b:
            opacity=float(ease((t-a)/.11)*(1-ease((t-b+.10)/.10)))
            overlay(frame,label,45,1269,opacity)
            break
    proc.stdin.write(frame.tobytes())
    if f%150==0: print('frame',f,flush=True)
proc.stdin.close()
if proc.wait(): raise RuntimeError('Encoding failed')
print(out,flush=True)
