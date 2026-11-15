// Extrait un sous-ensemble de clips de la Universal Animation Library (Quaternius, CC0)
// et produit un GLB compact (squelette + animations, sans maillage).
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, quantize } from '@gltf-transform/functions';
const [,, src, dst] = process.argv;
const KEEP = new Set(['A_TPose','Idle_Loop','Idle_Talking_Loop','Walk_Loop','Walk_Formal_Loop','Jog_Fwd_Loop','Sprint_Loop',
  'Sitting_Enter','Sitting_Idle_Loop','Sitting_Talking_Loop','Sitting_Exit','Fixing_Kneeling','Interact','PickUp_Table',
  'Push_Loop','Driving_Loop','Idle_Torch_Loop','Crouch_Idle_Loop']);
const io = new NodeIO();
const doc = await io.read(src);
const root = doc.getRoot();
for (const a of root.listAnimations()) if (!KEEP.has(a.getName())) a.dispose();
for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); }
await doc.transform(resample(), prune({ keepLeaves: true }));
await io.write(dst, doc);
console.log('anims:', root.listAnimations().map(a => a.getName()).join(', '));
