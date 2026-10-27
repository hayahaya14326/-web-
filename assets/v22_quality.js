/* ひとつぶ V22 — economy fairness, deliberate automation and craft milestones.
   This layer adds no global production multiplier and does not change prestige thresholds. */
(function(root){'use strict';
 const Base=root.ForgeEngine,H=root.Huge;
 if(!Base)throw Error('先にゲームエンジンを読み込んでください');
 const types=root.ForgeWorkshopData.types;
 const MASTERY=[
  {id:'hands-8',name:'最初の試行',desc:'自分の手で粒を8回押す',kind:'手動',goal:8,get:e=>e.workshop.manualTaps||0,where:'core'},
  {id:'buy-3',name:'機械を選ぶ',desc:'設備を手動で3回購入する',kind:'設備',goal:3,get:e=>e.workshop.manualPurchases||0,where:'equipment'},
  {id:'place-3',name:'最初の設計',desc:'工房に装置を3回手動配置する',kind:'工房',goal:3,get:e=>e.workshop.manualPlacements||0,where:'workshop'},
  {id:'craft-3',name:'素材を理解する',desc:'素材を3回手動で合成する',kind:'合成',goal:3,get:e=>e.workshop.manualCraftedV16||0,where:'workshop'},
  {id:'first-plan',name:'設計を残す',desc:'工房の配置を1件保存する',kind:'設計図',goal:1,get:e=>e.workshop.blueprints.filter(Boolean).length,where:'workshop'},
  {id:'rebuild-plan',name:'自分の工房を再現',desc:'自動配置で設計図の装置を3台建てる',kind:'自動化',goal:3,get:e=>e.workshop.qualityAutoPlaced||0,where:'workshop'},
  {id:'two-plans',name:'二つの設計を比べる',desc:'工房の設計図を2件保存する',kind:'戦略',goal:2,get:e=>e.workshop.blueprints.filter(Boolean).length,where:'workshop'},
  {id:'first-reset',name:'一度組み直す',desc:'再誕を自分で1回実行する',kind:'転生',goal:1,get:e=>e.workshop.manualPrestiges||0,where:'prestige'},
  {id:'auto-layout',name:'組み立てを任せる',desc:'設計図を登録し、工房の自動配置を稼働させる',kind:'自動化',goal:1,get:e=>Number(e.workshop.stage>=5&&e.workshop.autoLayoutOn&&e.blueprintInfo().saved),where:'automation'},
  {id:'star-variety',name:'二種類の恒星',desc:'異なる恒星を2種類手作業で作る',kind:'天体',goal:2,get:e=>e.cosmos.learned.star.length,where:'celestial'},
  {id:'planet-variety',name:'二種類の惑星',desc:'異なる惑星を2種類手作業で作る',kind:'天体',goal:2,get:e=>e.cosmos.learned.planet.length,where:'celestial'},
  {id:'new-universe',name:'新しい世界',desc:'並行宇宙を一つ作る',kind:'宇宙',goal:1,get:e=>e.cosmos.universes.length,where:'celestial'}
 ];
 const proto=Base.prototype;
 function saved(e){let w=e.workshop;if(!Array.isArray(w.masteryRecords))w.masteryRecords=[];w.masteryRecords=[...new Set(w.masteryRecords.filter(id=>MASTERY.some(m=>m.id===id)))];return w.masteryRecords}
 proto.qualityMilestones=function(){const owned=new Set(saved(this));return MASTERY.map(m=>{let value=Math.max(0,Number(m.get(this))||0);return {...m,value:Math.min(value,m.goal),done:owned.has(m.id),available:m.where==='celestial'?this.cosmosAvailable():m.where==='prestige'?this.state.unlockedTier>=1:m.where==='workshop'?this.workshop.stage>=1:true}})};
 proto.updateQualityMilestones=function(){const existing=saved(this),known=new Set(existing),newly=[];for(const m of MASTERY){if(!known.has(m.id)&&Number(m.get(this))>=m.goal){existing.push(m.id);known.add(m.id);newly.push(m.id)}}return newly};
 const oldTick=proto.tick;
 proto.tick=function(dt,opts){const out=oldTick.call(this,dt,opts);this.updateQualityMilestones();return out};
 // Construction priority: reserve the immediate next device, not the entire future layout.
 // Until it can be afforded, hold 75% of available energy, allowing cheaper producers to grow.
 proto.blueprintEnergyReserve=function(){
  const w=this.workshop;if(w.stage<5||!w.autoLayoutOn)return H.zero();const plan=w.blueprints[w.activeBlueprint];if(!plan)return H.zero();
  const priority={collector:0,cooler:1,synth:2,amplifier:3};const missing=plan.map((type,i)=>({type,i})).filter(x=>x.i!==4&&x.type!=='empty'&&w.board[x.i]==='empty').sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
  if(!missing.length)return H.zero();
  if(plan.some((type,i)=>i!==4&&type!=='empty'&&w.board[i]!=='empty'&&w.board[i]!==type))return H.zero();
  const next=missing[0];const price=this.pieceCost(next.type);if(!price)return H.zero();
  const total=price.E.add(H.from(Math.max(0,price.particles-w.particles)*30));const cash=this.amount('E');
  return cash.gte(total)?total:cash.mul(.75);
 };
 // Prevent two independent auto-purchase systems from both running when the workshop is managing purchases.
 const previousAutoLayout=proto._autoLayoutOne;
 proto._autoLayoutOne=function(){const ok=previousAutoLayout.call(this);if(ok){this.workshop.qualityAutoPlaced=Math.min(1e6,(Number(this.workshop.qualityAutoPlaced)||0)+1);this.updateQualityMilestones()}return ok};
 const previousAutoBuy=proto.autoBuy;
 proto.autoBuy=function(){if(this.workshop.stage>=3)return 0;return previousAutoBuy.call(this)};
 proto.qualityPurchaseStatus=function(){const w=this.workshop;
  if(w.stage<3)return {title:'まだ手動の段階',detail:'設備を3回自分で購入すると、条件を満たして解放できます。'};
  if(!w.autoBuyOn)return {title:'停止中',detail:'「設備購入」をオンにすると、選んだ方針に従って購入します。'};
  const reserve=w.procurementMode==='construction'?this.blueprintEnergyReserve():H.zero();
  const available=this.facilities.filter(f=>f.tier===0&&this.isUnlocked(f));
  const affordable=available.filter(f=>this.canAfford(f)&&this.amount('E').gte(this.facilityCost(f).add(reserve)));
  if(affordable.length)return {title:'次の購入を準備中',detail:`現在の方針に合う購入可能な設備が${affordable.length}種類あります。一定間隔で購入します。`};
  if(!available.length)return {title:'設備の解放待ち',detail:'設備を使えるようにするための目標を進めてください。'};
  if(w.procurementMode==='construction'&&!reserve.isZero())return {title:'設計図の資源を確保中',detail:'次の装置のために一部のエネルギーを確保しています。残りの範囲で設備を購入します。'};
  return {title:'エネルギー待ち',detail:'購入できる設備がありません。資源が増えると自動で再開します。'};
 };
 root.HitotsubuQuality={MASTERY};
})(window);
