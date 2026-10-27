/* ひとつぶ V31 — pet collection. No paid currency, offline and local-save only. */
(function(root){'use strict';
const H=root.Huge, RARITIES=[
 {id:'common',name:'コモン',pet:'こめつぶねずみ',chance:50.5,prod:.0003,tap:.0005,color:'#89958e'},
 {id:'uncommon',name:'アンコモン',pet:'めばえぎつね',chance:25,prod:.002,tap:.0035,color:'#72916b'},
 {id:'rare',name:'レア',pet:'こおりうさぎ',chance:15,prod:.012,tap:.021,color:'#698fb3'},
 {id:'epic',name:'エピック',pet:'はぐるまねこ',chance:7,prod:.075,tap:.13,color:'#9a73a7'},
 {id:'legendary',name:'レジェンド',pet:'ほしくじら',chance:2,prod:.45,tap:.8,color:'#d19b4e'},
 {id:'god',name:'ゴッド',pet:'ひかりのこじか',chance:.5,prod:3,tap:5,color:'#bf9559'}
];
const BASE=H.from(1000),GROW=H.from(1.012),MAX_PULLS=1_000_000_000_000,MAX_PRESTIGES=1000000000,PITY=200;
function asInt(v,max=1e9){let n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0}
function petState(e){if(!e.state.petCollection||typeof e.state.petCollection!=='object')e.state.petCollection={};let p=e.state.petCollection;
 p.counts=Array.from({length:6},(_,i)=>asInt(p.counts?.[i],Number.MAX_SAFE_INTEGER));
 if(!p.godPlus||typeof p.godPlus!=='object'||Array.isArray(p.godPlus))p.godPlus={};
 for(const k of Object.keys(p.godPlus)){if(!/^\d+$/.test(k)||Number(k)<1||Number(k)>1_000_000)delete p.godPlus[k];else p.godPlus[k]=asInt(p.godPlus[k],Number.MAX_SAFE_INTEGER)}
 p.pulls=asInt(p.pulls,MAX_PULLS);p.rebirths=asInt(p.rebirths,MAX_PRESTIGES);p.lifetimePulls=asInt(p.lifetimePulls,Number.MAX_SAFE_INTEGER);
 p.sinceGod=asInt(p.sinceGod,PITY-1);
 p.unlocked=Boolean(p.unlocked)||(p.godPlus[5]||0)>0;return p;
}
function costAt(index){return BASE.mul(GROW.pow(index))}
function batchCost(engine,n=1){let p=petState(engine),i=p.pulls; if(!Number.isInteger(n)||n<1||n>10||i+n>MAX_PULLS)return null;
 let sum=H.zero();for(let j=0;j<n;j++)sum=sum.add(costAt(i+j));return sum;
}
function sample(random=Math.random){const roll=Number(random());let v=Math.max(0,Math.min(.999999999999,Number.isFinite(roll)?roll:0))*100,acc=0;
 for(let i=0;i<RARITIES.length;i++){acc+=RARITIES[i].chance;if(v<acc)return i}return 5;
}
function pull(engine,n=1,rng=Math.random){let p=petState(engine),total=batchCost(engine,n);if(!total||!engine.amount('E').gte(total))return null;
 if(!engine.pay('E',total))return null;let hits=[];
 for(let i=0;i<n;i++){const rank=p.sinceGod>=PITY-1?5:sample(rng);p.sinceGod=rank===5?0:p.sinceGod+1;p.counts[rank]++;hits.push(rank)}
 p.pulls+=n;p.lifetimePulls+=n;return {hits,cost:total};
}
function merge(engine,rank,plus=0){let p=petState(engine);rank=Number(rank);plus=Number(plus);
 if(!Number.isInteger(rank)||rank<0||rank>5||!Number.isInteger(plus)||plus<0||plus>999999)return false;
 if(rank<5){if(plus!==0||p.counts[rank]<5)return false;p.counts[rank]-=5;p.counts[rank+1]++;return true}
 let n=plus===0?p.counts[5]:p.godPlus[plus]||0;if(n<5)return false;
 if(plus===0)p.counts[5]-=5;else p.godPlus[plus]-=5;
 p.godPlus[plus+1]=(p.godPlus[plus+1]||0)+1;if(plus+1>=5)p.unlocked=true;return true;
}
// One rank at a time: no hidden chain fusion or consumption of a higher rarity.
// This is intentionally a player-initiated action; quantities and outcomes are exact.
function mergeAll(engine,rank,plus=0){
 const p=petState(engine);rank=Number(rank);plus=Number(plus);
 if(!Number.isInteger(rank)||rank<0||rank>5||!Number.isInteger(plus)||plus<0||plus>999999||(rank<5&&plus!==0))return 0;
 const current=rank===5?(plus===0?p.counts[5]:(p.godPlus[plus]||0)):p.counts[rank];
 const n=Math.floor(current/5);if(n<1)return 0;
 if(rank<5){if(p.counts[rank+1]>Number.MAX_SAFE_INTEGER-n)return 0;p.counts[rank]-=n*5;p.counts[rank+1]+=n;return n}
 if((p.godPlus[plus+1]||0)>Number.MAX_SAFE_INTEGER-n)return 0;
 if(plus===0)p.counts[5]-=n*5;else p.godPlus[plus]-=n*5;
 p.godPlus[plus+1]=(p.godPlus[plus+1]||0)+n;
 if(plus+1>=5)p.unlocked=true;
 return n;
}
function petPrestige(engine){let p=petState(engine);if(!p.unlocked||p.rebirths>=MAX_PRESTIGES)return false;
 p.counts=[0,0,0,0,0,0];p.godPlus={};p.pulls=0;p.sinceGod=0;p.unlocked=false;p.rebirths++;
 return true;
}
// Large pet collections are subject to a gradual efficiency curve, but each
// pet rebirth still DOUBLES the pet-derived contribution exactly.
// Below 10 raw bonus the original pet economy is completely unchanged.
function smoothBonus(raw){
 const pivot=H.from(10);
 if(!raw.gt(pivot))return raw;
 return pivot.mul(raw.div(pivot).pow(.72));
}
function multiplier(engine,mode='prod'){let p=petState(engine),bonus=H.zero();
 for(let i=0;i<6;i++){if(p.counts[i])bonus=bonus.add(H.from(p.counts[i]*RARITIES[i][mode]))}
 for(const [lv,count] of Object.entries(p.godPlus))if(count){const b=H.from(RARITIES[5][mode]).mul(H.from(6).pow(Number(lv))).mul(count);bonus=bonus.add(b)}
 if(bonus.isZero())return H.one();return H.one().add(smoothBonus(bonus).mul(H.from(2).pow(p.rebirths)));
}
function install(){const e=root.ForgeEngine;if(!e||e.prototype.__petV31Installed)return;const proto=e.prototype;
 const oldProduction=proto.production,oldTap=proto.tapPower;
 // Multiply actual automatic production; avoid applying this bonus twice to the basic tap formula.
 proto.production=function(){return oldProduction.call(this).mul(multiplier(this,'prod'))};
 // Keep the equipment-derived 25% component separate: it already includes the pet's
 // production boost and must NOT receive the tap bonus for a second time.
 proto.tapPower=function(){const tapFocus=(root.ForgeFocusModes?.[this.state.settings?.focusMode||'balanced']||root.ForgeFocusModes?.balanced)?.tap||1;const fromProduction=this.production().mul(.25*tapFocus);const manual=oldTap.call(this).sub(fromProduction);return manual.mul(multiplier(this,'tap')).add(fromProduction)};
 proto.petCollection=function(){return petState(this)};
 proto.petCost=function(n=1){return batchCost(this,n)};
 proto.petPull=function(n=1,rng){return pull(this,n,rng)};
 proto.petMerge=function(rank,plus=0){return merge(this,rank,plus)};
 proto.petMergeAll=function(rank,plus=0){return mergeAll(this,rank,plus)};
 proto.petRebirth=function(){return petPrestige(this)};
 proto.petBonus=function(mode='prod'){return multiplier(this,mode)};
 proto.__petV31Installed=true;
}
install();
root.HitotsubuPets={rarities:RARITIES,pityLimit:PITY,costAt,batchCost,sample,petState,pull,merge,mergeAll,petPrestige,multiplier,smoothBonus,install};
})(typeof globalThis!=='undefined'?globalThis:this);
