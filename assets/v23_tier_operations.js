/* ひとつぶ V23 — manual craft -> trained automation throughout T3..T15.
   No network access; state persists in the existing save snapshot. */
(function(root){'use strict';
const Base=root.ForgeEngine,H=root.Huge;
if(!Base||!H)throw Error('ゲームエンジンの初期化に失敗しました');
const TASKS=[
 [3,'宇宙の配分','生産型の宇宙と研究型の宇宙の配分を決める','生産寄りに配分','研究寄りに配分'],
 [4,'星系の接続','星系を結ぶ経路の用途を決める','輸送を増やす','観測を優先'],
 [5,'周期の調整','創造の周期を短縮するか、安定させるか決める','回転数を上げる','蓄積を安定させる'],
 [6,'法則の調整','生産の法則と継承の法則の重点を決める','生産の法則を強める','継承の法則を強める'],
 [7,'空間の配置','限られた空間を工場と研究室に振り分ける','工場を広げる','研究室を広げる'],
 [8,'時間の配分','現在の生産と次の周回の準備に時間を振り分ける','今を加速する','次を準備する'],
 [9,'階層の接続','隣り合う階層の出力と資源循環を整理する','出力側に接続','循環側に接続'],
 [10,'設計の継承','今の設計の生産効率と引継ぎを調整する','設備を最適化','継承を優先'],
 [11,'公理の検証','増産する条件と次の演算に備える条件を選ぶ','生産式を検証','演算式を検証'],
 [12,'境界の維持','境界の中で増やすか、外に広げるか決める','内部を増産','外側へ展開'],
 [13,'原点の再構成','最初の生産源と次の階層の接点を組み直す','生産源を強化','接点を強化'],
 [14,'外縁の運用','広がった領域の設備と輸送を管理する','設備を増強','輸送を増強'],
 [15,'継続設計','長期の生産を安定させるか再帰処理を優先する','生産を安定化','再帰処理を強化']
].map(([tier,title,description,primary,secondary])=>({tier,title,description,primary,secondary}));
const byTier=new Map(TASKS.map(x=>[x.tier,x]));
const norm=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const BRANCH_LIMIT=35;
const SPECIAL={
 3:'エネルギーと階層通貨の基本生産を強化',4:'星屑／観測知識の生成を強化',
 5:'手動タップ／上位通貨の生成を強化',6:'法則による生産／転生報酬を強化',
 7:'設備生産／設備購入費用を強化',8:'手動タップ／階層通貨の生成を強化',
 9:'通常生産／転生報酬を強化',10:'工房生産／装置の設置費用を強化',
 11:'設備生産／研究費用を強化',12:'基本生産／文明の効果を強化',
 13:'天体生産／設備購入費用を強化',14:'全体生産／転生報酬を強化',
 15:'全体生産／エンドレス昇格費用を強化'};

function sanitize(old,unlocked){let result={};for(const x of TASKS){let data=old?.[x.tier];result[x.tier]={manual:norm(Math.floor(data?.manual||0),0,100000),automatic:norm(Math.floor(data?.automatic||0),0,100000),production:norm(Math.floor(data?.production||0),0,100000),research:norm(Math.floor(data?.research||0),0,100000),preferred:data?.preferred==='research'?'research':'production',enabled:data?.enabled!==false,lastAutoAt:norm(data?.lastAutoAt||0,0,9e15),lastFuelMode:data?.lastFuelMode==='inherited'?'inherited':'native'};}
return result}
class ForgeTierOperations extends Base{
 constructor(data,saved){super(data,saved);const previouslySaved=!!(saved?.tierOperations&&typeof saved.tierOperations==='object');this.state.tierOperations=sanitize(this.state.tierOperations,this.state.unlockedTier);this.state.tierWorkClock=norm(this.state.tierWorkClock||0,0,3600);this.state.tierLegacyExempt=norm(this.state.tierLegacyExempt??(!previouslySaved&&saved?.unlockedTier>=3?saved.unlockedTier+1:0),0,16)}
 tierTasks(){return TASKS}
 tierTask(tier){return byTier.get(Number(tier))||null}
 tierWorkDescription(tier){return SPECIAL[Number(tier)]||'生産と循環を調整'}
 tierWorkPoints(tier,choice){const r=this.tierWork(tier);return r&&this.state.unlockedTier>=Number(tier)?Math.min(BRANCH_LIMIT,Math.max(0,r[choice]||0)):0}
 tierWorkStatus(tier){const t=Number(tier),r=this.tierWork(t);if(!r)return {code:'locked',text:'未解放'};
  if(!this.tierAutoReady(t))return {code:'learning',text:'手動で2回習得すると、次の階層で自動化'};
  if(!r.enabled)return {code:'off',text:'手動で停止中'};
  if(this.tierWorkPoints(t,r.preferred)>=BRANCH_LIMIT)return {code:'complete',text:'この方針は上限。別の方針に切り替えると再開可能'};
  const funding=this.tierWorkFunding(t);
  if(!funding)return {code:'reserve',text:'作業の動力を準備中'};
  if(!funding.ready)return {code:'reserve',text:funding.mode==='inherited'?'現在階層の通貨が不足：自動化の動力を待っています':'以前の階層の通貨を保護して待機中'};
  return {code:'active',text:funding.mode==='inherited'?'継承動力で稼働可能：20秒ごとに1回（現在階層の通貨を少量使用）':'旧階層の通貨で稼働可能：20秒ごとに1回'};
 }

 tierWork(tier){return this.state.tierOperations[Number(tier)]||null}
 tierWorkCost(tier){const rec=this.tierWork(tier);if(!rec)return H.zero();const count=rec.manual+rec.automatic;return H.from(Math.min(1e8,1+2*Math.floor(Math.pow(count,.85))))}
 // V26: previously trained work may use the current tier's renewable currency if its
 // original currency was wiped by an ascension. This is a real upper-tier expense,
 // not free currency minted for lower tiers. Prefer original funds when available.
 tierWorkFunding(tier){const t=Number(tier),current=this.state.unlockedTier;
  if(!this.tierAutoReady(t)||t>=current)return null;
  const own=this.data.prestige[t-1].symbol,cost=this.tierWorkCost(t);
  if(this.amount(own).gte(cost.mul(3)))return {mode:'native',symbol:own,cost,ready:true};
  const upper=this.data.prestige[current-1]?.symbol;
  if(!upper||upper===own)return {mode:'native',symbol:own,cost,ready:false};
  const r=this.tierWork(t),gap=current-t;
  // 0.03..~0.06 units / 20 s, cheaper for more established lower tiers.
  // Bounds ongoing shared consumption so the active tier still grows.
  const heritage=H.from((.03+.002*Math.sqrt(r.manual+r.automatic))/ (1+.3*Math.max(0,gap-1)));
  const reserve=heritage.mul(5).add(1);
  return {mode:'inherited',symbol:upper,cost:heritage,ready:this.amount(upper).gte(reserve)};
 }
 tierWorkBonus(){let prod=0,res=0;for(const t of TASKS){if(t.tier>this.state.unlockedTier)break;prod+=this.tierWorkPoints(t.tier,'production')*.028;res+=this.tierWorkPoints(t.tier,'research')*.023}return {production:1+prod,research:1+res};}
 domainBonus(tier,choice,perPoint){return 1+this.tierWorkPoints(tier,choice)*perPoint;}

 tierCanTrain(tier){const t=Number(tier),r=this.tierWork(t);return t>=3&&t<=this.state.unlockedTier&&!!r&&this.amount(this.data.prestige[t-1].symbol).gte(this.tierWorkCost(t))}
 tierAutoReady(tier){const t=Number(tier),r=this.tierWork(t);return !!r&&this.state.unlockedTier>t&&r.manual>=2}
 performTierTask(tier,choice='production',automatic=false){const t=Number(tier),record=this.tierWork(t),config=this.tierTask(t);if(!config||!record||!['production','research'].includes(choice)||this.state.unlockedTier<t)return false;if(automatic&&(!this.tierAutoReady(t)||!record.enabled))return false;
 const symbol=this.data.prestige[t-1].symbol,cost=this.tierWorkCost(t);if(record[choice]>=BRANCH_LIMIT)return false;
 // Manual training always costs the original tier currency. Only mastered,
 // lower-tier automated tasks may draw small amounts of active-tier fuel.
 const fuel=automatic?this.tierWorkFunding(t):{mode:'native',symbol,cost,ready:true};
 if(!fuel||!fuel.ready||!this.pay(fuel.symbol,fuel.cost))return false;
 if(automatic){record.automatic++;record.lastAutoAt=Date.now();record.lastFuelMode=fuel.mode;}else{record.manual++;record.preferred=choice}
 record[choice]++;
 // The completed job recovers a small quantity of its native material only.
 // This is bounded by 35 per branch and does not manufacture upper-tier currency.
 this.credit(symbol,cost.mul(choice==='production'?.12:.20));return true;
 }
 setTierWorkPreference(tier,choice){let r=this.tierWork(tier);if(!r||!this.tierAutoReady(tier)||!['production','research'].includes(choice))return false;r.preferred=choice;return true}
 setTierWorkAuto(tier,value){let r=this.tierWork(tier);if(!r||!this.tierAutoReady(tier))return false;r.enabled=Boolean(value);return true}
 baseMultiplier(){return super.baseMultiplier().mul(this.tierWorkBonus().production*this.domainBonus(3,'production',.005)*this.domainBonus(7,'production',.004)*this.domainBonus(11,'production',.003)*this.domainBonus(12,'production',.003)*this.domainBonus(14,'production',.004)*this.domainBonus(15,'production',.004))}
 stellarRates(){const rate=super.stellarRates();return {dust:rate.dust*this.domainBonus(4,'production',.007)*this.domainBonus(10,'production',.003),insight:rate.insight*this.domainBonus(4,'research',.007)*this.domainBonus(10,'research',.004)}}
 stellarMultiplier(){return super.stellarMultiplier()*this.domainBonus(13,'production',.005)}
 tapPower(){return super.tapPower().mul(this.domainBonus(5,'production',.006)*this.domainBonus(8,'production',.005))}
 lawBonus(key){return super.lawBonus(key)*(key==='prod'?this.domainBonus(6,'production',.004):key==='prestige'?this.domainBonus(6,'research',.004):1)}
 facilityCost(f,n){return super.facilityCost(f,n).mul(f.tier===0?1/(this.domainBonus(7,'research',.005)*this.domainBonus(13,'research',.004)):1)}
 pieceCost(type){let cost=super.pieceCost(type);if(cost)cost.E=cost.E.div(this.domainBonus(10,'research',.004));return cost}
 researchCost(row){return super.researchCost(row).div(this.domainBonus(11,'research',.005))}
 civBonus(index){return super.civBonus(index)*this.domainBonus(12,'research',.004)}
 previewPrestige(tier){const p=super.previewPrestige(tier);if(p.ready&&tier>=3)p.reward=p.reward.mul(this.domainBonus(9,'research',.004)*this.domainBonus(14,'research',.004));
  if(tier>=4&&tier<=15&&this.state.unlockedTier===tier-1&&this.state.tierLegacyExempt<tier){const prior=this.tierWork(tier-1);if((prior?.manual||0)<2){p.ready=false;p.workMissing=Math.max(0,2-(prior?.manual||0));}}return p}
 endlessCost(){return super.endlessCost().div(this.domainBonus(15,'research',.005))}

 currentCurrencyRate(){return super.currentCurrencyRate()*this.tierWorkBonus().research}
 canStartBridge(){if(this.state.unlockedTier>=3&&this.state.tierLegacyExempt<this.state.unlockedTier+1&&(this.tierWork(this.state.unlockedTier)?.manual||0)<2)return false;return super.canStartBridge()}
 ascendEndless(){if(this.state.tierLegacyExempt<16&&(this.tierWork(15)?.manual||0)<2)return false;return super.ascendEndless()}
 tick(dt,opts={}){super.tick(dt,opts);if(!Number.isFinite(dt)||dt<=0||opts.auto===false)return;
 this.state.tierWorkClock=Math.min(3600,this.state.tierWorkClock+Math.min(86400,Math.max(0,dt)));let executions=Math.min(180,Math.floor(this.state.tierWorkClock/20));this.state.tierWorkClock-=20*executions;
 for(let k=0;k<executions;k++){
  // Only the previously mastered tiers run automatically; the newest task is always manual.
  for(let tier=3;tier<this.state.unlockedTier;tier++){let record=this.tierWork(tier);if(this.tierWorkStatus(tier).code!=='active')continue;this.performTierTask(tier,record.preferred,true)}
 }
 }
}
root.ForgeEngine=ForgeTierOperations;root.HitotsubuTierTasks=TASKS;
})(window);
