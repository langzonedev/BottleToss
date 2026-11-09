import { AIM_DEPTH, clamp, mix, signs } from './engine.mjs?v=3';

const TAU = Math.PI * 2;
const noise = (n) => { const v = Math.sin(n * 127.13 + 81.17) * 43758.5453; return v - Math.floor(v); };
const cameraLean = (lean, reduced) => reduced ? lean * .14 : lean;
const ease = (t) => t * t * (3 - 2 * t);

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.backdrop = document.createElement('canvas');
    this.nightBackdrop = document.createElement('canvas');
    this.resize();
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.w = width;
    this.h = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.focal = Math.min(width * .96, height * 1.48);
    this.horizon = height * (width < 650 ? .49 : .46);
    this.centre = width * (width < 650 ? .415 : .52);
    this.cacheBackdrop(this.backdrop, false);
    this.cacheBackdrop(this.nightBackdrop, true);
  }

  poly(colour, points, stroke, weight = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    if (colour) { c.fillStyle = colour; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = weight; c.stroke(); }
  }

  oval(x, y, rx, ry, fill, rotation = 0) {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rotation, 0, TAU);
    c.fill();
  }

  line(colour, width, points) {
    const c = this.ctx;
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.stroke();
  }

  text(text, x, y, size, colour, align = 'center') {
    const c = this.ctx;
    c.font = '800 ' + size + 'px ui-monospace, monospace';
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = colour;
    c.fillText(text, x, y);
  }

  gradient(x, y, endX, endY, stops) {
    const g = this.ctx.createLinearGradient(x, y, endX, endY);
    stops.forEach(([at, colour]) => g.addColorStop(at, colour));
    return g;
  }

  cacheBackdrop(canvas, night) {
    const foreground = this.ctx;
    canvas.width = Math.round(this.w);
    canvas.height = Math.round(this.h);
    this.ctx = canvas.getContext('2d');
    const c = this.ctx, w = this.w, h = this.h, horizon = this.horizon;
    const sky = night
      ? [[0,'#0b1429'],[.22,'#151f3b'],[.42,'#364066'],[.54,'#654b6b'],[1,'#211e39']]
      : [[0,'#202638'],[.22,'#67435c'],[.40,'#d37162'],[.54,'#fac48a'],[.75,'#bd7259'],[1,'#5a3533']];
    c.fillStyle = this.gradient(0,0,0,h,sky);
    c.fillRect(0,0,w,h);

    if (night) {
      for (let i = 0; i < 46; i++) {
        const radius = .45 + noise(i+151)*.92;
        this.oval(w*noise(i+341),h*(.045+noise(i+490)*.36),radius,radius,'#d5dcff95');
      }
      const mx = w*.67, my = h*.22, r = Math.min(w*.036,h*.026);
      this.oval(mx,my,r*1.55,r*1.55,'#b8c9ff12');
      this.oval(mx,my,r,r,'#dfe9ff');
      this.oval(mx+r*.46,my-r*.23,r*.88,r*.88,'#1b2744');
    }
    for (let i = 0; i < 22; i++) {
      const x = noise(i + 71) * w, y = h * (.10 + noise(i + 111) * .34);
      const span = (.04 + noise(i + 31) * .16) * w;
      const colour = night ? '#434b7041' : i % 3 ? '#f2a58b24' : '#662b512b';
      this.poly(colour, [[x - span, y], [x - span * .45, y - h * .006], [x + span * .66, y - h * .001], [x + span, y + h * .003], [x - span * .22, y + h * .007]]);
    }

    const skyline = Array(32).fill(h);
    const mountains = night ? ['#303755','#252d4b','#1c243c'] : ['#8d525d','#62444f','#493741'];
    for (let layer = 0; layer < mountains.length; layer++) {
      const points = [[-3, h]];
      for (let i = -1; i <= 30; i++) {
        const wave = .62 + .30 * Math.sin(i * .37 + layer * 3.1) + .21 * Math.sin(i * 1.11 + layer);
        const edge = Math.min(1, Math.abs(i - 14) / 7);
        const y = horizon + h * (layer * .021 - (.025 + .1 * edge) * wave - noise(i + layer * 17) * .014);
        points.push([w * i / 28, y]);
        skyline[i+1] = Math.min(skyline[i+1],y,horizon+1);
      }
      points.push([w + 5, h]);
      this.poly(mountains[layer], points);
    }
    this.skyline = skyline.map((y,i) => [w*(i-1)/28,y]);

    const ground = night
      ? [[0,'#393548'],[.18,'#343047'],[.56,'#27283f'],[1,'#191e30']]
      : [[0,'#815653'],[.18,'#94594a'],[.56,'#66403d'],[1,'#2c252e']];
    c.fillStyle = this.gradient(0,horizon-h*.009,0,h,ground);
    c.fillRect(0,horizon+1,w,h-horizon);
    for (let i = 0; i < 23; i++) {
      const y = horizon + 3 + (h - horizon) * Math.pow(i / 24, 2);
      this.line(night ? '#74718c24' : i % 2 ? '#a471532c' : '#442d3627',1,[[0,y],[w,y]]);
    }
    this.ctx = foreground;
  }

  sky(view) {
    const { w, h, ctx: c } = this;
    const lean = cameraLean(view.lean,view.reduced);
    const x = -w*.058*lean, y = -h*.018*lean;
    const width = w-x, height = h-y;
    c.drawImage(this.backdrop,x,y,width,height);
    if (view.dark > 0) {
      c.globalAlpha = view.dark;
      c.drawImage(this.nightBackdrop,x,y,width,height);
      c.globalAlpha = 1;
    }
    const sunlight = 1 - ease(clamp(view.progress/.76,0,1));
    if (!(sunlight > 0)) return;

    const sx = mix(.70,.83,view.progress)*w, sy = this.horizon + mix(-.083,.064,view.progress)*h;
    const r = Math.min(w*.065,h*.056);
    c.save();
    c.beginPath();
    c.moveTo(-2,0);
    c.lineTo(w+2,0);
    for (let i = this.skyline.length-1; i >= 0; i--) {
      const [px,py] = this.skyline[i];
      c.lineTo(x+px*width/w,y+py*height/h);
    }
    c.closePath();
    c.clip();
    c.globalAlpha = sunlight;
    const halo = c.createRadialGradient(sx,sy,r*.1,sx,sy,r*4);
    halo.addColorStop(0,'#ffcf839c');
    halo.addColorStop(.40,'#ff946e54');
    halo.addColorStop(1,'#ff956800');
    c.fillStyle = halo;
    c.fillRect(sx-r*4,sy-r*4,r*8,r*8);
    this.oval(sx,sy,r,r,'#ffe2a4');
    c.restore();
  }

  project(x, y, z, view) {
    const s = this.focal / Math.max(.45, z);
    const lean = cameraLean(view.lean, view.reduced);
    return [
      this.centre - lean * this.w * .115 + (x - lean * 1.05) * s,
      this.horizon + view.bob - lean * this.h * .009 + (1.64 + lean * .20 - y) * s,
    ];
  }

  road(view) {
    const { dist } = view;
    const p = (x, z) => this.project(x, 0, z, view);
    const near = 1.35, far = 310;
    const strip = (x1, x2, z1, z2, fill) => this.poly(fill, [p(x1,z1), p(x2,z1), p(x2,z2), p(x1,z2)]);
    strip(-5.18, 5.18, near, far, '#ac7759');
    strip(-4.16, 4.16, near, far, this.gradient(0, this.horizon, 0, this.h * .91, [[0,'#674f50'], [.12,'#48434a'], [1,'#242731']]));
    if (view.dark > 0) {
      this.ctx.globalAlpha = view.dark;
      strip(-5.18,5.18,near,far,'#222439');
      strip(-4.16,4.16,near,far,this.gradient(0,this.horizon,0,this.h*.9,[[0,'#302b42'],[.25,'#242a3c'],[1,'#121929']]));
      const wash = this.gradient(0,this.horizon,0,this.h*.91,[[0,'#ffd59900'],[.09,'#ffe1ad44'],[.38,'#f6c98331'],[1,'#e9b37210']]);
      this.poly(wash,[p(-3.8,near),p(4.9,near),p(3.2,19),p(.75,37),p(-2.0,27)]);
      this.ctx.globalAlpha = 1 - view.dark*.36;
    }
    strip(-4.03, -3.89, near, far, '#eed0ac');
    strip(3.89, 4.03, near, far, '#eed0ac');
    strip(4.35, 4.47, near, far, '#4a3533');
    for (let i = 30; i > 0; i--) {
      const z = i * 10 - (dist % 10);
      if (z + 4.4 > near) strip(-.086, .086, Math.max(near, z), z + 4.4, '#e9b978');
    }
    for (let i = 42; i > 0; i--) {
      const z = i * 5 - (dist % 5);
      const x = (noise(i + Math.floor(dist / 5)) - .5) * 7.7;
      if (z > near) strip(x, x + .05, z, z + .8, '#eed8c31b');
    }
    this.ctx.globalAlpha = 1;
  }

  scenery(view) {
    const drawList = [];
    const start = Math.floor(view.dist / 11);
    for (let i = start + 1; i <= start + 25; i++) {
      const z = i * 11 - view.dist;
      if (z < 2) continue;
      drawList.push({ z, i });
    }
    view.targets.forEach(target => {
      const z = target.z - view.dist;
      if (z > 2 && z < 285) drawList.push({ z, target });
      if (target.kind === 'radar' && z > -3 && z < 265) drawList.push({ z:z+5, patrol:target });
    });
    drawList.sort((a, b) => b.z - a.z);
    drawList.forEach(({z,i,target,patrol}) => {
      if (target) this.sign(target,z,view);
      else if (patrol) this.patrolCar(patrol,z,view);
      else this.props(i,z,view);
    });
  }

  props(i, z, view) {
    const s = this.focal / z;
    this.ctx.globalAlpha = 1 - (view.dark ?? 0)*.56;
    for (const side of [-1, 1]) {
      const k = i + side * 2187;
      const [x, y] = this.project(side * (7.2 + 16 * noise(k)), 0, z, view);
      if (x < -s * 5 || x > this.w + s * 5) continue;
      const shadow = side * s * 1.7;
      this.oval(x + shadow * .42, y + .06 * s, s * 1.9, s * .15, '#332a325a');
      if ((i + (side > 0 ? 2 : 0)) % 4 === 0) {
        const tall = s * (2.7 + noise(k + 6) * 3.2);
        this.line('#493339', Math.max(1, .17 * s), [[x, y], [x + .24 * s, y - tall * .75], [x - .1 * s, y - tall]]);
        this.line('#4e393b', Math.max(.8, .11 * s), [[x, y - tall * .44], [x - s * .69, y - tall * .74], [x - s * .91, y - tall * .81]]);
        for (let j = 0; j < 7; j++) {
          const px = x + (noise(k + j * 4) - .5) * s * 2.8;
          const py = y - tall * (.66 + noise(k + j + 121) * .34);
          this.oval(px, py, s * (.51 + noise(k + j + 45) * .58), s * (.27 + noise(k + j + 15) * .31), j % 3 === 0 ? '#84604b' : '#574748', -.13);
        }
      } else {
        for (let j = 0; j < 4; j++) {
          const px = x + (j - 1.5) * s * .43;
          this.poly(j % 2 ? '#624c47' : '#87624c', [[px-s*.55,y],[px-s*.24,y-s*.31],[px+s*.02,y-s*(.29+noise(k+j)*.42)],[px+s*.36,y-s*.33],[px+s*.5,y]]);
        }
      }
    }

    this.ctx.globalAlpha = 1;
    if (i % 2 === 0) {
      const [x, y] = this.project(4.72, 0, z, view);
      this.line('#e4c9af', Math.max(1, .10 * s), [[x, y], [x, y - .77 * s]]);
      this.line('#c75242', Math.max(1, .108 * s), [[x, y - .54 * s], [x, y - .68 * s]]);
    }
  }

  patrolCar(target, z, view) {
    const x = target.x + 2.5;
    const p = (dx,y,dz) => this.project(x+dx,y,z+dz,view);
    const s = this.focal/z;
    const [cx,cy] = p(0,0,0);
    if (cx > this.w+s*3 || cx < -s*3) return;
    const poly = (colour, points, edge) => this.poly(colour,points.map(point => p(...point)),edge,Math.max(.65,s*.04));
    this.oval(cx,cy,s*1.43,s*.13,'#13182496');

    for (const [wx,wz] of [[-.76,.27],[.74,.29],[-.76,2.74]]) {
      const [px,py] = p(wx,.27,wz);
      this.oval(px,py,s*.25,s*.25,'#171a22');
      this.oval(px,py,s*.14,s*.14,'#585b6b');
    }
    poly('#a5adbd',[[-.91,.31,.1],[-.91,.73,.26],[-.87,.75,3.25],[-.83,.37,3.40]],'#373d52');
    poly('#dce4e8',[[-.91,.73,.26],[.91,.73,.26],[.86,.77,3.25],[-.87,.75,3.25]]);
    poly('#d3d8df',[[-.91,.31,.1],[.91,.31,.1],[.91,.73,.26],[-.91,.73,.26]],'#474d61');
    poly('#ebe8df',[[-.72,.74,.95],[.72,.74,.95],[.57,1.41,1.66],[-.57,1.41,1.66]],'#62667a');
    poly('#323d59',[[-.56,.79,1.00],[.56,.79,1.00],[.46,1.31,1.58],[-.46,1.31,1.58]]);
    poly('#748398',[[-.72,.74,.95],[-.57,1.41,1.66],[-.55,1.35,2.68],[-.79,.75,3.10]],'#d1d7da');
    poly('#e7e7e4',[[-.57,1.41,1.66],[.57,1.41,1.66],[.54,1.37,2.72],[-.55,1.35,2.68]]);

    const [bx,by] = p(0,1.53,1.97);
    this.ctx.fillStyle = '#263451';
    this.ctx.fillRect(bx-s*.44,by,s*.88,s*.15);
    this.oval(bx-s*.27,by+s*.052,s*.15,s*.071,'#67c3ff');
    this.oval(bx+s*.27,by+s*.052,s*.15,s*.071,'#ff7d89');
    for (const side of [-1,1]) {
      const [lx,ly] = p(side*.66,.55,.15);
      if (view.dark > .15) this.oval(lx,ly,s*.34,s*.15,'#ffcf7840');
      this.oval(lx,ly,s*.16,s*.075,'#fff0b6');
    }
    const [fx,fy] = p(0,.50,.08);
    this.ctx.fillStyle = '#26304b';
    this.ctx.fillRect(fx-s*.34,fy-s*.06,s*.68,s*.12);
    if (s > 12) this.text('POLICE',fx,fy-s*.15,Math.max(6,s*.17),'#263451');
    for (let i=0;i<4;i++) {
      const [lx,ly] = p(-.91,.60,.57+i*.53);
      this.ctx.fillStyle = i%2 ? '#e8d55f' : '#355cab';
      this.ctx.fillRect(lx,ly,s*.17,s*.13);
    }
  }

  sign(target, z, view) {
    const c = this.ctx, s = this.focal / z;
    const [x, y] = this.project(target.x, target.y, z, view);
    const [groundX, groundY] = this.project(target.x, 0, z, view);
    if (x > this.w + s * 2 || x < -s * 2) return;
    const info = signs[target.kind], w = info.w * s, h = info.h * s;
    const poles = target.kind === 'direction' ? [-.28, .28] : [0];
    poles.forEach(offset => {
      this.line('#534648', Math.max(1, s * .10), [[groundX + w * offset + 1, groundY], [x + w * offset + 1, y]]);
      this.line('#bea88e', Math.max(1, s * .051), [[groundX + w * offset, groundY], [x + w * offset, y]]);
    });
    this.oval(groundX + .42*s, groundY, s * .63, Math.max(.55,s * .047), '#33282e78');

    c.save();
    c.translate(x, y);
    if (target.hitAt !== null) {
      const elapsed = view.time - target.hitAt;
      c.rotate(view.reduced ? .05 : Math.sin(elapsed * 36) * Math.exp(-elapsed * 5) * .19);
    }
    const rim = Math.max(1, s * .051);
    if (target.kind === 'direction') {
      c.fillStyle = '#1a594d';
      c.fillRect(-w/2, -h/2, w, h);
      c.strokeStyle = '#e5ead4'; c.lineWidth = rim;
      c.strokeRect(-w/2 + rim/2, -h/2 + rim/2, w-rim, h-rim);
      if (s > 5) {
        this.text('SUNSET', -w*.10, -h*.16, h*.27, '#fffae3');
        this.text('CIRCUIT', -w*.10, h*.18, h*.20, '#e5ead4');
        this.text('↗', w*.34, 0, h*.48, '#fffae3');
      }
    } else if (target.kind === 'warning') {
      this.poly('#ffbb49', [[0,-h/2],[w/2,0],[0,h/2],[-w/2,0]], '#2e2729', rim);
      if (s > 7) this.text('!', 0, h*.025, h*.68, '#2b272a');
    } else if (target.kind === 'radar') {
      this.line('#d5a85a',Math.max(1,s*.055),[[0,h*.5],[-w*.39,s*target.y],[0,h*.5],[w*.39,s*target.y]]);
      if (s > 10) this.oval(0,0,w*.68,h*.79,'#ffbd5c21');
      c.fillStyle = '#201c2c'; c.fillRect(-w/2,-h/2,w,h);
      c.strokeStyle = '#ffbf63'; c.lineWidth = rim;
      c.strokeRect(-w/2+rim/2,-h/2+rim/2,w-rim,h-rim);
      if (s > 7) this.text('RADAR',0,0,h*.34,'#ffd68c');
    } else {
      this.oval(0, 0, w/2, h/2, '#f7ebd8');
      this.oval(0, 0, w*.46, h*.46, '#c13534');
      this.oval(0, 0, w*.34, h*.34, '#fff1de');
      if (s > 7) this.text(String(target.label), 0, h*.012, h*.33, '#252627');
    }
    if (target.hitAt !== null) {
      this.line('#28232aac', Math.max(1,s*.048), [[-w*.12,-h*.24],[0,0],[w*.19,-h*.19]]);
      this.line('#28232aac', Math.max(1,s*.048), [[-w*.20,h*.13],[0,0],[w*.13,h*.20]]);
    }
    c.restore();
  }

  cabin(view) {
    const c = this.ctx;
    const w = this.w, h = this.h;
    const narrow = w < 650;
    const lean = cameraLean(view.lean, view.reduced);
    // The near cabin slides left faster than the road as the player clears the window.
    const shift = -lean * .46;
    const p = (x,y) => [(x + shift) * w, (y + lean * (y - .30) * .16) * h + view.bob * .65];
    const poly = (colour, points, line, weight) => this.poly(colour, points.map(([x,y]) => p(x,y)), line, weight);
    const line = (colour, weight, points) => this.line(colour, weight, points.map(([x,y]) => p(x,y)));

    poly(this.gradient(0,0,0,h*.22,[[0,'#11141d'],[1,'#30252d']]), [[-.08,-.03],[1.09,-.03],[1.05,.15],[.91,.122],[.73,.082],[.54,.068],[.31,.084],[.14,.125],[-.04,.22]]);
    line('#795457', Math.max(1,h*.003), [[-.03,.204],[.14,.116],[.31,.077],[.54,.061],[.73,.076],[.92,.115],[1.06,.145]]);
    poly('#29252f', [[-.052,.12],[.075,.111],[.205,.49],[.205,.65],[.14,.67],[.083,.48],[-.06,.20]]);
    line('#5e414b', Math.max(1,h*.005), [[.075,.126],[.20,.51],[.205,.60]]);
    poly('#29252e', [[.77,.082],[.813,.082],[.755,.425],[.735,.629],[.696,.65],[.716,.463]]);
    line('#875755', Math.max(1,h*.003), [[.777,.105],[.722,.48],[.703,.622]]);
    const mirrorDrop = Math.max(0,(w <= 710 ? 145 : 79) / h - .132);
    const mirrorShape = (colour, points) => poly(colour, points.map(([x,y]) => [x,y+mirrorDrop]));
    poly('#1a1c25', [[.493,.07],[.517,.07],[.514,.116+mirrorDrop],[.49,.116+mirrorDrop]]);
    mirrorShape('#1a1c25', [[.49,.108],[.57,.111],[.57,.146],[.542,.158],[.433,.156],[.409,.144],[.416,.115]]);
    mirrorShape('#736164', [[.424,.121],[.552,.117],[.561,.124],[.557,.143],[.434,.148],[.42,.141]]);
    const reflection = [[.426,.136],[.488,.128],[.554,.129],[.553,.139],[.434,.144]];
    mirrorShape('#b48075',reflection);
    if (view.dark > 0) {
      c.globalAlpha = view.dark;
      mirrorShape('#434b6a',reflection);
      c.globalAlpha = 1;
    }
    if (view.mirror >= 0 && view.mirror < 5) {
      const [rx,ry] = p(.493,.132+mirrorDrop);
      const fade = Math.min(1,view.mirror*5,(5-view.mirror)*1.4);
      const pulse = view.reduced ? .48 : .25 + .75*(.5+.5*Math.cos(TAU*1.35*view.mirror))**2;
      const size = Math.max(3,Math.min(w,h)*.012);
      for (const [offset,colour,glow] of [[-1,'#a6dcff','#498dff'],[1,'#ffadb5','#ff506f']]) {
        c.globalAlpha = fade * pulse * .44;
        this.oval(rx+offset*size*.72,ry,size*1.12,size*.69,glow);
        c.globalAlpha = fade * pulse;
        this.oval(rx+offset*size*.72,ry,size*.41,size*.30,colour);
      }
      c.globalAlpha = 1;
    }

    poly(this.gradient(0,h*.58,0,h,[[0,'#42404b'],[.24,'#222530'],[1,'#10131d']]), [[-.08,.69],[.105,.647],[.235,.625],[.49,.614],[.695,.628],[.78,.666],[1.08,.624],[1.09,1.09],[-.09,1.09]]);
    line('#8a5655', Math.max(1,h*.003), [[-.03,.682],[.235,.621],[.49,.609],[.694,.625],[.78,.662]]);
    poly('#2e2d37', [[.719,.62],[.817,.60],[.883,.578],[1.03,.548],[1.10,.638],[.99,.769],[.851,.814],[.758,.799],[.683,.708]]);
    line('#9a6259', Math.max(1,h*.004), [[.718,.621],[.816,.601],[.883,.578],[1.03,.547]]);
    line('#51404a', Math.max(1,h*.009), [[.74,.683],[.88,.651],[1.02,.628]]);
    poly('#141722', [[.845,.69],[.922,.668],[.942,.678],[.921,.703],[.853,.722],[.832,.709]]);
    line('#806761', Math.max(1,h*.003), [[.846,.693],[.917,.675],[.932,.681]]);
    poly('#201f28', [[.713,.774],[.854,.797],[1.08,.741],[1.08,1.1],[.58,1.1]]);

    // Steering wheel, driver's silhouette and front seat sit ahead of the player.
    const dx = narrow ? .195 : .245;
    const [wheelX,wheelY] = p(dx+.112,.627);
    c.strokeStyle = '#131821'; c.lineWidth = Math.max(4,h*.016);
    c.beginPath(); c.ellipse(wheelX,wheelY,Math.min(w*.072,h*.104),h*.064,-.14,0,TAU); c.stroke();
    line('#71707b', Math.max(1,h*.003), [[dx+.056,.602],[dx+.103,.636],[dx+.169,.598]]);
    const [headX,headY] = p(dx,.514);
    const headW = Math.min(w * (narrow ? .079 : .06),h*.085);
    this.oval(headX, headY, headW, h*.080, '#30242d', -.14);
    this.oval(headX-headW*.16,headY-h*.023,headW*.86,h*.064,'#191b24',-.13);
    this.oval(headX+headW*.77,headY+h*.01,headW*.21,h*.020,'#925e54',.22);
    const torso = this.gradient(0,h*.56,0,h*.96,[[0,'#4b515b'],[1,'#1b2630']]);
    poly(torso, [[dx-.06,.571],[dx+.042,.573],[dx+.078,.607],[dx+.127,.60],[dx+.15,.616],[dx+.12,.663],[dx+.083,.68],[dx+.09,.848],[dx-.16,.884],[dx-.143,.66],[dx-.113,.605]]);
    line('#8b6562',Math.max(1,h*.003),[[dx-.11,.611],[dx-.06,.573],[dx+.047,.574],[dx+.083,.608]]);
    this.oval(wheelX + w*.033,wheelY-h*.030,Math.min(w*.019,h*.024),h*.015,'#9a685c',-.32);
    poly(this.gradient(0,h*.65,0,h,[[0,'#3b323d'],[.31,'#2b2935'],[1,'#151822']]), [[-.12,1.12],[-.04,.786],[.023,.681],[.09,.653],[dx+.066,.65],[dx+.128,.693],[dx+.156,.792],[dx+.20,1.12]], '#51414b', Math.max(1,h*.004));
    line('#61505b',Math.max(1,h*.002),[[.015,.708],[.079,.677],[dx+.057,.677],[dx+.112,.707],[dx+.148,.819]]);
    poly('#1c202a', [[.412,.677],[.611,.67],[.675,.714],[.731,1.11],[.414,1.11],[.386,.78]]);
    poly('#453839', [[.444,.754],[.517,.74],[.579,.765],[.588,.88],[.543,.91],[.455,.90],[.426,.85]], '#715346', Math.max(1,h*.003));
    line('#a3785c',Math.max(1,h*.003),[[.446,.757],[.478,.78],[.542,.78],[.576,.767]]);
    if (view.ammo > 0) {
      this.bottle(...p(.482,.817),Math.min(w*.046,h*.046),-.4);
      if (view.ammo > 1) this.bottle(...p(.522,.812),Math.min(w*.044,h*.044),.26);
      if (view.ammo > 2) this.bottle(...p(.55,.829),Math.min(w*.040,h*.040),.56);
    }
  }

  windowSill(view) {
    const w = this.w, h = this.h;
    const lean = cameraLean(view.lean, view.reduced);
    if (lean < .01) return;
    const top = mix(1.05,.76,lean) * h;
    const left = mix(.98,.39,lean) * w;
    const edge = [[left,h*1.04],[left+w*.13,top+h*.095],[w*1.04,top]];
    this.poly(this.gradient(0,top,0,h,[[0,'#59515b'],[.13,'#34323e'],[1,'#20232e']]),
      [...edge,[w*1.04,h*1.04]]);
    this.line('#a46c63',Math.max(2,h*.004),edge);
    this.line('#1a2029',Math.max(2,h*.008),edge.map(([x,y]) => [x,y+h*.011]));
  }

  armPose(aim, lean, reduced, charge, follow) {
    const { w, h } = this;
    const u = Math.min(w,h) * .125;
    const [ax,ay] = this.project(aim.x,aim.y,AIM_DEPTH,{lean,reduced,bob:0});
    const windup = ease(charge);
    const sweep = Math.sin(Math.PI * ease(clamp(follow / .36,0,1))) * (reduced ? .38 : 1);
    const drop = ease(clamp((follow - .17) / .75,0,1));
    const retract = ease(clamp((follow - .78) / .66,0,1));
    const x = w * mix(.91,.79,lean) + (ax-w*.68)*.35 + u*(.39*windup-1.05*sweep+.43*drop);
    const y = h * mix(.99,.645,lean) + (ay-this.horizon)*.48 + u*(-.12*windup-1.08*sweep+1.28*drop+2.4*retract);
    const angle = -.26 - windup*.34 - sweep*.61 + drop*.34;
    const gripX = x + u*(.04*Math.cos(angle) + .20*Math.sin(angle));
    const gripY = y + u*(.04*Math.sin(angle) - .20*Math.cos(angle));
    return {x,y,u,angle,gripX,gripY,bottleSize:u*.91,bottleAngle:angle-.24};
  }

  launchOrigin(aim, lean, reduced) {
    const pose = this.armPose(aim,lean,reduced,1,0);
    return {
      x: pose.gripX / this.w, y: pose.gripY / this.h,
      size: pose.bottleSize / Math.min(this.w,this.h), angle: pose.bottleAngle,
    };
  }

  hand(view) {
    const follow = view.follow ?? view.shots[0]?.age;
    if (view.lean < .015 || follow > 1.44) return;
    const c = this.ctx, w = this.w, h = this.h;
    const gripping = follow === undefined;
    const {x,y,u,angle,gripX,gripY,bottleSize,bottleAngle} =
      this.armPose(view.aim,view.lean,view.reduced,view.charge ?? 1,follow ?? 0);

    const shoulder = [w*.99 + u*.5,h*.98 + u*.33];
    const elbow = [x + u*1.24,y + u*1.42];
    const wrist = [x + u*.26,y + u*.19];
    const sleeve = this.gradient(x,y,shoulder[0],shoulder[1],[[0,'#686274'],[.46,'#484759'],[1,'#232735']]);
    c.beginPath();
    c.moveTo(shoulder[0]-u*.51,shoulder[1]+u*.19);
    c.quadraticCurveTo(elbow[0]-u*.45,elbow[1]+u*.19,wrist[0]-u*.34,wrist[1]+u*.22);
    c.lineTo(wrist[0]+u*.23,wrist[1]-u*.32);
    c.quadraticCurveTo(elbow[0]+u*.57,elbow[1]-u*.45,shoulder[0]+u*.50,shoulder[1]-u*.42);
    c.closePath();
    c.fillStyle = sleeve; c.fill();
    this.line('#a38890',Math.max(1,u*.023),[[wrist[0]+u*.20,wrist[1]-u*.25],[elbow[0]+u*.30,elbow[1]-u*.29],[shoulder[0],shoulder[1]-u*.36]]);
    this.line('#373748',Math.max(1,u*.084),[[wrist[0]-u*.27,wrist[1]+u*.22],[wrist[0]+u*.25,wrist[1]-u*.29]]);

    c.save();
    c.translate(x,y); c.rotate(angle); c.scale(u,u);
    this.oval(.04,.10,.34,.24,'#a96858',.23);
    this.oval(-.03,.035,.29,.21,'#d18b6d',.24);
    c.restore();

    if (gripping) this.bottle(gripX,gripY,bottleSize,bottleAngle);

    c.save();
    c.translate(x,y); c.rotate(angle); c.scale(u,u);
    const open = gripping ? 0 : 1 - ease(clamp((follow - .24) / .51,0,1));
    for (let i=0;i<4;i++) {
      const fy = -.14+i*.089;
      const fx = -.09 - open*(.17-i*.026);
      this.oval(fx,fy,.225-i*.014+open*.075,.058,i % 2 ? '#e3a17e' : '#efad84',-.29-open*.17);
      this.line('#b97860',.014,[[fx-.07,fy+.035],[fx+.037,fy+.008]]);
    }
    this.oval(.21,.035,.13,.082,'#efae83',-.80);
    c.restore();

    if (!view.reduced && view.lean > .58) {
      c.globalAlpha = view.lean * .42;
      for (let i=0;i<6;i++) {
        const t = (view.dist*.17+i*.173)%1;
        const sx = w * (.68 + .35*t), sy = h * (.23+i*.066);
        this.line('#ffdeae84',1,[[sx,sy],[sx+w*(.017+t*.052),sy+h*(.005+t*.02)]]);
      }
      c.globalAlpha = 1;
    }
  }

  bottle(x, y, size, angle) {
    const c = this.ctx;
    c.save(); c.translate(x,y); c.rotate(angle); c.scale(size,size);
    this.poly('#417f63', [[-.31,.53],[-.32,-.06],[-.14,-.28],[-.13,-.65],[.13,-.65],[.14,-.28],[.32,-.06],[.31,.53],[.19,.59],[-.20,.59]], '#bbdf9d', .043);
    this.poly('#e7b776', [[-.30,.02],[.30,.02],[.30,.32],[-.30,.32]]);
    this.line('#253e3a',.07,[[-.14,.17],[.14,.17]]);
    this.line('#c2f2bb',.06,[[-.22,-.03],[-.09,-.25],[-.08,-.51]]);
    this.poly('#e3bf7d', [[-.15,-.69],[.15,-.69],[.15,-.59],[-.15,-.59]]);
    c.restore();
  }

  sight(view) {
    if (!view.holding) return;
    const c = this.ctx;
    const [x,y] = this.project(view.aim.x,view.aim.y,AIM_DEPTH,view);
    const colour = view.contact?.hit ? '#c6ffad' : '#fff0cb';
    const radius = view.contact?.hit ? 13 : 17;
    c.save(); c.shadowColor = '#141920'; c.shadowBlur = 5;
    for (const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      this.line(colour,2,[[x+dx*(radius-6),y+dy*radius],[x+dx*radius,y+dy*radius],[x+dx*radius,y+dy*(radius-6)]]);
    }
    this.oval(x,y,2.4,2.4,colour);
    const target = view.guide;
    if (target) {
      const [gx,gy] = this.project(target.x,target.y,AIM_DEPTH,view);
      const d = Math.max(5,Math.min(11,this.focal/AIM_DEPTH*signs[target.kind].h*.20));
      if (!view.reduced && view.contact.t > 1) {
        c.strokeStyle = '#ffe0a18f'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(gx,gy,15+clamp(view.contact.t-1,0,4)*6,0,TAU); c.stroke();
      }
      if (Math.hypot(gx-x,gy-y) > 4) this.poly(null,[[gx,gy-d],[gx+d,gy],[gx,gy+d],[gx-d,gy]], '#ffbc76',1.4);
      this.text('+'+signs[target.kind].points,gx,gy-27,11,colour);
    }
    c.restore();
  }

  effects(view) {
    const c = this.ctx;
    for (const shot of view.shots) {
      if (shot.age > 1) continue;
      const t = clamp(shot.age,0,1);
      const [tx,ty] = this.project(shot.aim.x,shot.aim.y,shot.depth,view);
      const origin = shot.origin ?? this.launchOrigin(shot.aim,view.lean,view.reduced);
      const sx = origin.x * this.w, sy = origin.y * this.h;
      const arc = view.reduced ? .027 : .09;
      const flight = (q) => [mix(sx,tx,q),mix(sy,ty,q)-Math.sin(q*Math.PI)*this.h*arc];
      if (!view.reduced) {
        for(let j=4;j>0;j--) {
          const q = Math.max(0,t-j*.055), [x,y] = flight(q);
          this.oval(x,y,7-j,7-j,'#b9ffae40');
        }
      }
      const [x,y] = flight(t);
      const size = origin.size * Math.min(this.w,this.h);
      this.bottle(x,y,mix(size,7,t),origin.angle + (view.reduced ? 0 : t*8));
    }

    for (const burst of view.bursts) {
      const t = clamp(burst.age/.78,0,1);
      const [x,y] = this.project(burst.x,burst.y,Math.max(9,burst.z-view.dist),view);
      const px = clamp(x,50,this.w-62), py = clamp(y,145,this.h*.73);
      c.save(); c.globalAlpha = 1 - t*t;
      if (!view.reduced) {
        const radius = 9+t*92;
        c.strokeStyle = '#ffdd9c'; c.lineWidth = Math.max(1,3-t*3);
        c.beginPath(); c.arc(x,y,radius,0,TAU); c.stroke();
        for(let j=0;j<28;j++) {
          const angle = j*TAU/28 + noise(j+7)*.38;
          const d = (20+noise(j+4)*104)*t;
          const dx = Math.cos(angle)*d, dy = Math.sin(angle)*d+t*t*44;
          const s = (2+noise(j+20)*6)*(1-t*.58);
          this.poly(['#ecffd8','#b6f4b4','#ffcd7d','#f6f1e2'][j%4],[[x+dx,y+dy],[x+dx+s,y+dy+s*.7],[x+dx-s*.42,y+dy+s*1.4]]);
        }
      }
      c.shadowColor='#23202a'; c.shadowBlur=7;
      this.text('+'+burst.points,px,py-20-t*24,view.reduced ? 24 : 26+t*6,'#fff1b3');
      c.restore();
    }
  }

  render(view) {
    const c = this.ctx;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.sky(view);
    this.road(view);
    this.scenery(view);
    this.cabin(view);
    this.windowSill(view);
    this.hand(view);
    this.effects(view);
    this.sight(view);
  }
}
