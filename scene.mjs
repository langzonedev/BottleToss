import { AIM_DEPTH, clamp, mix, signs } from './engine.mjs';

const TAU = Math.PI * 2;
const noise = (n) => { const v = Math.sin(n * 127.13 + 81.17) * 43758.5453; return v - Math.floor(v); };

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.backdrop = document.createElement('canvas');
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
    this.cacheBackdrop();
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

  cacheBackdrop() {
    const foreground = this.ctx;
    this.backdrop.width = Math.round(this.w);
    this.backdrop.height = Math.round(this.h);
    this.ctx = this.backdrop.getContext('2d');
    const c = this.ctx, w = this.w, h = this.h, horizon = this.horizon;
    c.fillStyle = this.gradient(0, 0, 0, h, [[0, '#202638'], [.22, '#67435c'], [.40, '#d37162'], [.54, '#fac48a'], [.75, '#bd7259'], [1, '#5a3533']]);
    c.fillRect(0, 0, w, h);

    const sx = w * .70, sy = horizon - h * .083, r = Math.min(w * .065, h * .056);
    const halo = c.createRadialGradient(sx, sy, r * .1, sx, sy, r * 5);
    halo.addColorStop(0, '#ffdc91a3');
    halo.addColorStop(.32, '#ffad6970');
    halo.addColorStop(1, '#ff956800');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, horizon + h * .1);
    this.oval(sx, sy, r, r, '#ffe2a4');

    for (let i = 0; i < 22; i++) {
      const x = noise(i + 71) * w, y = h * (.10 + noise(i + 111) * .34);
      const span = (.04 + noise(i + 31) * .16) * w;
      this.poly(i % 3 ? '#f2a58b24' : '#662b512b', [[x - span, y], [x - span * .45, y - h * .006], [x + span * .66, y - h * .001], [x + span, y + h * .003], [x - span * .22, y + h * .007]]);
    }

    for (let layer = 0; layer < 3; layer++) {
      const points = [[-3, h]];
      for (let i = -1; i <= 30; i++) {
        const wave = .62 + .30 * Math.sin(i * .37 + layer * 3.1) + .21 * Math.sin(i * 1.11 + layer);
        const edge = Math.min(1, Math.abs(i - 14) / 7);
        const y = horizon + h * (layer * .021 - (.025 + .1 * edge) * wave - noise(i + layer * 17) * .014);
        points.push([w * i / 28, y]);
      }
      points.push([w + 5, h]);
      this.poly(['#8d525d','#62444f','#493741'][layer], points);
    }

    c.fillStyle = this.gradient(0, horizon - h * .009, 0, h, [[0, '#815653'], [.18, '#94594a'], [.56, '#66403d'], [1, '#2c252e']]);
    c.fillRect(0, horizon + 1, w, h - horizon);
    for (let i = 0; i < 23; i++) {
      const y = horizon + 3 + (h - horizon) * Math.pow(i / 24, 2);
      this.line(i % 2 ? '#a471532c' : '#442d3627', 1, [[0, y], [w, y]]);
    }
    this.ctx = foreground;
  }

  project(x, y, z, view) {
    const s = this.focal / Math.max(.45, z);
    return [
      this.centre + view.lean * this.w * .040 + (x - view.lean * .30) * s,
      this.horizon + view.bob + (1.64 - y) * s,
    ];
  }

  road(view) {
    const { dist } = view;
    const p = (x, z) => this.project(x, 0, z, view);
    const near = 1.35, far = 310;
    const strip = (x1, x2, z1, z2, fill) => this.poly(fill, [p(x1,z1), p(x2,z1), p(x2,z2), p(x1,z2)]);
    strip(-5.18, 5.18, near, far, '#ac7759');
    strip(-4.16, 4.16, near, far, this.gradient(0, this.horizon, 0, this.h * .91, [[0,'#674f50'], [.12,'#48434a'], [1,'#242731']]));
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
    });
    drawList.sort((a, b) => b.z - a.z);
    drawList.forEach(({z, i, target}) => target ? this.sign(target, z, view) : this.props(i, z, view));
  }

  props(i, z, view) {
    const s = this.focal / z;
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

    if (i % 2 === 0) {
      const [x, y] = this.project(4.72, 0, z, view);
      this.line('#e4c9af', Math.max(1, .10 * s), [[x, y], [x, y - .77 * s]]);
      this.line('#c75242', Math.max(1, .108 * s), [[x, y - .54 * s], [x, y - .68 * s]]);
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
    const shift = view.lean * .040;
    const p = (x,y) => [(x + shift) * w,y*h + view.bob*.65];
    const poly = (colour, points, line, weight) => this.poly(colour, points.map(([x,y]) => p(x,y)), line, weight);
    const line = (colour, weight, points) => this.line(colour, weight, points.map(([x,y]) => p(x,y)));

    poly(this.gradient(0,0,0,h*.22,[[0,'#11141d'],[1,'#30252d']]), [[-.08,-.03],[1.09,-.03],[1.05,.15],[.91,.122],[.73,.082],[.54,.068],[.31,.084],[.14,.125],[-.04,.22]]);
    line('#795457', Math.max(1,h*.003), [[-.03,.204],[.14,.116],[.31,.077],[.54,.061],[.73,.076],[.92,.115],[1.06,.145]]);
    poly('#29252f', [[-.052,.12],[.075,.111],[.205,.49],[.205,.65],[.14,.67],[.083,.48],[-.06,.20]]);
    line('#5e414b', Math.max(1,h*.005), [[.075,.126],[.20,.51],[.205,.60]]);
    poly('#29252e', [[.77,.082],[.813,.082],[.755,.425],[.735,.629],[.696,.65],[.716,.463]]);
    line('#875755', Math.max(1,h*.003), [[.777,.105],[.722,.48],[.703,.622]]);
    poly('#1a1c25', [[.493,.07],[.517,.07],[.514,.108],[.57,.111],[.57,.146],[.542,.158],[.433,.156],[.409,.144],[.416,.115],[.49,.108]]);
    poly('#736164', [[.424,.121],[.552,.117],[.561,.124],[.557,.143],[.434,.148],[.42,.141]]);
    poly('#b48075', [[.426,.136],[.488,.128],[.554,.129],[.553,.139],[.434,.144]]);

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
      this.bottle((.482+shift)*w,.817*h,Math.min(w*.046,h*.046),-.4);
      if (view.ammo > 1) this.bottle((.522+shift)*w,.812*h,Math.min(w*.044,h*.044),.26);
      if (view.ammo > 2) this.bottle((.55+shift)*w,.829*h,Math.min(w*.040,h*.040),.56);
    }
  }

  hand(view) {
    const l = view.lean;
    if (l < .015) return;
    const c = this.ctx, w = this.w, h = this.h;
    const [ax,ay] = this.project(view.aim.x, view.aim.y, AIM_DEPTH, view);
    const x = mix(w*.76, w*.84, l) + (ax-w*.78)*.13;
    const y = mix(h*.86, h*.586, l) + (ay-this.horizon)*.20;
    const u = Math.min(w*.11,h*.108);
    this.poly('#423647', [[w*1.03,h*.94],[w*.925,h*.91],[x-u*.34,y+u*.42],[x+u*.18,y+u*.12],[w*.99,h*.75],[w*1.03,h*.79]], '#69515f', 2);
    this.poly('#bd7e65', [[x-u*.39,y+u*.25],[x-u*.49,y-u*.07],[x-u*.14,y-u*.27],[x+u*.32,y-u*.16],[x+u*.39,y+u*.09],[x+u*.14,y+u*.33]], '#df9e7d', 1.5);
    if (view.holding) this.bottle(x-u*.21,y-u*.20,u*.94,.34 + l*.38);
    this.line('#f2ad87', Math.max(1,u*.05), [[x-u*.22,y+u*.17],[x+u*.17,y+u*.05],[x+u*.31,y-u*.05]]);
    if (!view.reduced && l > .58) {
      c.globalAlpha = l * .42;
      for (let i=0;i<7;i++) {
        const t = (view.dist*.17+i*.173)%1;
        const sx = w * (.78 + .29*t), sy = h * (.22+i*.052);
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
      const [sx,sy] = [this.w*.85,this.h*.57];
      const arc = view.reduced ? .027 : .09;
      const flight = (q) => [mix(sx,tx,q),mix(sy,ty,q)-Math.sin(q*Math.PI)*this.h*arc];
      if (!view.reduced) {
        for(let j=4;j>0;j--) {
          const q = Math.max(0,t-j*.055), [x,y] = flight(q);
          this.oval(x,y,7-j,7-j,'#b9ffae40');
        }
      }
      const [x,y] = flight(t);
      this.bottle(x,y,mix(Math.min(this.w*.095,this.h*.078),7,t),view.reduced ? .5 : t*8+.3);
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
    c.drawImage(this.backdrop,0,0,this.w,this.h);
    this.road(view);
    this.scenery(view);
    this.cabin(view);
    this.hand(view);
    this.effects(view);
    this.sight(view);
  }
}
