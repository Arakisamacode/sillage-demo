import * as THREE from 'three';

// Ciel : étoiles, nébuleuse discrète, planète océanique procédurale avec atmosphère et nuages,
// trafic lointain. Le groupe suit la caméra (à l'infini).

export const SUN_DIR = new THREE.Vector3(0.75, 0.35, 0.55).normalize();      // soleil (derrière la station)
export const PLANET_DIR = new THREE.Vector3(-0.30, 0.16, -0.94).normalize(); // planète, vue par la baie
// direction de la lumière « planétaire » (licence artistique : plus haute que le centre du disque)
export const KEY_DIR = new THREE.Vector3(-0.28, 0.42, -0.86).normalize();

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p, int oct){ float s=0.0,a=0.5; for(int i=0;i<8;i++){ if(i>=oct)break; s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5;} return s; }
`;

export class Sky {
  constructor(scene, quality) {
    this.group = new THREE.Group();
    this.group.name = 'sky';
    this.q = quality;
    scene.add(this.group);
    this.uniforms = { uTime: { value: 0 }, uSun: { value: SUN_DIR.clone() } };
    this._stars();
    this._planet();
    this._traffic();
  }

  _stars() {
    const N = 7000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      v.randomDirection();
      // concentration le long d'une bande galactique
      if (Math.random() < 0.45) { v.y *= 0.18; v.normalize(); }
      v.multiplyScalar(9000);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = Math.random();
      const c = t < 0.15 ? [1.0, 0.78, 0.6] : t < 0.35 ? [0.7, 0.8, 1.0] : [1, 0.96, 0.92];
      const b = Math.pow(Math.random(), 6) * 6 + 0.25;
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
      size[i] = Math.random() < 0.02 ? 2.6 : 1.0 + Math.random() * 0.9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `attribute float size; varying vec3 vC; uniform float uPR;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=size*uPR; }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 d=gl_PointCoord-0.5; float a=smoothstep(0.5,0.0,length(d)); gl_FragColor=vec4(vC*a,1.0); }`,
      vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = -10;
    this.group.add(pts);

    // nébuleuse : grande sphère inversée, bruit très faible
    const neb = new THREE.Mesh(new THREE.SphereGeometry(9500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: NOISE + `varying vec3 vD; void main(){
        float band = exp(-pow(vD.y*5.0,2.0));
        float n = fbm(vD*3.0, 5)*0.5+0.5; float n2 = fbm(vD*7.0+3.0, 4)*0.5+0.5;
        vec3 c = mix(vec3(0.012,0.016,0.03), vec3(0.05,0.035,0.06), n2) * (0.25 + band*1.4*n);
        c += vec3(0.04,0.05,0.07) * pow(n,4.0)*band;
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    neb.renderOrder = -11;
    neb.frustumCulled = false;
    this.group.add(neb);
  }

  _planet() {
    const R = 3400, D = 7000;
    const center = PLANET_DIR.clone().multiplyScalar(D);
    const seg = this.q.name === 'low' ? 96 : 160;
    const surf = new THREE.ShaderMaterial({
      uniforms: { uSun: this.uniforms.uSun, uTime: this.uniforms.uTime, uCenter: { value: center } },
      vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vW; varying vec3 vNw;
        void main(){ vN = normalize(position); vP = position; vNw = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
          gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: NOISE + `
        uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vW; varying vec3 vNw;
        void main(){
          vec3 n = normalize(vN);
          // rotation lente
          float a = uTime*0.002; mat3 rot = mat3(cos(a),0.0,sin(a), 0.0,1.0,0.0, -sin(a),0.0,cos(a));
          vec3 p = rot*n;
          float cont = fbm(p*2.2, 7);
          float lat = abs(p.y);
          float land = smoothstep(0.02, 0.07, cont - 0.08);
          vec3 ocean = mix(vec3(0.010,0.035,0.085), vec3(0.02,0.08,0.14), smoothstep(-0.3,0.05,cont));
          float dry = fbm(p*6.0+4.0, 5)*0.5+0.5;
          vec3 ground = mix(vec3(0.10,0.10,0.07), vec3(0.22,0.17,0.11), dry);
          ground = mix(ground, vec3(0.08,0.12,0.07), smoothstep(0.55,0.8,1.0-dry)*0.6);
          vec3 albedo = mix(ocean, ground, land);
          float ice = smoothstep(0.72, 0.84, lat + fbm(p*5.0,4)*0.08);
          albedo = mix(albedo, vec3(0.75,0.8,0.85), ice);
          // nuages (deux couches, dérive)
          vec3 cp = p + vec3(uTime*0.0011, 0.0, uTime*0.0006);
          float cl = fbm(cp*3.0 + fbm(cp*1.5,3)*0.8, 6);
          float clouds = smoothstep(0.08, 0.55, cl - 0.06) * 0.8;
          float storms = smoothstep(0.35,0.6, fbm(cp*9.0,4)) * clouds;
          vec3 V = normalize(cameraPosition - vW);
          vec3 Nw = normalize(vNw);
          float ndl = dot(Nw, uSun);
          float lit = smoothstep(-0.12, 0.35, ndl);
          vec3 col = albedo * (max(ndl,0.0)*1.2 + 0.004);
          // reflet spéculaire de l'océan
          vec3 H = normalize(uSun + V);
          col += (1.0-land)*(1.0-clouds)*pow(max(dot(Nw,H),0.0), 90.0)*vec3(1.0,0.92,0.8)*1.6*lit;
          vec3 cloudCol = vec3(0.78,0.82,0.88)*(max(ndl,0.0)*0.62+0.002) + storms*0.02;
          col = mix(col, cloudCol, clouds);
          // lumières des villes côté nuit
          float city = smoothstep(0.55,0.8, fbm(p*40.0,3)*0.5+0.5) * land * (1.0-ice) * (1.0-clouds*0.8);
          col += vec3(1.0,0.6,0.25) * city * smoothstep(0.05,-0.2,ndl) * 0.35;
          // diffusion atmosphérique au limbe
          float fres = pow(1.0 - max(dot(Nw, V), 0.0), 3.0);
          vec3 atm = vec3(0.30,0.55,1.0);
          col = mix(col, atm * (lit*0.9+0.02), fres*0.7);
          // bande orangée au terminateur
          col += vec3(1.0,0.45,0.15) * exp(-pow(ndl*7.0,2.0)) * 0.10 * (1.0-fres);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthWrite: false,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, seg, seg / 2), surf);
    planet.position.copy(center);
    planet.rotation.z = 0.35;
    planet.renderOrder = -9;
    planet.frustumCulled = false;
    this.group.add(planet);

    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, seg, seg / 2), new THREE.ShaderMaterial({
      uniforms: { uSun: this.uniforms.uSun },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){
        vec3 V = normalize(cameraPosition - vW);
        float rim = 1.0 - abs(dot(vN, V));
        float glow = pow(rim, 5.0) * 1.6 + pow(rim, 1.5)*0.08;
        float l = smoothstep(-0.35, 0.4, dot(vN, uSun));
        vec3 c = mix(vec3(0.18,0.42,1.0), vec3(0.6,0.8,1.0), pow(rim,6.0)) * glow * l;
        gl_FragColor = vec4(c*1.4, 1.0); }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide,
    }));
    atmo.position.copy(center);
    atmo.renderOrder = -8;
    atmo.frustumCulled = false;
    this.group.add(atmo);
    this.planet = planet;

    // lune lointaine
    const moon = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), new THREE.ShaderMaterial({
      uniforms: { uSun: this.uniforms.uSun },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(mat3(modelMatrix)*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: NOISE + `uniform vec3 uSun; varying vec3 vN; varying vec3 vP; void main(){
        float n = fbm(normalize(vP)*4.0, 5)*0.5+0.5; float cr = smoothstep(0.6,0.75, fbm(normalize(vP)*12.0,3)*0.5+0.5);
        vec3 a = vec3(0.42,0.40,0.38)*(0.6+0.5*n) - cr*0.08;
        gl_FragColor = vec4(a*max(dot(vN,uSun),0.0)*1.6, 1.0); }`,
      depthWrite: false,
    }));
    moon.position.copy(new THREE.Vector3(0.42, 0.22, -0.88).normalize().multiplyScalar(8000));
    moon.renderOrder = -9;
    moon.frustumCulled = false;
    this.group.add(moon);
  }

  _traffic() {
    // petits feux de navigation de vaisseaux lointains qui croisent devant la planète
    this.traffic = [];
    const mat = new THREE.SpriteMaterial({ color: new THREE.Color(1.0, 0.85, 0.6).multiplyScalar(6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.scale.setScalar(6 + Math.random() * 6);
      s.renderOrder = -7;
      const orbit = {
        sprite: s, r: 2400 + Math.random() * 2600, speed: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.01),
        phase: Math.random() * Math.PI * 2, y: -300 + Math.random() * 900, blink: Math.random() * 3,
        red: Math.random() < 0.3,
      };
      if (orbit.red) s.material.color.setRGB(6, 0.6, 0.4);
      this.traffic.push(orbit);
      this.group.add(s);
    }
  }

  update(dt, t, camera) {
    this.group.position.copy(camera.position);
    this.uniforms.uTime.value = t;
    for (const o of this.traffic) {
      const a = o.phase + t * o.speed;
      o.sprite.position.set(Math.sin(a) * o.r - 600, o.y, -Math.abs(Math.cos(a)) * o.r - 1500);
      const b = (t + o.blink) % 1.6;
      o.sprite.material.opacity = b < 0.12 ? 1 : 0.25;
    }
  }
}
