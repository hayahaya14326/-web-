/* ひとつぶ V28: ALL tier prestiges reset the live universe to T0.
   Cleared tiers can be reconstructed WITHOUT minting a new prestige reward;
   this preserves climbability of T1..T15 and avoids the T6-only exception. */
(function(root){'use strict';
 const Base=root.ForgeEngine, H=root.Huge;
 if(!Base||!H)throw Error('階層の再構築に必要なデータを読み込めません');
 const Z=()=>H.zero().toJSON();
 const floor=(v,cap=1000000)=>Math.max(0,Math.min(cap,Math.floor(Number(v)||0)));
 // The first 25 clears of each tier retain V28 economics. Extra clears
 // still matter, but contribute diminishing logarithmic value.
 const effectiveClears=n=>Math.min(25,n)+5*Math.log1p(Math.max(0,n-25)/5);
 const effortGain=reward=>{const log10=Math.max(0,H.from(reward).log10().toNumber(1000));return Math.log1p(Math.min(30,log10))*.025;};
 // Soft cap avoids abrupt end to permanent growth (V28 capped at 1e16).
 const softLog=log=>{const threshold=Math.log(1e16);return log<=threshold?log:threshold+.85*Math.log1p(log-threshold);};
 function clean(raw,liveTier){
  const old=raw&&typeof raw==='object'?raw:{};
  const clears={};for(let i=1;i<=15;i++)clears[i]=floor(old.clears?.[i]||old.clears?.['T'+i],1e12);
  const legacy=old.schema===28?floor(old.legacy,20):floor(old.count,20);
  const count=floor(old.schema===28?old.count:legacy,1e12);
  return {schema:28,count,legacy,clears,bestTier:Math.min(15,Math.max(floor(old.bestTier,15),floor(liveTier,15))),
   lastTier:floor(old.lastTier,15),totalTaps:floor(old.totalTaps,1e12),
   lastRestartAt:Math.max(0,Number(old.lastRestartAt)||0),autoRebuild:old.autoRebuild===true,
   rebuilt:floor(old.rebuilt,1e9),rebuildTimer:Math.max(0,Math.min(8,Number(old.rebuildTimer)||0)),
   effortLog:Math.max(0,Math.min(1e5,Number(old.effortLog)||0)),lastEffortGain:Math.max(0,Math.min(1,Number(old.lastEffortGain)||0))};
 }
 class ForgeUniversalCycle extends Base{
  constructor(data,saved){super(data,saved);this.state.grandCycle=clean(this.state.grandCycle,this.state.unlockedTier);
   // 旧版の自動再誕は重複しないよう、正式な対象指定式に統合する。
   if(this.state.automation?.rebirth){if(this.state.workshop?.stage>=6&&!this.state.workshop.autoPrestigeOn){this.state.workshop.autoPrestigeTarget=1;this.state.workshop.autoPrestigeOn=true;}this.state.automation.rebirth=false;this.state.settings=this.state.settings||{};this.state.settings.legacyAutomationMigrated=true;}
  }
  grandCycles(){return this.state.grandCycle.count}
  tierClearCount(tier){return this.state.grandCycle.clears[floor(tier,15)]||0}
  grandProductionBonus(){
   const c=this.state.grandCycle;let log=Math.log(6)*Math.min(10,c.legacy)+(c.effortLog||0);
   for(let i=1;i<=15;i++)log+=Math.log(1+i*.35)*effectiveClears(c.clears[i]||0);
   return Math.exp(softLog(log));
  }
  grandCurrencyBonus(){return Math.max(1,Math.min(1e6,Math.sqrt(this.grandProductionBonus())))}
  grandSummary(){let c=this.state.grandCycle;return{cycles:c.count,multiplier:this.grandProductionBonus(),bestTier:Math.max(c.bestTier,this.state.unlockedTier),at:this.state.unlockedTier,lastTier:c.lastTier}}
  nextCycleMultiplier(tier){const c=this.state.grandCycle,n=this.tierClearCount(tier);
   const reward=this.previewPrestige(tier).reward||H.zero();
   let log=Math.log(6)*Math.min(10,c.legacy)+(c.effortLog||0)+effortGain(reward);
   for(let i=1;i<=15;i++)log+=Math.log(1+i*.35)*effectiveClears((c.clears[i]||0)+(i===tier?1:0));
   return Math.exp(softLog(log));
  }
  baseMultiplier(){return super.baseMultiplier().mul(this.grandProductionBonus())}
  currentCurrencyRate(){return super.currentCurrencyRate()*this.grandCurrencyBonus()}
  previewPrestige(tier){if(tier!==this.state.unlockedTier+1 && !(tier===15&&this.state.unlockedTier===15))return {ready:false,reward:H.zero()};const p=super.previewPrestige(tier);
   if(p.ready&&tier>=1&&tier<=15&&this.grandCycles())p.reward=p.reward.mul(Math.pow(1.12,Math.min(30,this.grandCycles())));
   return p;
  }
  prestige(tier){
   if(!Number.isInteger(tier)||tier<1||tier>15||this.state.unlockedTier!==tier-1&&!(tier===15&&this.state.unlockedTier===15))return false;
   if(!this.previewPrestige(tier).ready)return false;
   const preview=this.previewPrestige(tier);const ok=super.prestige(tier);if(!ok)return false;
   return this.performUniversalReset(tier,preview.reward);
  }
  performUniversalReset(tier,reward=H.one()){
   const s=this.state,c=s.grandCycle;
   // Rewards are intentionally converted into a persistent, bounded boost; the
   // former UI called them spendable points although all balances were reset.
   const earnedEffort=effortGain(reward);c.effortLog=Math.min(1e5,(c.effortLog||0)+earnedEffort);c.lastEffortGain=earnedEffort;
   c.bestTier=Math.max(c.bestTier,tier,s.unlockedTier);
   c.lastTier=tier;c.count=floor(c.count+1,1e12);c.clears[tier]=floor((c.clears[tier]||0)+1,1e12);
   c.totalTaps=Math.min(1e12,c.totalTaps+(s.taps||0));c.lastRestartAt=Date.now();c.rebuilt=0;c.rebuildTimer=0;
   // Purchased progress and spendable currency are always cleared, regardless of tier.
   for(const sym of ['E',...this.data.prestige.map(x=>x.symbol)]){this.set(sym,H.zero());s.earned[sym]=Z();if(sym!=='E')s.cycleEarned[sym]=Z()}
   s.peakE=Z();s.bestE=Z();s.facilities={};s.research={};s.skills=[];s.laws=[];
   s.bridge=null;s.activeChallenge=null;s.challengeBackup=null;s.resetBoost=0;s.bridgeRewardBoost=0;
   s.unlockedTier=0;s.taps=0;s.knowledge=0;s.stardust=0;s.cartographyLevel=0;s.endlessRank=0;
   s.challenges={};s.exploration=Object.fromEntries(this.data.exploration.map(x=>[x.id,0]));
   s.civilizations=Object.fromEntries(this.data.civilizations.map(x=>[x.id,0]));
   s.miniBoost=0;s.miniMultiplier=1;s.tierWorkClock=0;
   const w=s.workshop;
   if(w){w.board=['empty','empty','empty','empty','core','empty','empty','empty','empty'];
    w.particles=0;w.crystals=0;w.stars=0;
    for(const k of ['tapCarry','synthCarry','autoBuyCarry','autoCraftCarry','autoLayoutCarry','autoPrestigeCarry'])w[k]=0;}
   const world=s.cosmos;
   if(world){world.stars=[];world.planets=[];world.routes=[];world.universes=[];
    world.dust=0;world.insight=0;world.totalDust=0;world.totalInsight=0;world.autoClock=0;world.lastEvent=null;}
   // Keep the player's learned work and decisions but reset purchased per-tier bonuses.
   if(s.tierOperations){for(const record of Object.values(s.tierOperations)){if(record&&typeof record==='object'){
    record.production=0;record.research=0;record.automatic=0;}}}
   this.logAction('T'+tier+'を完了。T0へ戻り、習得済みの設計と永続倍率を引き継いだ');
   return true;
  }
  // A previously cleared tier is not a prestige. Rebuilding it pays no new reward
  // and never increments the prestige/clear counter.
  reconstructionCost(tier){return H.from(10).pow(Math.min(22,3+tier*1.1))}
  reconstructionInfo(){const current=this.state.unlockedTier,tier=current+1,c=this.state.grandCycle;
   const unlocked=tier>=1&&tier<=15&&tier<=c.bestTier;
   const cost=unlocked?this.reconstructionCost(tier):H.zero();
   const shortage=unlocked&&this.amount('E').lt(cost)?cost.sub(this.amount('E')):H.zero();
   const rate=this.production();const eta=shortage.isZero()?0:rate.isZero()?null:shortage.div(rate).toNumber(1e12);
   return {tier,unlocked,ready:unlocked&&this.amount('E').gte(cost),cost,shortage,eta,bestTier:c.bestTier,auto:c.autoRebuild};
  }
  reconstructTier(){const r=this.reconstructionInfo();if(!r.ready||!this.pay('E',r.cost))return false;
   const s=this.state;s.unlockedTier=r.tier;s.bridge=null;
   // Seed the reconstructed tier's native currency; normal tier currency production
   // and bridges then rebuild it. No previous reward is minted.
   const symbol=this.data.prestige[r.tier-1].symbol;
   this.credit(symbol,H.from(Math.max(1,Math.min(100,3+r.tier))));
   s.grandCycle.rebuilt++;this.logAction('T'+r.tier+'の設備を再建（新たな転生報酬はなし）');return true;
  }
  setAutoRebuild(flag){this.state.grandCycle.autoRebuild=!!flag;return true}
  tick(dt,opts={}){super.tick(dt,opts);
   if(opts.auto!==false&&this.state.grandCycle.autoRebuild&&this.state.workshop?.stage>=3){
    // Rebuild one already-learned tier every 8 active seconds, never instantly.
    const c=this.state.grandCycle;c.rebuildTimer+=Math.max(0,Math.min(8,Number(dt)||0));
    if(c.rebuildTimer>=8){const built=this.reconstructTier();c.rebuildTimer=built?0:7.5;}
   }
  }
  // V27 save users may choose a one-time migration without gaining extra points.
  canMigrateOldRun(){return this.state.unlockedTier>0&&this.state.grandCycle.count>=0}
  migrateOldRun(){if(!this.canMigrateOldRun())return false;
   this.state.grandCycle.bestTier=Math.max(this.state.grandCycle.bestTier,this.state.unlockedTier);
   const before=this.state.grandCycle.count,clears={...this.state.grandCycle.clears};
   const ok=this.performUniversalReset(this.state.unlockedTier);
   this.state.grandCycle.count=before;this.state.grandCycle.clears=clears;return ok;
  }
 }
 root.ForgeEngine=ForgeUniversalCycle;
 if(typeof module!=='undefined'&&module.exports)module.exports=ForgeUniversalCycle;
})(typeof globalThis!=='undefined'?globalThis:this);
