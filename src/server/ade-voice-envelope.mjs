// Each side keeps its P-256 private key in memory. D1 sees only public keys and ciphertext.
export async function voiceIdentity() {
  const keys = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}, false, ['deriveKey']);
  const publicBytes = await crypto.subtle.exportKey('raw', keys.publicKey);
  return {privateKey:keys.privateKey, publicKey:encode(publicBytes)};
}
export async function sharedVoiceKey(privateKey, peer) {
  const publicKey = await crypto.subtle.importKey('raw', decode(peer), {name:'ECDH',namedCurve:'P-256'}, false, []);
  return crypto.subtle.deriveKey({name:'ECDH',public:publicKey}, privateKey, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
function encode(bytes) {
  const data = new Uint8Array(bytes);
  let binary = '';
  for(let i=0;i<data.length;i+=8192) binary+=String.fromCharCode(...data.subarray(i,i+8192));
  return btoa(binary);
}
function decode(value) {return Uint8Array.from(atob(value), ch=>ch.charCodeAt(0));}
export async function seal(key, id, bytes) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,bytes);
  return encode(iv)+'.'+encode(cipher);
}
export async function unseal(key, id, value) {
  const [iv,cipher]=value.split('.');
  return crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(id)},key,decode(cipher));
}
