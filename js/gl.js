// WebGL2 渲染器：一张全屏面片，把相机光线打到晶圆平面上。
// 彩虹来自衍射：GPU Gems《Simulating Diffraction》的做法，u = d·(T·(L+V))，逐级累加。

import { BLOCKS } from './die-gen.js';

export const WAFER = { P: 0.14, D: 0.128, R: 1.0 };

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;

const SCENE = (tier) => `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uDie, uLut, uMap;
uniform vec2 uRes;
uniform float uT, uPower, uMapMix, uF, uDieN, uBoost, uFocusH, uViewH, uFocusCell, uTitleA, uGain;
uniform sampler2D uTitle;
uniform vec2 uTitleOff;
uniform vec3 uCam, uRight, uUp, uBack, uPtr, uTarget;
uniform vec2 uLensC;
uniform float uLensR, uLensAmt;
uniform int uHover;
uniform vec4 uRip[6];
uniform vec4 uBlk[10];
uniform vec4 uMat[10];

const float P=${WAFER.P.toFixed(4)}, D=${WAFER.D.toFixed(4)}, RW=${WAFER.R.toFixed(1)};
const float ULUT=9.;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }

vec3 film(float c, float d){
  // 薄膜干涉：光程差除以波长取余弦
  vec3 wl=vec3(.65,.532,.45);
  return .5+.5*cos(6.2831*2.*d*c/wl+vec3(0.,.4,.9));
}
vec3 grat(vec3 L, vec3 V, vec2 T, float d){
  float u=abs(dot(L+V,vec3(T,0.)))*d;
  return texture(uLut,vec2(u/ULUT,.5)).rgb;
}

// 工厂光刻间的琥珀灯 + 一条顶灯的柔光反射
vec3 env(vec3 r){
  float strip=smoothstep(.34,.0,abs(r.x*.8+r.y*.35-.12))*smoothstep(.2,.8,r.z);
  float ring=smoothstep(.12,.0,abs(length(r.xy)-.52))*smoothstep(.0,.5,r.z);
  return vec3(1.,.74,.42)*strip*1.1 + vec3(.55,.68,1.)*ring*.55 + vec3(.02,.025,.035);
}

void main(){
  vec2 fc=gl_FragCoord.xy;
  vec2 p=(fc-.5*uRes)/(.5*uRes.y);
  vec3 dir=normalize(uRight*p.x+uUp*p.y-uBack*uF);
  float tHit=-uCam.z/dir.z;
  vec2 w0=uCam.xy+dir.xy*tHit;
  vec2 w=w0;
  vec2 gx=dFdx(w0), gy=dFdy(w0);

  // 显微镜：指针处放大，并掀开上层金属
  float lensD=length(fc-uLensC)/max(uLensR,1.);
  float inLens=uLensAmt*(1.-smoothstep(.985,1.,lensD));
  float mag=1.;
  if(inLens>.001){
    mag=mix(1.,3.2,inLens);
    w=mix(w0,uPtr.xy+(w0-uPtr.xy)/mag,inLens);
    float rim=smoothstep(.72,1.,lensD)*inLens;
    w+=(w0-uPtr.xy)*rim*rim*-.18;
    gx/=mag; gy/=mag;
  }

  float rad=length(w);
  float wpp=max(length(gx),length(gy));
  float edge=smoothstep(RW+wpp,RW-wpp,rad);
  // 定位缺口
  edge*=smoothstep(.024-wpp,.024+wpp,length(w-vec2(0.,-RW)));

  vec3 bg=vec3(.006,.0065,.008);
  bg+=vec3(.16,.09,.04)*.34*exp(-3.2*dot(p-vec2(.6,.55),p-vec2(.6,.55)));
  bg+=vec3(.05,.08,.16)*.18*exp(-2.2*dot(p+vec2(.8,.5),p+vec2(.8,.5)));

  if(uTitleA>.001){
    vec4 tt=texture(uTitle,vec2(.5)+(fc/uRes-.5)+uTitleOff);
    vec3 tc=mix(vec3(1.,.93,.82),vec3(.96,.96,.97),smoothstep(.2,.9,fc.y/uRes.y));
    bg=mix(bg,tc*.92,tt.a*uTitleA);
  }
  if(edge<=0.){ o=vec4(bg,1.); return; }

  vec2 cell=floor((w+.5*P)/P);
  vec2 lp=(w-cell*P)/D;
  vec2 uv=vec2(lp.x+.5,.5-lp.y);
  float dpp=wpp/D;
  float inDie=smoothstep(.5+dpp,.5-dpp,max(abs(lp.x),abs(lp.y)));
  float maskR=smoothstep(.972+wpp,.972-wpp,rad);

  // 景深：离焦点越远越糊
  float dof=1.+clamp(length(w0-uTarget.xy)*.9-uFocusH*1.4,0.,1.)*float(uFocusH>.5)*6.;
  vec2 dx=vec2(gx.x,-gx.y)/D*dof, dy=vec2(gy.x,-gy.y)/D*dof;
  float lod=log2(max(max(length(dx),length(dy))*uDieN,1e-4));
  float minify=clamp(lod-.6,0.,1.);

  vec4 s=textureGrad(uDie,uv,dx,dy);
  float top=s.r;
  float h=mix(smoothstep(.3,.56,s.g),s.g*1.5,minify);
  float v=mix(smoothstep(.3,.56,s.b),s.b*1.5,minify);
  float dev=s.a;
  float hashH=(s.g-.5)*2., hashV=(s.b-.5)*2.;

  // 所在模块
  vec4 mat=vec4(1.5,2.2,0.,0.);
  int id=-1;
  for(int i=0;i<10;i++){
    vec4 r=uBlk[i];
    if(uv.x>r.x&&uv.x<r.z&&uv.y>r.y&&uv.y<r.w){ id=i; mat=uMat[i]; break; }
  }

  // 显微镜里只留器件层
  float strip=inLens;
  top*=1.-strip; h*=1.-strip*.88; v*=1.-strip*.88;
  if(strip>.01){
    vec2 m=uv*uDieN/ (2.);
    float micro=step(.42,fract(m.x*1.))*step(.3,fract(m.y*.7));
    dev=mix(dev,dev*(.55+.45*micro)*1.5,strip);
  }

  // 晶圆级的状态图
  float lit=1., hue=0., hov=0.;
  if(uMapMix>.001){
    vec4 mm=texture(uMap,(cell+16.+.5)/32.);
    lit=mm.r; hue=mm.g; hov=mm.b;
  }

  float grain=vnoise(w/D*5.)*.5+vnoise(w/D*17.)*.5;
  float thick=mat.x+(grain-.5)*.22+(vnoise(cell*7.31)-.5)*.3;

  // 法线
  float hgt=dev*.18+(h+v)*.24+top*.5;
  float ndk=clamp(1.4-minify*1.4,0.,1.)*(.45/(wpp*uDieN/D+.8));
  vec3 n=normalize(vec3(-dFdx(hgt)*ndk,-dFdy(hgt)*ndk,1.));

  vec3 Pw=vec3(w,0.);
  vec3 V=normalize(uCam-Pw);
  float sc=max(uCam.z,.01);
  float a0=uT*.11;
  vec3 tg=uTarget;
  vec3 L0=normalize(tg+vec3(cos(a0)*.85,sin(a0)*.85,mix(1.05,.62,smoothstep(.22,.8,uViewH)))*sc-Pw);
  vec3 L1=normalize(tg+vec3(-sin(a0*1.3)*1.1,cos(a0*1.3)*.5,.9)*sc-Pw);
  vec3 Lp=vec3(uPtr.xy,sc*.32)-Pw;
  float dp2=dot(Lp,Lp)/(sc*sc);
  Lp=normalize(Lp);
  float ptrA=uPtr.z/(1.+dp2*14.);

  float pow0=uPower;
  float farK=smoothstep(.22,.8,uViewH);
  vec2 Tb=mat.z>.5?vec2(0.,1.):vec2(1.,0.);
  float dB=mix(mat.y,2.7,farK);

  vec3 rB=grat(L0,V,Tb,dB)*.5+grat(L1,V,Tb,dB)*.22+grat(Lp,V,Tb,dB)*ptrA*1.6;
  vec3 rH=grat(L0,V,vec2(0.,1.),dB*1.65)*.42+grat(L1,V,vec2(0.,1.),dB*1.65)*.18+grat(Lp,V,vec2(0.,1.),dB*1.65)*ptrA*1.5;
  vec3 rV=grat(L0,V,vec2(1.,0.),dB*1.3)*.42+grat(L1,V,vec2(1.,0.),dB*1.3)*.18+grat(Lp,V,vec2(1.,0.),dB*1.3)*ptrA*1.5;
  rB=rB*rB*1.5; rH=rH*rH*1.5; rV=rV*rV*1.5;

  float cosv=clamp(dot(n,V),0.,1.);
  vec3 tf=film(cosv,thick);

  // 器件层：薄膜底色 + 衍射
  vec3 col=mix(vec3(.006,.008,.012),tf*tf*.14,.85)*(.3+dev*1.1);
  col+=rB*(.12+dev*1.2);

  // 中层走线
  float mid=clamp(h+v,0.,1.);
  vec3 Cu=vec3(.95,.62,.4);
  vec3 refl=env(reflect(-V,n));
  col=mix(col,col*.45+Cu*.018+rH*h*1.2+rV*v*1.2+refl*.08*Cu,mid*.86);

  // 顶层金属
  vec3 H0=normalize(L0+V), Hp=normalize(Lp+V);
  float sp0=pow(max(dot(n,H0),0.),90.), spP=pow(max(dot(n,Hp),0.),70.)*ptrA;
  vec3 Al=mix(vec3(1.,.74,.42),vec3(.9,.88,.84),farK);
  float tv=.55+.45*vnoise(w/D*9.);
  vec3 topC=Al*.13*tv+refl*.42*Al+Al*(sp0*.9+spP*3.)+tf*.05+(rH+rV)*.22;
  col=mix(col,topC,top*.96);

  // 镜面硅：只在顶灯倒影的那一条上亮起来
  vec3 mirror=env(reflect(-V,vec3(0.,0.,1.)));
  col+=mirror*.05*smoothstep(1.,3.,lod);

  // 划片道
  vec3 street=vec3(.003,.0034,.0045)+mirror*.05*farK;
  float maskDie=inDie*maskR;
  col=mix(street,col,maskDie);

  // 晶圆边缘：无图形的抛光环
  vec3 rim=vec3(.012,.013,.016)+mirror*.5+grat(L0,V,normalize(w+1e-4),2.2)*.1;
  rim+=vec3(1.,.8,.55)*.4*smoothstep(RW-.008,RW-.002,rad);
  col=mix(rim,col,maskR);

  // 推近之后，只有中间这一颗通电
  if(uFocusCell>.001&&(abs(cell.x)+abs(cell.y))>.5) col*=mix(1.,.16,uFocusCell);

  // 上电：从中心向外亮起
  float wave=smoothstep(0.,.25,pow0*2.2-length(w)*.7);
  col*=mix(.02,1.,wave)*uGain;

  // 电流
  float dClose=clamp(1.-minify,0.,1.);
  float fx=uv.x*16.+hashH*53.-uT*(.32+hashH*.5)*(hashH>.6?1.:-1.);
  float fy=uv.y*16.+hashV*53.-uT*(.32+hashV*.5)*(hashV>.6?1.:-1.);
  float pH=smoothstep(.52,.6,hashH)*pow(fract(fx),22.);
  float pV=smoothstep(.52,.6,hashV)*pow(fract(fy),22.);
  float cur=(pH*smoothstep(.3,.56,s.g)+pV*smoothstep(.3,.56,s.b))*(1.-strip)*dClose;
  vec3 curC=mix(vec3(1.,.74,.34),vec3(.45,.8,1.),.5+.5*sin(mat.x*3.1));
  col+=cur*curC*(2.4+uBoost*7.)*maskDie*pow0;

  // 涟漪
  for(int i=0;i<6;i++){
    float age=uT-uRip[i].z;
    if(uRip[i].w<=0.||age<0.||age>2.4) continue;
    float dr=length(w-uRip[i].xy);
    float front=age*sc*.95;
    float wid=sc*.05+age*sc*.02;
    float wv=exp(-pow((dr-front)/wid,2.))*exp(-age*1.7)*uRip[i].w;
    col+=(top*1.2+mid*1.6+dev*.5+.08)*wv*vec3(1.,.78,.46)*2.6*maskDie;
  }

  // 悬停模块
  if(id>=0&&id==uHover){
    vec4 r=uBlk[id];
    float bd=min(min(uv.x-r.x,r.z-uv.x),min(uv.y-r.y,r.w-uv.y));
    float lw=max(dpp*2.4,.0018);
    col+=smoothstep(lw,lw*.3,bd)*vec3(1.,.82,.5)*2.6;
    col*=1.2;
    col+=vec3(1.,.8,.5)*.02;
  }

  // 作品图：点亮的芯片，其余留白
  if(uMapMix>.001){
    vec3 huec=.55+.45*cos(6.2831*(hue+vec3(0.,.33,.67)));
    float inW=maskDie;
    // 空位是暗的抛光硅，只有一道慢慢扫过的高光；做完的东西才亮
    float sweep=exp(-pow((w.x*.62+w.y*.78-.5*sin(uT*.13)-.1)/.42,2.));
    vec3 blank=vec3(.012,.013,.017)+vec3(1.,.8,.56)*.05*sweep+rB*.04;
    vec3 vivid=col*(.4+huec*1.3)+huec*.14*inW+huec*.42*hov;
    vec3 target=mix(blank,vivid,lit);
    col=mix(col,mix(target,col,1.-inW),uMapMix);
    col+=huec*hov*.5*uMapMix*(1.-smoothstep(.0,.1,.5-max(abs(lp.x),abs(lp.y))))*inW*1.8;
  }

  // 显微镜的镜筒
  if(uLensAmt>.001){
    float ring=smoothstep(.965,.985,lensD)*(1.-smoothstep(1.,1.015,lensD));
    vec3 ca=vec3(1.,.72,.38);
    col=mix(col,ca*2.2,ring*uLensAmt*.85);
    col*=1.-smoothstep(.72,1.,lensD)*(1.-step(1.,lensD))*.35*uLensAmt;
  }

  o=vec4(mix(bg,col,edge),1.);
}`;

const DOWN = `#version 300 es
precision highp float; out vec4 o; uniform sampler2D t; uniform vec2 r; uniform float th;
void main(){ vec2 u=gl_FragCoord.xy*r;
 vec3 c=textureLod(t,u,0.).rgb*.25;
 c+=textureLod(t,u+r*vec2(-1,-1),0.).rgb*.1875; c+=textureLod(t,u+r*vec2(1,-1),0.).rgb*.1875;
 c+=textureLod(t,u+r*vec2(-1,1),0.).rgb*.1875; c+=textureLod(t,u+r*vec2(1,1),0.).rgb*.1875;
 if(th>0.){ float l=max(c.r,max(c.g,c.b)); c*=smoothstep(th,th*2.2,l); }
 o=vec4(min(c,vec3(9.)),1.); }`;

const UP = `#version 300 es
precision highp float; out vec4 o; uniform sampler2D t; uniform vec2 r; uniform float rad;
void main(){ vec2 u=gl_FragCoord.xy*r; vec2 d=rad*r*.5;
 vec3 c=textureLod(t,u+vec2(-d.x,-d.y),0.).rgb; c+=textureLod(t,u+vec2(d.x,-d.y),0.).rgb;
 c+=textureLod(t,u+vec2(-d.x,d.y),0.).rgb; c+=textureLod(t,u+vec2(d.x,d.y),0.).rgb;
 o=vec4(c*.25,1.); }`;

const FINAL = `#version 300 es
precision highp float; out vec4 o; uniform sampler2D s,b; uniform vec2 r; uniform float uT,uBloom;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
float n(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){ vec2 u=gl_FragCoord.xy*r; vec2 c=u-.5; float d=dot(c,c);
 vec2 off=c*d*.012;
 vec3 col=vec3(textureLod(s,u+off,0.).r,textureLod(s,u,0.).g,textureLod(s,u-off,0.).b);
 col+=textureLod(b,u,0.).rgb*uBloom;
 col*=1.-d*.7;
 col=aces(col*1.15);
 col=pow(col,vec3(1./2.2));
 col+=(n(gl_FragCoord.xy+fract(uT)*91.)-.5)*.018;
 o=vec4(col,1.); }`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Renderer {
  constructor(canvas, { tier = 2 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('no-webgl2');
    this.gl = gl; this.canvas = canvas; this.tier = tier;
    this.floatOK = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.pScene = program(gl, SCENE(tier));
    this.pDown = program(gl, DOWN);
    this.pUp = program(gl, UP);
    this.pFinal = program(gl, FINAL);

    this.levels = tier >= 2 ? 5 : 3;
    this.lut = this.makeLut();
    this.mapData = new Uint8Array(32 * 32 * 4);
    this.mapTex = this.makeMap();
    this.ripples = Array.from({ length: 6 }, () => [0, 0, -99, 0]);
    this.ripI = 0;
    this.W = this.H = 0;
  }

  makeLut() {
    const gl = this.gl;
    const n = 2048, d = new Float32Array(n * 4), bump = (x) => Math.max(1 - x * x, 0);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 9;
      let r = 0, g = 0, b = 0;
      for (let k = 1; k <= 3; k++) {
        const y = (2 * u) / k - 1;
        r += bump(4 * (y - .75)); g += bump(4 * (y - .5)); b += bump(4 * (y - .25));
      }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 1;
    }
    const ub = new Uint8Array(n * 4);
    for (let i = 0; i < n * 4; i++) ub[i] = Math.min(255, d[i] * 170);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, ub);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  makeMap() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 32, 32, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.mapData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }
  updateMap() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, this.mapData);
  }

  setDie({ data, size }) {
    const gl = this.gl;
    this.dieN = size;
    this.dieTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dieTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);

    const { p, u } = this.pScene;
    gl.useProgram(p);
    const blk = new Float32Array(40), mat = new Float32Array(40);
    BLOCKS.forEach((b, i) => {
      blk.set(b.rect.map((v) => v / 100), i * 4);
      mat.set([b.film, b.pitch, b.ang, 0], i * 4);
    });
    gl.uniform4fv(u.uBlk, blk);
    gl.uniform4fv(u.uMat, mat);
    gl.uniform1f(u.uDieN, size);
  }

  // 只重传版图的一块：访客把名字刻上去时用
  updateDie(die, x, y, w, h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.dieTex);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, die.size);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, die.data);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  resize(cssW, cssH, dpr) {
    const W = Math.max(2, Math.round(cssW * dpr)), H = Math.max(2, Math.round(cssH * dpr));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.canvas.width = W; this.canvas.height = H;
    const gl = this.gl;
    const makeFBO = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w, h };
    };
    this.free?.();
    this.main = makeFBO(W, H);
    this.chain = [];
    let w = W, h = H;
    for (let i = 0; i < this.levels; i++) {
      w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
      this.chain.push(makeFBO(w, h));
    }
    this.free = () => {
      for (const f of [this.main, ...this.chain]) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); }
    };
  }

  setTitle(canvas2d) {
    const gl = this.gl;
    this.titleTex = this.titleTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.titleTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  ripple(x, y, t, amp = 1) {
    this.ripples[this.ripI] = [x, y, t, amp];
    this.ripI = (this.ripI + 1) % 6;
  }

  render(state) {
    const gl = this.gl;
    const { p, u } = this.pScene;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main.fbo);
    gl.viewport(0, 0, this.W, this.H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.dieTex); gl.uniform1i(u.uDie, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lut); gl.uniform1i(u.uLut, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.mapTex); gl.uniform1i(u.uMap, 2);

    gl.uniform2f(u.uRes, this.W, this.H);
    gl.uniform1f(u.uT, state.t);
    gl.uniform1f(u.uPower, state.power);
    gl.uniform1f(u.uBoost, state.boost);
    gl.uniform1f(u.uGain, state.gain);
    gl.uniform1f(u.uMapMix, state.mapMix);
    gl.uniform1f(u.uF, state.cam.f);
    gl.uniform1f(u.uFocusH, state.cam.dof);
    gl.uniform1f(u.uViewH, state.cam.h);
    gl.uniform1f(u.uFocusCell, state.focusCell);
    gl.uniform1f(u.uTitleA, state.titleA);
    gl.uniform2f(u.uTitleOff, state.titleOff[0], state.titleOff[1]);
    if (this.titleTex) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.titleTex); gl.uniform1i(u.uTitle, 3); gl.activeTexture(gl.TEXTURE0); }
    gl.uniform3fv(u.uCam, state.cam.pos);
    gl.uniform3fv(u.uRight, state.cam.right);
    gl.uniform3fv(u.uUp, state.cam.up);
    gl.uniform3fv(u.uBack, state.cam.back);
    gl.uniform3fv(u.uTarget, state.cam.target);
    gl.uniform3f(u.uPtr, state.ptr[0], state.ptr[1], state.ptr[2]);
    gl.uniform2f(u.uLensC, state.lensPx[0], state.lensPx[1]);
    gl.uniform1f(u.uLensR, state.lensR);
    gl.uniform1f(u.uLensAmt, state.lens);
    gl.uniform1i(u.uHover, state.hover);
    gl.uniform4fv(u.uRip, new Float32Array(this.ripples.flat()));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Bloom：逐级缩小再加回来
    const dp = this.pDown; gl.useProgram(dp.p);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(dp.u.t, 0);
    let src = this.main;
    this.chain.forEach((f, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      gl.viewport(0, 0, f.w, f.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(dp.u.r, 1 / f.w, 1 / f.h);
      gl.uniform1f(dp.u.th, i === 0 ? 1.0 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = f;
    });
    const up = this.pUp; gl.useProgram(up.p);
    gl.uniform1i(up.u.t, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.chain.length - 1; i > 0; i--) {
      const f = this.chain[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      gl.viewport(0, 0, f.w, f.h);
      gl.bindTexture(gl.TEXTURE_2D, this.chain[i].tex);
      gl.uniform2f(up.u.r, 1 / f.w, 1 / f.h);
      gl.uniform1f(up.u.rad, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    const fp = this.pFinal; gl.useProgram(fp.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.main.tex); gl.uniform1i(fp.u.s, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.chain[0].tex); gl.uniform1i(fp.u.b, 1);
    gl.uniform2f(fp.u.r, 1 / this.W, 1 / this.H);
    gl.uniform1f(fp.u.uT, state.t);
    gl.uniform1f(fp.u.uBloom, 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
