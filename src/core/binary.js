// Chargement de fichiers binaires (.glb, .exr). Pour l'hébergement en Artifact (claude.ai), qui ne sert
// que des types web standard, le build « artifact » les livre encodés en base64 (.b64.txt).
const B64 = import.meta.env.VITE_B64 === '1';

export async function loadBinary(url) {
  if (!B64) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} : ${r.status}`);
    return r.arrayBuffer();
  }
  const r = await fetch(url + '.b64.txt');
  if (!r.ok) throw new Error(`${url} : ${r.status}`);
  const s = atob((await r.text()).trim());
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}
