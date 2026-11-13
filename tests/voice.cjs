const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'voices/I/manifest.json'),'utf8'));
test('selected I voice contains 22 intact WAV clips and matching reference',()=>{
 assert.equal(manifest.voice,'I');assert.equal(manifest.voice_id,'M09');assert.equal(manifest.clips.length,22);
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash(fs.readFileSync(path.join(root,'samples/I-M09-reference.wav'))),manifest.reference_sha256);
 for(const clip of manifest.clips){assert.match(clip.src,/^\/voice-i\/[a-f0-9]+\.wav$/);const bytes=fs.readFileSync(path.join(root,'voices/I',path.basename(clip.src)));assert.equal(hash(bytes),clip.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');}
 const moods=JSON.parse(fs.readFileSync(path.join(root,'voices/I/moods.json'),'utf8'));assert.equal(moods.length,8);assert.ok(moods.every(m=>m.voice==='I'&&m.voice_id==='M09'&&manifest.clips.some(c=>c.src===m.src)));
});
test('playback planner handles all clips, concatenation, and rejects unknown text',async()=>{
 const scope={window:{},fetch:async()=>({ok:true,json:async()=>manifest})};vm.runInNewContext(fs.readFileSync(path.join(root,'src/frontend/ade-voice.js'),'utf8'),scope);const voice=scope.window.AdeVoice;await voice.ready;
 for(const clip of manifest.clips)assert.deepEqual(Array.from(await voice.plan(clip.text)),[clip.src]);
 assert.deepEqual(Array.from(await voice.plan(manifest.clips[0].text+manifest.clips[1].text)),manifest.clips.slice(0,2).map(c=>c.src));assert.equal((await voice.plan('未配音的新句子')).length,0);
});
