import type { Game } from './game.ts';
import type { Bullet, Enemy, Vec } from './types.ts';
import { BOUNDS } from './types.ts';
import { TUNING as T } from './tuning.ts';
import { clamp, distance, normal, overlaps, move, lineClear } from './physics.ts';

export function hitEnemy(g:Game,e:Enemy,damage:number,from:Vec,secondary=false){
  if(e.hp<=0||e.spawnTime>0)return;
  const actual=Math.min(e.hp,damage);e.hp-=damage;e.flash=T.hit.flash;
  e.stagger=Math.max(e.stagger,e.kind==='boss'?0:T.hit.stagger);
  const knock=normal(e.x-from.x,e.y-from.y),force=e.kind==='boss'?T.hit.bossKnockback:T.hit.knockback;
  move(e,knock.x*force,knock.y*force,g.room.obstacles);
  g.emit('hit',e.x,e.y);
  if(g.player.stats.leech>0){g.player.leechCharge+=actual;const threshold=T.hit.leechThreshold/(1+(g.player.stats.leech-1)*.4);while(g.player.leechCharge>=threshold){g.player.leechCharge-=threshold;g.player.hp=Math.min(g.player.stats.maxHp,g.player.hp+1);g.emit('heal',g.player.x,g.player.y);}}
  if(e.hp<=0){g.kills++;g.emit('kill',e.x,e.y,e.kind==='boss'?3:e.elite?2:1);if(g.player.items.fang&&g.player.items.cinder)g.player.dashCooldown=Math.max(0,g.player.dashCooldown-.35);}
  if(!secondary)g.dirty=true;
}

function split(g:Game,b:Bullet){
  if(!b.split||b.splitDone||b.generation>=T.proc.fragmentGenerations||b.family.fragments<=0)return;
  b.splitDone=true;
  const count=Math.min(T.proc.maxSplitChildren,T.proc.splitChildren+b.split-1,b.family.fragments);
  const angle=Math.atan2(b.vy,b.vx),speed=T.tear.speed*.88;
  for(let i=0;i<count;i++){
    const a=angle+(i-(count-1)/2)*.48,dx=Math.cos(a),dy=Math.sin(a);
    const child:Bullet={...b,id:g.nextId++,x:clamp(b.x+dx*7,BOUNDS.left+8,BOUNDS.right-8),y:clamp(b.y+dy*7,BOUNDS.top+8,BOUNDS.bottom-8),vx:dx*speed,vy:dy*speed,r:Math.max(4,b.r*.78),damage:b.damage*T.proc.fragmentDamage,life:Math.min(1.05,b.life+.35),generation:b.generation+1,split:0,splitDone:true,chainDone:false,hit:[...b.hit],bounce:g.player.items.mirror?1:0,pierce:Math.min(2,b.pierce)};
    if(g.addBullet(child)){b.family.fragments--;g.metrics.splits++;}
  }
  g.emit('split',b.x,b.y);
}

function chain(g:Game,b:Bullet,first:Enemy){
  if(!b.chain||b.chainDone||b.family.chains<=0)return;
  b.chainDone=true;const visited=new Set([...b.hit,first.id]);let origin:Vec=first;
  const count=Math.min(T.proc.maxChainJumps,b.chain+1+(g.player.items.clock?2:0),b.family.chains);
  for(let i=0;i<count;i++){
    let target:Enemy|undefined,nearest=T.proc.chainRange;
    for(const e of g.enemies){if(e.hp<=0||e.spawnTime>0||visited.has(e.id))continue;const d=distance(e,origin);if(d<nearest&&lineClear(origin,e,g.room.obstacles)){target=e;nearest=d;}}
    if(!target)break;
    visited.add(target.id);b.family.chains--;g.metrics.chainHits++;
    g.effect('chain',origin,target);g.emit('chain',target.x,target.y);
    hitEnemy(g,target,b.damage*(g.player.items.clock?.85:T.proc.chainDamage),origin,true);
    origin=target;
  }
}
function impact(g:Game,b:Bullet,e:Enemy){
  const frozen=e.slow>0;
  b.hit.push(e.id);hitEnemy(g,e,b.damage,b);if(b.frost)e.slow=1+b.frost*.7;
  if((b.blast>0||frozen&&g.player.items.needle&&g.player.items.frost)&&b.family.blasts>0){
    b.family.blasts--;const frost=b.blast===0,radius=frost?86:T.proc.blastRadius+Math.min(4,b.blast)*9;
    g.metrics.explosions++;g.effect(frost?'frost':'blast',e,e,radius);g.emit(frost?'frost':'blast',e.x,e.y,radius);
    for(const other of g.enemies)if(other.id!==e.id&&other.hp>0&&distance(e,other)<radius&&lineClear(e,other,g.room.obstacles)){
      hitEnemy(g,other,b.damage*(frost?.6:T.proc.blastDamage),e,true);if(frost)other.slow=2;
    }
  }
  chain(g,b,e);split(g,b);
}

export function updateBullets(g:Game,dt:number){
  // Only bullets present at tick start are advanced; fragments never recursively
  // execute in their parent's iteration. Shared family budgets survive bounces.
  const count=g.bullets.length;
  for(let index=0;index<count;index++){
    // A hostile bullet landing here can kill the player, and death empties this
    // array mid-loop. Without this guard the next index reads past the end.
    const b=g.bullets[index];if(!b)break;
    b.life-=dt;if(b.life<=0)continue;
    if(b.friendly&&b.homing){
      let target:Enemy|undefined,best=300;
      for(const e of g.enemies){if(e.hp<=0||e.spawnTime>0||b.hit.includes(e.id))continue;const d=distance(e,b);if(d<best){target=e;best=d;}}
      if(target){const speed=Math.hypot(b.vx,b.vy),n=normal(target.x-b.x,target.y-b.y),blend=Math.min(.18,dt*1.8*b.homing);const v=normal(b.vx/speed*(1-blend)+n.x*blend,b.vy/speed*(1-blend)+n.y*blend);b.vx=v.x*speed;b.vy=v.y*speed;}
    }
    const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/5));
    for(let i=0;i<steps&&b.life>0;i++){
      const ox=b.x,oy=b.y;b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;
      const o=g.room.obstacles.find(o=>overlaps(b,b.r,o));
      const wallX=b.x<BOUNDS.left+b.r||b.x>BOUNDS.right-b.r,wallY=b.y<BOUNDS.top+b.r||b.y>BOUNDS.bottom-b.r;
      if(wallX||wallY||o){
        if(b.bounce>0){b.bounce--;b.x=ox;b.y=oy;if(wallX)b.vx*=-1;if(wallY)b.vy*=-1;if(o){if(ox<o.x||ox>o.x+o.w)b.vx*=-1;else b.vy*=-1;}if(g.player.items.prism&&g.player.items.mirror)b.damage*=1.15;g.emit('bounce',b.x,b.y);if(b.split&&g.player.items.mirror)split(g,b);}
        else{b.life=0;g.emit('spark',b.x,b.y);}continue;
      }
      if(b.friendly){
        for(const e of g.enemies)if(e.hp>0&&e.spawnTime<=0&&!b.hit.includes(e.id)&&distance(b,e)<b.r+e.r){impact(g,b,e);if(b.pierce>0)b.pierce--;else b.life=0;break;}
      }else if(distance(b,g.player)<b.r+g.player.hurtRadius){g.hurtPlayer(1,b);b.life=0;}
    }
  }
  g.bullets=g.bullets.filter(b=>b.life>0);g.enemies=g.enemies.filter(e=>e.hp>0);
}
