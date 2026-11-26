"""Render the 25-second client deadline promo from numbered storyboard assets."""
import math
import os
import subprocess
import wave
from pathlib import Path

import cv2 as cv
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(os.environ['CNY_BUILD'])
audio_dir = Path(os.environ['CNY_VOICE_DIR'])
output = Path(os.environ['CNY_OUTPUT'])
ff = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS, SR = 900, 1600, 30, 48000
rng = np.random.default_rng(20261126)
mix = np.zeros((25*SR, 2), np.float32)

# The employee starts off-screen while the file is sent, then comes into view.
dialogue = {
    'boss': (.58, 2.39, .53),
    'hesitate': (4.54, 1.92, .36),
    'vo': (6.92, 2.40, .45),
    'report': (10.24, 10.77, .48),
    'outro': (22.72, 2.13, .45),
}
speech = {}

def place(signal, t, pan=0):
    i = round(t*SR)
    signal = signal[:len(mix)-i]
    mix[i:i+len(signal)] += signal[:, None] * np.array([1-pan, 1+pan])

def decode(path, effect='anull'):
    cmd = [ff, '-v', 'error', '-i', str(path), '-af', effect,
           '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.check_output(cmd), np.float32).copy()

def write_pcm(path, signal, channels=1):
    with wave.open(str(path), 'wb') as wav:
        wav.setparams((channels, 2, SR, 0, 'NONE', 'not compressed'))
        wav.writeframes((32767*np.clip(signal, -1, 1)).astype('<i2').tobytes())

def tuck_gaps(signal, threshold, max_gap):
    block = SR//100
    n = len(signal)//block
    rms = np.sqrt(np.mean(signal[:n*block].reshape(-1, block)**2, axis=1))
    active = np.flatnonzero(rms > threshold)
    if active.size == 0:
        raise ValueError('Silent dialogue')
    lo = max(0, (active[0]-4)*block)
    hi = min(len(signal), (active[-1]+8)*block)
    gaps = [(a,b) for a,b in zip(active,active[1:]) if b-a > max_gap]
    for a,b in reversed(gaps):
        pivot = (a+b)//2
        span = (b-a-max_gap)//2
        if span < 2: continue
        left = (pivot-span)*block
        right = (pivot+span)*block
        blend = np.linspace(0,1,block)
        crossfade = signal[left:left+block]*(1-blend) + signal[right:right+block]*blend
        signal = np.concatenate((signal[:left],crossfade,signal[right+block:]))
        hi -= right-left
    return signal[lo:hi]

for name, (start, window, peak) in dialogue.items():
    effects = {
        'boss': 'highpass=f=80,equalizer=f=245:t=q:w=1:g=1.0',
        'hesitate': 'highpass=f=86,treble=g=-1.3',
        'report': 'highpass=f=70,equalizer=f=190:t=q:w=1:g=0.8',
    }
    audio = decode(audio_dir/f'{name}.wav', effects.get(name, 'highpass=f=82'))
    audio = tuck_gaps(audio, max(.002, np.max(np.abs(audio))*.015),
                      {'report':31,'hesitate':45,'boss':23}.get(name,32))
    speed = len(audio)/(SR*window)
    if name == 'report' and speed < .93:
        speed = .95
    if abs(speed - 1.0) > .011 and (speed > 1.0 or name == 'report'):
        tmp = root/f'{name}-temp.wav'
        write_pcm(tmp, audio)
        audio = decode(tmp, f'atempo={speed:.5f}')
    audio = audio[:round(window*SR)]
    fade = min(len(audio)//4, SR//70)
    audio[:fade] *= np.linspace(0,1,fade)
    audio[-fade:] *= np.linspace(1,0,fade)
    audio *= peak/max(.05, np.max(np.abs(audio)))
    fraction = np.linspace(0,1,len(audio))
    if name == 'report':
        audio *= np.interp(fraction, [0,.15,.37,.67,.91,1], [.79,.92,.98,1.05,1.13,.90])
    elif name == 'hesitate':
        audio *= np.interp(fraction, [0,.18,.56,1], [.76,1.,.82,.65])
    speech[name] = (start,audio)
    place(audio,start,{'boss':-.14,'hesitate':.10,'report':.10}.get(name,0))
    write_pcm(root/f'{name}-fitted.wav',audio)
    print(name, f'{len(audio)/SR:.2f}s', f'fit ratio {speed:.2f}', flush=True)

def foley(t, frequency, length, volume, decay, pan, noise=.35):
    x = np.arange(round(length*SR))/SR
    s = (np.sin(2*np.pi*frequency*x) + noise*rng.standard_normal(len(x)))
    s *= np.minimum(x/.004,1)*np.exp(-x*decay)*np.minimum((length-x)/.037,1)
    place(s*volume,t,pan)

time = np.arange(len(mix))/SR
room = rng.normal(0,1,len(mix))
smoothed = np.convolve(room,np.ones(38)/38,mode='same')
room_gain = .011*(1-.78*np.clip((time-5.95)/.42,0,1)*(1-np.clip((time-9.0)/.38,0,1)))
mix += (smoothed*room_gain*np.minimum((25-time)/.4,1))[:,None]
foley(.16,830,.25,.048,15,.17,.055)
foley(.26,1160,.24,.043,17,.17,.03)
foley(.48,74,.36,.21,16,-.19,.48)
foley(.49,240,.24,.077,24,-.22,.85)
for ix,t in enumerate([2.83,2.94,3.06,3.16,3.31,3.43,3.52,3.61,3.72,3.86,4.02,4.15]):
    foley(t,760+ix*37,.07,.053+(ix%3)*.007,105,.25,.62)
foley(7.40,680,.18,.024,19,0,.04)
foley(9.56,1560,.055,.044,102,.24,.25)
foley(9.77,780,.24,.032,14,.10,.04)
foley(9.87,1170,.30,.021,13,.10,.03)
foley(20.81,230,.26,.028,17,-.13,.4)

def chord_note(midi,start,amp,pan):
    length = min(2.9,25-start)
    t = np.arange(round(length*SR))/SR
    hz = 440*2**((midi-69)/12)
    note = np.sin(2*np.pi*hz*t)+.28*np.sin(4*np.pi*hz*t)*np.exp(-t*2.8)
    note *= np.minimum(t/.032,1)*np.exp(-t*1.95)*np.minimum((length-t)/.27,1)
    place(note*amp,start,pan)

for j,(t,n) in enumerate([(6.71,62),(7.22,69),(8.12,74),(9.68,57),(10.13,64),
                           (11.66,69),(13.33,55),(14.7,62),(16.24,66),(17.8,69),
                           (19.55,62),(21.45,57),(22.48,62),(22.66,69),(22.91,74)]):
    chord_note(n,t,.028 if t<22.4 else .038,(-1)**j*.23)
audio_path=root/'mix.wav'
write_pcm(audio_path,mix,2)
if os.environ.get('CNY_AUDIO_ONLY') == '1':
    raise SystemExit(0)

def eased(x):
    x = float(np.clip(x,0,1))
    return x*x*(3-2*x)

names = sorted(Path(os.environ['CNY_ASSETS']).glob('*.png'))
if len(names) != 10 or [p.name[:2] for p in names] != [f'{i:02d}' for i in range(1,11)]:
    raise ValueError('Expected ten PNGs numbered 01 through 10')
stills = [None]+[cv.cvtColor(np.asarray(Image.open(p).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)),
                            cv.COLOR_RGB2BGR) for p in names]
y,x = np.mgrid[0:800:2,0:450:2].astype(np.float32)

def local_mask(cx, cy, rx, ry):
    # Compact support leaves pixels outside each feature on the rigid camera map.
    distance = ((x-cx)/rx)**2 + ((y-cy)/ry)**2
    return np.maximum(0, 1-distance)**2

eye_marks = {
    1: [(171,207,13),(353,308,13)],
    2: [(314,270,16)],
    3: [(197,241,20),(288,251,22)],
    8: [(130,216,12),(325,330,15)],
    9: [(167,241,18),(226,221,14)],
}
eye_maps = {k:[(y-cy)*local_mask(cx,cy,rx,10) for cx,cy,rx in points]
            for k,points in eye_marks.items()}
# Timings are relative to the fitted takes used in the 25-second mix.
syllables = {
    'boss': ('.00 .22 .56 .74 .94 1.20 1.44 1.84 2.00 2.14 2.36',
             'jia fang dou cui san bian le cai liao ne'),
    'hesitate': ('.00 .38 .72 .82 .96', 'wo wo zai gai'),
    'report': (
        '.00 .16 .52 .80 1.08 1.20 1.32 1.52 1.66 1.82 2.16 2.40 2.56 2.70 2.88 '
        '3.24 3.44 3.58 3.74 3.90 4.12 4.60 4.76 4.92 5.06 5.20 5.30 5.46 5.60 '
        '5.94 6.22 6.38 6.48 6.74 7.08 7.16 7.24 7.39 7.54 7.78 8.10 8.18 8.32 8.43 8.62',
        'wang zong gang cai mei ji shi bao jin du zheng wen fa nin le '
        'hai sheng liang ge shu shi fen zhong hou wo zhu dong geng xin '
        'jia fang lai dian wo gen nin yi qi jie wo lai jiang qing chu',
    ),
}
tracks = {}
for name,(timecodes, pinyin) in syllables.items():
    times = np.array([float(x) for x in timecodes.split()])
    sounds = pinyin.split()
    if len(times) != len(sounds)+1:
        raise ValueError(f'Incomplete lip cue track: {name}')
    tracks[name] = (times,sounds)

def mouth_pose(t, name):
    start, signal = speech[name]
    t -= start
    j = round(t*SR)
    if not 0 <= j < len(signal):
        return .04,1.
    times,sounds = tracks[name]
    k = min(len(sounds)-1,max(0,np.searchsorted(times,t,side='right')-1))
    syllable = sounds[k]
    phase = np.clip((t-times[k])/(times[k+1]-times[k]),0,1)
    samples = signal[max(0,j-1420):min(len(signal),j+1020)]
    rms = float(np.sqrt(np.mean(samples*samples)))
    voiced = eased((rms-.012)/.058)
    if syllable.endswith(('o','u','ou','ong','uo','ui','un')):
        gap, width = .73,.76
    elif syllable.endswith(('i','in','ing','ei')):
        gap, width = .55,1.13
    elif 'a' in syllable:
        gap, width = 1.,1.04
    else:
        gap, width = .76,1.
    onset = eased(phase/.24) if syllable[0] in 'mbp' else .64+.36*eased(phase/.25)
    if syllable[0]=='f':
        onset *= .63+.37*eased(phase/.3)
    release = 1-.44*eased((phase-.73)/.27)
    strength = voiced*onset*release
    return .041+gap*strength,1+(width-1)*strength

class Mouth:
    def __init__(self, x, y, width, reach, slope, opening, name):
        self.name = name
        self.opening = opening*2
        self.reach = reach*2
        width *= 2
        x,y = x*2,y*2
        ry = int(self.reach+abs(slope)*width+4)
        self.x0,self.x1 = int(x-width), int(x+width+1)
        self.y0,self.y1 = y-ry,y+ry+1
        self.xx,self.yy = np.meshgrid(np.arange(self.x0,self.x1,dtype='float32'),
                                      np.arange(self.y0,self.y1,dtype='float32'))
        self.x = self.xx-x
        self.y = self.yy-y-slope*self.x
        self.weight = np.maximum(0, 1-(self.x/width)**6)**2
        self.width_weight = self.weight*np.maximum(0,1-(self.y/self.reach)**2)**2

    def render(self, image, t):
        gap,width = mouth_pose(t,self.name)
        # Compress or expand the original lip opening while preserving the
        # surrounding skin and the original teeth texture.
        half = self.opening*(.13+1.63*gap)
        dist = np.abs(self.y)
        source = np.where(dist<half, dist*self.opening/half,
                          self.opening+(dist-half)*(self.reach-self.opening)/(self.reach-half))
        dy = np.where(dist<self.reach,(source-dist)*np.sign(self.y)*self.weight,0)
        dx = self.x*(1/width-1)*self.width_weight
        region = cv.remap(image,(self.xx+dx).astype('float32'),(self.yy+dy).astype('float32'),cv.INTER_LINEAR)
        frame=image.copy()
        frame[self.y0:self.y1,self.x0:self.x1]=region
        return frame

mouths = {
    1: Mouth(161,251,23,23,-.27,2.4,'boss'),
    3: Mouth(224,363,43,32,.10,5.9,'hesitate'),
    8: Mouth(321,362,17,19,.14,2.8,'report'),
}
hand_maps = {
    1: [local_mask(113,627,42,50)],
    2: [local_mask(298,575,56,31),local_mask(379,548,33,38)],
    7: [local_mask(287,519,37,25)],
    8: [local_mask(209,578,37,23),local_mask(381,582,29,21)],
    9: [local_mask(178,606,44,27)],
}
actor_shots = {1,2,3,7,8,9}

def render_actor(k,t,begin,finish):
    dt = max(0., t-begin)
    q = eased(dt/(finish-begin))
    freeze = k==3 and dt>2.00
    if freeze:
        dt = 2.00
        t = begin+dt
        q = eased(dt/(finish-begin))
    dx = np.zeros_like(x)
    dy = np.zeros_like(y)
    blink_times = {1:[1.55],2:[.63],3:[.59],8:[1.7,4.26,7.35],9:[.61,1.5]}
    for mark in blink_times.get(k,[]):
        blink = math.exp(-((dt-mark)/.075)**2)
        for lid in eye_maps[k]:
            dy -= .57*lid*blink

    if k==1:
        strike = 1-eased((dt-.18)/.30)
        dy -= 4.4*strike*hand_maps[k][0]
    elif k==2:
        stop = 1-eased((dt-1.30)/.13)
        for j,hand in enumerate(hand_maps[k]):
            dy += 2.7*hand*math.sin(dt*(31+j*7)+j)*stop
    elif k==7:
        dy += 3.5*hand_maps[k][0]*math.exp(-((t-9.56)/.09)**2)
    elif k==8:
        gesture = math.sin(min(q*1.75,1)*math.pi)
        dy -= 2.5*gesture*hand_maps[k][0]
        dx += 2.0*eased((dt-4.8)/1.5)*hand_maps[k][1]
    elif k==9:
        dx += 2.4*eased(dt/1.1)*hand_maps[k][0]

    zoom = 1.025+{1:.053,2:.047,3:.081,7:.055,8:.205,9:.061}[k]*q
    target_x = 225+{1:0,2:25,3:6,7:-15,8:31,9:-25}[k]*q
    target_y = 397+{1:9,2:20,3:-21,7:4,8:-48,9:-31}[k]*q
    if k==1 and .48<=dt<.71:
        target_y += 7*math.exp(-(dt-.48)*18)*math.sin((dt-.48)*65)
    target_x = float(np.clip(target_x,225/zoom,450-225/zoom))
    target_y = float(np.clip(target_y,395/zoom,798-405/zoom))
    map_x = ((x-225)/zoom+target_x-dx)*2
    map_y = ((y-395)/zoom+target_y-dy)*2
    map_x = cv.resize(map_x.astype('float32'),(W,H))
    map_y = cv.resize(map_y.astype('float32'),(W,H))
    np.clip(map_x,0,W-1,out=map_x)
    np.clip(map_y,0,H-1,out=map_y)
    source=mouths[k].render(stills[k],t) if k in mouths else stills[k]
    return cv.remap(source,map_x,map_y,cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE)

def bgra(im):
    return np.asarray(im)[:,:,[2,1,0,3]].copy()
def overlay(frame, layer, x, y, opacity=1.):
    if opacity<=0: return
    h,w=layer.shape[:2]
    dst=frame[y:y+h,x:x+w]
    a=layer[:,:,3:4]*(opacity/255.)
    dst[:]=dst*(1-a)+layer[:,:,:3]*a

font_dir=Path('C:/Windows/Fonts')
font=lambda s: ImageFont.truetype(str(font_dir/'msyhbd.ttc'),s)
caption_font = font(43)
heading_font = font(35)
mini_font = font(24)
def caption(label):
    im=Image.new('RGBA',(824,126))
    d=ImageDraw.Draw(im)
    d.text((412,64),label,anchor='mm',font=caption_font,fill='#fcffe9',stroke_width=3,stroke_fill=(12,20,22,211))
    return bgra(im)
def notice(eyebrow, title, width, color):
    im=Image.new('RGBA',(width,132))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((2,2,width-3,129),24,fill=(17,35,39,223),outline=(160,195,180,139),width=2)
    d.text((26,18),eyebrow,font=mini_font,fill=color)
    d.text((26,57),title,font=heading_font,fill='#fffdf3')
    return bgra(im)
chat=notice('甲方项目群','材料现在能发吗？',432,'#dbecdf')
sent=notice('发送成功','已核正文已发出',351,'#bff3d6')

def inset06():
    im=Image.fromarray(cv.cvtColor(stills[6],cv.COLOR_BGR2RGB))
    cut=im.crop((58,305,841,617)).resize((453,181),Image.Resampling.LANCZOS)
    mask=Image.new('L',cut.size)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,452,180),20,fill=255)
    layer=Image.new('RGBA',(474,203))
    d=ImageDraw.Draw(layer)
    d.rounded_rectangle((13,13,471,198),23,fill=(0,10,10,110))
    layer.paste(cut,(4,5),mask)
    return bgra(layer)

detail=inset06()
report_lines=[
    '王总，刚才没及时报进度。',
    '正文发您了，还剩两个数。',
    '十分钟后我主动更新。',
    '甲方来电，我跟您一起接。',
    '我来讲清楚。',
]
def voice_span(name):
    t,a=speech[name]
    return t,t+len(a)/SR

def report_cuts():
    start,end=voice_span('report')
    a=speech['report'][1]
    cuts=[start]
    for ratio in [.257,.486,.690,.900]:
        j=int(len(a)*ratio)
        radius=int(.32*SR)
        starts=np.arange(max(0,j-radius),min(len(a)-1152,j+radius),576)
        rms=np.array([np.sqrt(np.mean(a[k:k+1152]**2)) for k in starts])
        score=rms+.018*np.abs(starts-j)/radius
        cuts.append(start+(starts[np.argmin(score)]+576)/SR)
    return cuts+[end+.07]

marks=report_cuts()
boss_s,boss_e=voice_span('boss')
hes_s,hes_e=voice_span('hesitate')
vo_s,vo_e=voice_span('vo')
subtimes=[
 (boss_s,boss_e+.08,'甲方都催三遍了！材料呢？'),
 (3.12,4.53,'领导催得急，第一句怎么说？'),
 (hes_s,min(6.57,hes_e+.24),'我……我在改……'),
 (vo_s,min(9.22,vo_e+.1),'来得体说，按场景练表达。'),
]+[(a,b,line) for a,b,line in zip(marks,marks[1:],report_lines)]
subtimes=[(a,b,caption(sub)) for a,b,sub in subtimes]
print('report captions',marks,flush=True)

report_end=voice_span('report')[1]
reaction=max(19.75,min(20.81,report_end-.19))
shots=[(0,3.00,1),(3.00,4.20,2),(4.20,6.80,3),(6.80,7.55,4),
       (7.55,9.39,5),(9.39,10.20,7),(10.20,reaction,8),(reaction,22.40,9),(22.40,25,10)]
def scene(shot,t):
    start,end,k=shot
    dt=max(t-start,0)
    if k in actor_shots:
        frame=render_actor(k,max(t,start),start,end)
    else:
        frame=stills[k].copy()
    if k==1:
        alpha=eased((t-.07)/.16)*(1-eased((t-1.68)/.18))
        overlay(frame,chat,421,105,alpha)
    if k==3 and dt>=2.01:
        power=.14*eased((dt-2.01)/.31)
        gray=cv.cvtColor(cv.cvtColor(frame,cv.COLOR_BGR2GRAY),cv.COLOR_GRAY2BGR)
        frame=cv.addWeighted(frame,1-power,gray,power,0)
    if k==7:
        overlay(frame,detail,32,107,eased(dt/.12)*(1-eased((dt-.41)/.25)))
        overlay(frame,sent,92,885,eased((t-9.68)/.20))
    return frame

xx,yy=np.meshgrid(np.linspace(-1,1,W,dtype=np.float32),np.linspace(0,1,H,dtype=np.float32))
vignette=(1-.13*np.clip((np.abs(xx)-.28)/.72,0,1)**1.6-.29*np.clip((yy-.70)/.3,0,1)**1.3)[:,:,None]
encoder=subprocess.Popen([ff,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s',
    f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(audio_path),'-vf','scale=1080:1920:flags=lanczos,setsar=1',
    '-c:v','libx264','-threads','8','-preset','fast','-crf','17','-pix_fmt','yuv420p','-af',
    'loudnorm=I=-17:TP=-1.7:LRA=8','-ar','48000','-c:a','aac','-b:a','192k','-movflags','+faststart','-t','25',str(output)],
    stdin=subprocess.PIPE)
for f in range(25*FPS):
    t=f/FPS
    idx=max(i for i,s in enumerate(shots) if s[0]<=t)
    shot=shots[idx]
    start,end,k=shot
    frame=scene(shot,t)
    span_s={4:.17,5:.24,7:.18,10:.18}.get(k,0)
    if span_s and t-start<span_s:
        prev=scene(shots[idx-1],start-.002)
        alpha=eased((t-start)/span_s)
        if k==5:
            n=int(W*alpha)
            frame[:,n:]=prev[:,n:]
        else:
            frame=cv.addWeighted(prev,1-alpha,frame,alpha,0)
    if k in actor_shots:
        frame=(frame*vignette).astype(np.uint8)
    for a,b,label in subtimes:
        if a<=t<b:
            overlay(frame,label,38,1390 if k==5 else 1268,eased((t-a)/.085)*(1-eased((t-b+.08)/.08)))
            break
    encoder.stdin.write(frame.tobytes())
    if f%150==0: print('frame',f,flush=True)
encoder.stdin.close()
if encoder.wait():
    raise RuntimeError('Video export failed')
print(output,flush=True)
