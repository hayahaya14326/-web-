/* INFINITY FORGE V11 — deterministic crafting, layout, staged automation.
   Loaded after expansion and before app; no third-party libraries. */
(function(root){'use strict';
 const Previous=root.ForgeEngine,H=root.Huge,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const stages=[
  {name:'手動点火',need:0,desc:'最初はコアを自分で操作する'},
  {name:'創造盤の設計',need:8,desc:'8回タップすると工房が開く'},
  {name:'自動点火',need:25,desc:'コアを使い、抽出器を設置すると点火を自動化できる'},
  {name:'設備の自動調達',need:65,desc:'設備を3回手で購入して、購入作業を自動化する'},
  {name:'素材の自動精製',need:110,desc:'素材を3回手で合成して、合成を自動化する'},
  {name:'創造盤の自動整備',need:190,desc:'装置を5回手で配置して、盤面の整備を自動化する'},
  {name:'再誕の自動実行',need:300,desc:'再誕を1回自分で実行した後、自動化できる'},
 ];
 const types={empty:{name:'空き',icon:'＋',cost:0,matter:0},collector:{name:'抽出器',icon:'◈',cost:18,matter:0},amplifier:{name:'増幅器',icon:'⌁',cost:100,matter:2},cooler:{name:'冷却器',icon:'❄',cost:80,matter:0},synth:{name:'精製器',icon:'◇',cost:600,matter:4}};
 const recipes=[{id:'particle',name:'粒子片',energy:30,particle:0,crystal:0,unlock:1,summary:'エネルギーを物質へ変換'},{id:'crystal',name:'凝縮結晶',energy:120,particle:3,crystal:0,unlock:2,summary:'粒子片から高密度結晶を作成'},{id:'star',name:'恒星核',energy:1800,particle:0,crystal:3,unlock:4,summary:'恒星の種となる物質を合成'}];
 const directions=i=>[i%3>0?i-1:-1,i%3<2?i+1:-1,i>2?i-3:-1,i<6?i+3:-1].filter(x=>x>=0);
 function initial(){return {operations:0,stage:0,board:['empty','empty','empty','empty','core','empty','empty','empty','empty'],selected:'collector',particles:0,crystals:0,stars:0,earnedParticles:0,earnedCrystals:0,earnedStars:0,tapCarry:0,synthCarry:0,autoBuyCarry:0,autoCraftCarry:0,autoLayoutCarry:0,autoPrestigeCarry:0,autoTapOn:true,autoBuyOn:false,autoCraftOn:false,autoLayoutOn:false,autoPrestigeOn:false,autoPrestigeTarget:1,procurementMode:'balanced',blueprints:[null,null,null],activeBlueprint:0,v15AutomationReviewed:true,manualCrafts:0,manualCraftedV16:0,manualTaps:0,manualPurchases:0,manualPlacements:0,manualPrestiges:0,learningRules:2}}
 function sanitize(raw){let w={...initial(),...(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{})};w.board=Array.isArray(w.board)&&w.board.length===9?w.board.map((x,i)=>i===4?'core':(types[x]&&x!=='core'?x:'empty')):initial().board;for(let key of ['operations','particles','crystals','stars','earnedParticles','earnedCrystals','earnedStars','tapCarry','synthCarry','autoBuyCarry','autoCraftCarry','autoLayoutCarry','autoPrestigeCarry','manualCrafts','manualCraftedV16','manualTaps','manualPurchases','manualPlacements','manualPrestiges'])w[key]=clamp(Number(w[key])||0,0,1e12);for(let key of ['autoTapOn','autoBuyOn','autoCraftOn','autoLayoutOn','autoPrestigeOn'])w[key]=w[key]===true;
  // One-time migration: legacy saves may silently auto-buy/craft/layout even with no player confirmation.
  if(raw&&typeof raw==='object'&&!raw.v15AutomationReviewed){w.autoBuyOn=false;w.autoCraftOn=false;w.autoLayoutOn=false;w.autoPrestigeOn=false;}
  w.v15AutomationReviewed=true;w.learningRules=2;w.procurementMode=['balanced','construction','cheap'].includes(w.procurementMode)?w.procurementMode:'balanced';w.stage=clamp(Math.floor(w.stage||0),0,6);w.autoPrestigeTarget=clamp(Math.floor(Number(w.autoPrestigeTarget)||1),1,15);
  // Blueprint is player-authored. Saved plans contain no executable data and survive prestige.
  const sanitizePlan=p=>Array.isArray(p)&&p.length===9?p.map((v,i)=>i===4?'core':(types[v]&&v!=='core'?v:'empty')):null;
  w.blueprints=Array.isArray(w.blueprints)?[0,1,2].map(i=>sanitizePlan(w.blueprints[i])):[null,null,null];
  w.activeBlueprint=clamp(Math.floor(Number(w.activeBlueprint)||0),0,2);
  // Older V17 players keep their carefully built board as Blueprint A.
  if(raw&&!Array.isArray(raw.blueprints)&&w.stage>=5&&w.board.some((v,i)=>i!==4&&v!=='empty'))w.blueprints[0]=w.board.slice();
  if(!w.blueprints[w.activeBlueprint])w.autoLayoutOn=false;if(!types[w.selected]||w.selected==='empty')w.selected='collector';return w}
 class ForgeWorkshop extends Previous{
  constructor(data,saved){super(data,saved);const existed=!!this.state.workshop;this.state.workshop=sanitize(this.state.workshop);if(!existed)this.state.workshop.operations=Math.min(1500,this.state.taps||0);if(saved&&saved.workshop&&!Number.isFinite(Number(saved.workshop.manualTaps)))this.state.workshop.manualTaps=Math.max(0,this.state.taps||0);this.refreshStage();}
  get workshop(){return this.state.workshop}
  trainingRequirement(stage){const w=this.workshop;const tasks={1:{label:'手動タップ',key:'manualTaps',need:8},2:{label:'装置を自分で配置',key:'manualPlacements',need:1},3:{label:'設備を手動購入',key:'manualPurchases',need:3},4:{label:'素材を手動合成',key:'manualCraftedV16',need:3},5:{label:'装置を自分で配置',key:'manualPlacements',need:5},6:{label:'再誕を手動実行',key:'manualPrestiges',need:1}};const t=tasks[stage];if(!t)return null;return {...t,done:Math.min(t.need,w[t.key]||0),ready:(w[t.key]||0)>=t.need};}
  refreshStage(){let w=this.workshop,old=w.stage;
   while(w.stage+1<stages.length){const next=w.stage+1,task=this.trainingRequirement(next);
    if(w.operations<stages[next].need||!task?.ready)break;
    w.stage=next;if(next===2)w.autoTapOn=true;
   }
   return w.stage>old;
  }
  manualProgress(kind,points=0){let w=this.workshop;const map={tap:'manualTaps',purchase:'manualPurchases',place:'manualPlacements',craft:'manualCraftedV16',prestige:'manualPrestiges'};const key=map[kind];if(!key)return false;
   w[key]=clamp((w[key]||0)+1,0,1e12);w.operations=clamp(w.operations+points,0,1e12);return this.refreshStage();}
  manualTap(){this.tap();this.manualProgress('tap',1)}
  manualBuy(id,quantity=1){const bought=this.buyFacility(id,quantity);if(bought)this.manualProgress('purchase',8);return bought;}
  manualPlace(i,type){const ok=this.place(i,type);if(ok&&type!=='empty')this.manualProgress('place',12);return ok;}
  manualCraft(id){const ok=this.craft(id);if(ok)this.manualProgress('craft',15);return ok;}
  manualPrestige(tier){const ok=this.prestige(tier);if(ok)this.manualProgress('prestige',80);return ok;}
  // Pure evaluator also powers blueprint comparisons. No currency or save mutation.
  evaluateBoard(board){let counts={collector:0,amplifier:0,cooler:0,synth:0},raw=0;
   for(let i=0;i<9;i++){const type=board[i];if(counts[type]!==undefined)counts[type]++;if(type==='collector')raw+=1.5*(1+0.7*directions(i).filter(n=>board[n]==='amplifier').length)}
   const heat=Math.max(0,counts.collector*20+counts.amplifier*12+counts.synth*18-counts.cooler*32);
   const eff=heat>110?.35:heat>75?.65:1;return {counts,heat,eff,output:raw*eff};
  }
  boardStats(){return this.evaluateBoard(this.workshop.board)}
  blueprintStats(slot=this.workshop.activeBlueprint){const plan=this.workshop.blueprints[slot];return plan?this.evaluateBoard(plan):null}
  blueprintEnergyReserve(){const w=this.workshop,plan=w.blueprints[w.activeBlueprint];if(!plan||!w.autoLayoutOn)return H.zero();
   let sum=H.zero(),neededParticles=0;for(let i=0;i<9;i++)if(i!==4&&w.board[i]==='empty'&&plan[i]!=='empty'){
    const cost=this.pieceCost(plan[i]);if(cost){sum=sum.add(cost.E);neededParticles+=cost.particles;}
   }
   // Reserve the price of material synthesis too; otherwise the next purchase can delay rebuilding.
   return sum.add(H.from(Math.max(0,neededParticles-w.particles)*30));
  }
  changeProcurement(mode){if(this.workshop.stage<3||!['balanced','construction','cheap'].includes(mode))return false;this.workshop.procurementMode=mode;return true}
  blueprintInfo(slot=this.workshop.activeBlueprint){const w=this.workshop;slot=Number(slot);const plan=w.blueprints[slot];if(!plan)return {saved:false,match:0,total:0,blocked:0,slot};let total=0,match=0,blocked=0;for(let i=0;i<9;i++){if(i===4||plan[i]==='empty')continue;total++;if(plan[i]===w.board[i])match++;else if(w.board[i]!=='empty')blocked++;}return {saved:true,match,total,blocked,slot};}
  // Read-only diagnosis used by the player's guide. Never spend or mutate resources.
  blueprintDiagnostics(slot=this.workshop.activeBlueprint){
   const w=this.workshop, plan=w.blueprints[slot], info=this.blueprintInfo(slot);
   if(!plan)return {...info, status:'no-plan', explanation:'設計図がありません。工房の盤面を手で組み立て、保存してください。', next:null, reserve:H.zero(), remainingParticles:0};
   if(info.blocked)return {...info,status:'blocked',explanation:`${info.blocked}マスに設計図と異なる装置があります。工房で該当マスを撤去してください。撤去した装置の資源は戻りません。`, next:null,reserve:this.blueprintEnergyReserve(),remainingParticles:0};
   const priority={collector:0,cooler:1,synth:2,amplifier:3};
   const missing=plan.map((type,i)=>({type,i})).filter(x=>x.i!==4&&x.type!=='empty'&&w.board[x.i]==='empty').sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
   if(!missing.length)return {...info,status:'complete',explanation:'登録した装置はすべて配置されています。自動配置は待機し、再誕後も同じ設計図を使用します。',next:null,reserve:H.zero(),remainingParticles:0};
   const next=missing[0],cost=this.pieceCost(next.type),remainingParticles=Math.max(0,cost.particles-w.particles);
   const reserve=this.blueprintEnergyReserve();
   if(!w.autoLayoutOn)return {...info,status:'off',explanation:'設計図は保存されていますが、自動配置がオフです。「自動化」タブから装置配置をオンにしてください。',next,cost,reserve,remainingParticles};
   if(!this.amount('E').gte(cost.E))return {...info,status:'energy',explanation:`次の${types[next.type].name}を置くためのエネルギーが不足しています。貯まると自動で続行します。`,next,cost,reserve,remainingParticles};
   if(remainingParticles>0)return {...info,status:'material',explanation:`次の${types[next.type].name}には粒子片があと${remainingParticles}個必要です。工房で合成するか、自動合成を有効にしてください。`,next,cost,reserve,remainingParticles};
   return {...info,status:'ready',explanation:`${types[next.type].name}の配置準備ができています。次の自動配置判定（およそ9秒ごと）で配置します。`,next,cost,reserve,remainingParticles};
  }
  recordBlueprint(slot=this.workshop.activeBlueprint){const w=this.workshop;slot=Number(slot);if(w.stage<5||!Number.isInteger(slot)||slot<0||slot>2||!w.board.some((v,i)=>i!==4&&v!=='empty'))return false;w.blueprints[slot]=w.board.slice();w.activeBlueprint=slot;return true;}
  selectBlueprint(slot){const w=this.workshop;slot=Number(slot);if(w.stage<5||!Number.isInteger(slot)||slot<0||slot>2)return false;w.activeBlueprint=slot;if(!w.blueprints[slot])w.autoLayoutOn=false;return true;}
  clearBlueprint(slot=this.workshop.activeBlueprint){const w=this.workshop;slot=Number(slot);if(w.stage<5||!Number.isInteger(slot)||slot<0||slot>2||!w.blueprints[slot])return false;w.blueprints[slot]=null;if(w.activeBlueprint===slot)w.autoLayoutOn=false;return true;}
  workshopBonus(){/* Materials are inventory, not an invisible timer-driven power multiplier. Production improves through actual equipment, placement, research and celestial upgrades. */ return 1;}
  production(){let standard=super.production(),extra=H.from(this.boardStats().output).mul(this.baseMultiplier()).pow(this.exponent());return standard.add(extra).mul(this.workshopBonus());}
  tapPower(){return super.tapPower()} // No invisible tap bonus from auto-refined crystals.
  pieceCost(type){const item=types[type];if(!item||type==='empty')return null;return {E:H.from(item.cost).mul(Math.pow(1.04,this.state.unlockedTier)),particles:item.matter}}
  place(i,type){let w=this.workshop;i=Number(i);if(!Number.isInteger(i)||i<0||i>8||i===4||!types[type]||type==='core'||w.stage<1)return false;
   if(type==='synth'&&w.stage<4)return false;if(type==='amplifier'&&w.stage<2)return false;
   if(type===w.board[i])return false;if(type==='empty'){w.board[i]='empty';return true}
   // Never charge the player for silently overwriting an existing workshop device.
   if(w.board[i]!=='empty')return false;
   let price=this.pieceCost(type);if(w.particles<price.particles||!this.amount('E').gte(price.E))return false;
   if(!this.pay('E',price.E))return false;w.particles-=price.particles;w.board[i]=type;return true;
  }
  craft(id){const recipe=recipes.find(r=>r.id===id);let w=this.workshop;if(!recipe||w.stage<recipe.unlock||w.particles<recipe.particle||w.crystals<recipe.crystal||!this.amount('E').gte(recipe.energy))return false;
   if(!this.pay('E',recipe.energy))return false;w.particles-=recipe.particle;w.crystals-=recipe.crystal;
   const field={particle:'particles',crystal:'crystals',star:'stars'}[id],earned={particle:'earnedParticles',crystal:'earnedCrystals',star:'earnedStars'}[id];w[field]++;w[earned]++;return true;
  }
  _autoBuyOne(){const w=this.workshop,mode=w.procurementMode;
   // A construction-first run must not spend material/energy already budgeted for the player's saved layout.
   let reserve=mode==='construction'?this.blueprintEnergyReserve():H.zero();
   // 修得済み階層の再建費用を優先するが、待機中も通常設備へ投資できる。
   const rebuild=typeof this.reconstructionInfo==='function'?this.reconstructionInfo():null;
   if(rebuild?.unlocked&&rebuild.auto){const cash=this.amount('E');
     if(rebuild.ready){if(reserve.lt(rebuild.cost))reserve=rebuild.cost;}
     else {reserve=reserve.add(cash.mul(.25));if(reserve.gt(cash.mul(.85)))reserve=cash.mul(.85);}
   }
   const candidates=this.facilities.filter(f=>f.tier===0&&this.canAfford(f)&&this.amount('E').gte(this.facilityCost(f).add(reserve)));
   if(!candidates.length)return false;
   let best=null,score=-Infinity;
   for(const f of candidates){const cost=this.facilityCost(f),out=H.from(f.base_output).mul(this.milestoneBonus(this.owned(f.id)+1));
    const roi=out.log10().toNumber(1e9)-cost.log10().toNumber(1e9);
    // Cheap mode favors low priced machinery; otherwise compare expected yield per currency.
    const s=mode==='cheap'?-cost.log10().toNumber(1e9):roi;
    if(s>score){score=s;best=f}
   }return best?this.buyFacility(best.id,1)>0:false;
  }
  autoBuy(){
   // Legacy research automation must honor the same procurement rules as workshop automation.
   if(!this.state.automation.buy||!this.skill('S01-03-02'))return 0;
   let purchases=0;for(let i=0;i<30;i++){if(!this._autoBuyOne())break;purchases++;}return purchases;
  }
  _autoCraftOne(){let w=this.workshop;if(w.stage<4||!w.autoCraftOn)return false;
   // Keep construction materials aside for missing devices in the active blueprint.
   const plan=w.autoLayoutOn?w.blueprints[w.activeBlueprint]:null;
   const reserved=plan?plan.reduce((sum,t,i)=>sum+(i!==4&&w.board[i]==='empty'?(types[t]?.matter||0):0),0):0;
   if(w.particles<reserved)return this.craft('particle');
   if(w.crystals>=3&&this.amount('E').gte(1800)&&this.craft('star'))return true;
   if(w.particles-reserved>=3&&this.amount('E').gte(120)&&this.craft('crystal'))return true;
   return this.craft('particle');
  }
  _autoLayoutOne(){
   // Repeat the actual plan created by the player, not an arbitrary generic layout.
   const w=this.workshop,plan=w.blueprints[w.activeBlueprint];if(!plan)return false;
   // Priority: energy producers and cooling first; refiners and amplifiers after.
   const priority={collector:0,cooler:1,synth:2,amplifier:3};
   const missing=plan.map((type,i)=>({type,i})).filter(x=>x.i!==4&&x.type!=='empty'&&w.board[x.i]==='empty').sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
   for(const x of missing){if(this.place(x.i,x.type))return true;}
   return false;
  }
  tick(dt,opts={}){super.tick(dt,opts);if(!Number.isFinite(dt)||dt<=0)return;dt=clamp(dt,0,86400);let w=this.workshop;this.refreshStage();
    if(w.stage>=2&&w.autoTapOn){let speed=w.stage>=5?3:w.stage>=4?2:w.stage>=3?1.2:.6;w.tapCarry+=speed*dt;let num=Math.floor(w.tapCarry);if(num>0){num=Math.min(250000,num);w.tapCarry-=num;this.credit('E',this.tapPower().mul(num));/* automatic clicks give energy, not manual practice */}}
    this.refreshStage();
    const bs=this.boardStats();if(bs.counts.synth>0){w.synthCarry+=Math.min(86400,dt)*0.12*bs.counts.synth*bs.eff;const converted=Math.min(100000,Math.floor(w.synthCarry));if(converted>0){w.synthCarry-=converted;w.particles=clamp(w.particles+converted,0,1e12);w.earnedParticles=clamp(w.earnedParticles+converted,0,1e12)}}
    if(opts.auto===false)return;
    if(w.stage>=3&&w.autoBuyOn){w.autoBuyCarry+=dt;let period=w.stage>=5?.8:4;let runs=Math.min(15,Math.floor(w.autoBuyCarry/period));w.autoBuyCarry%=period;for(let j=0;j<runs;j++)this._autoBuyOne()}
    if(w.stage>=4&&w.autoCraftOn){w.autoCraftCarry+=dt;let runs=Math.min(8,Math.floor(w.autoCraftCarry/6));w.autoCraftCarry%=6;for(let j=0;j<runs;j++)this._autoCraftOne()}
    if(w.stage>=5&&w.autoLayoutOn&&w.blueprints[w.activeBlueprint]){w.autoLayoutCarry+=dt;let runs=Math.min(3,Math.floor(w.autoLayoutCarry/9));w.autoLayoutCarry%=9;for(let j=0;j<runs;j++)this._autoLayoutOne()}
    if(w.stage>=6&&w.autoPrestigeOn&&this.state.unlockedTier===w.autoPrestigeTarget-1){w.autoPrestigeCarry+=dt;if(w.autoPrestigeCarry>=15){w.autoPrestigeCarry%=15;const p=this.previewPrestige(w.autoPrestigeTarget);if(p.ready&&p.reward.gte(10))this.prestige(w.autoPrestigeTarget)}}
  }
  playMini(){return false} // V11 replaces mini-game rewards with real workshop production.
  prestige(tier){const result=super.prestige(tier);if(result){let w=this.workshop;w.board=initial().board;w.particles=0;w.crystals=0;w.stars=0;w.autoBuyCarry=0;w.autoCraftCarry=0;w.autoLayoutCarry=0;w.synthCarry=0;}return result}
  automationList(){let w=this.workshop;return stages.map((s,i)=>({...s,index:i,unlocked:w.stage>=i,task:this.trainingRequirement(i),progress:!s.need?100:Math.min(100,Math.floor(w.operations/s.need*100)||0)}))}
 }
 root.ForgeWorkshop=ForgeWorkshop;root.ForgeEngine=ForgeWorkshop;root.ForgeWorkshopData={stages,types,recipes};
})(typeof globalThis!=='undefined'?globalThis:this);
