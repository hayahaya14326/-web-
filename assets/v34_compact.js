/* V34: mobile-first screen density controls. Pure presentation; no changes to economy or saves. */
(function(){'use strict';
const compact=()=>matchMedia('(max-width:760px)').matches;
const selected={pets:'draw',automation:'run',achievements:'goals',prestige:'requirements'};
const expanded={equipment:false,lists:{},guide:false,resources:false};
const panel=document.getElementById('side-content'),facilities=document.getElementById('facility-list');
function make(tag,cls,label){const x=document.createElement(tag);if(cls)x.className=cls;if(label!==undefined)x.textContent=label;return x;}
function button(label,key,active){const b=make('button','v34-section-button'+(active?' selected':''),label);b.type='button';b.dataset.v34Section=key;b.setAttribute('aria-pressed',String(active));return b;}
function segments(root,kind,groups,afterNode){
 const nav=make('div','v34-section-tabs');nav.setAttribute('role','group');nav.setAttribute('aria-label','表示する内容');
 const panes=make('div','v34-segment-panes');
 for(const [key,label,nodes] of groups){const chosen=selected[kind]===key;nav.append(button(label,kind+':'+key,chosen));const p=make('section','v34-segment'+(chosen?' selected':''));p.dataset.v34Pane=kind+':'+key;for(const el of nodes)if(el)p.append(el);panes.append(p);}
 if(afterNode&&afterNode.parentNode===root)afterNode.after(nav,panes);else root.append(nav,panes);
}
function enhancePets(root){const page=root.querySelector('.pet-page');if(!page||page.dataset.v34)return;page.dataset.v34='1';
 const draw=page.querySelector('.pet-draw'),rebirth=page.querySelector('.pet-prestige'),grid=page.querySelector('.pet-grid'),heading=page.querySelector('.pet-section-title'),description=heading?.nextElementSibling;
 let nodes=[heading];if(description?.tagName==='P')nodes.push(description);nodes.push(grid);
 segments(page,'pets', [['draw','ガチャ',[draw]],['collection','図鑑・合成',nodes],['rebirth','ペット転生',[rebirth]]],page.querySelector('.pet-summary'));
 const intro=page.querySelector(':scope > p.tiny');if(intro)intro.classList.add('v34-mobile-details');
}
function enhanceAutomation(root){const page=root.querySelector('.automation-page');if(!page||page.dataset.v34)return;page.dataset.v34='1';
 const group1=['.v16-next','.v16-earned','.cycle-rebuild','.v16-auto-kpi'];
 const group2=['.v18-automation-plan','.v19-procurement','.quality-automation'];
 const group3=['.v20-learning-loop','.v16-learned','.cycle-automation'];
 const nodes=(queries)=>queries.map(s=>page.querySelector(':scope > '+s)).filter(Boolean);
 segments(page,'automation', [['run','稼働・次の工程',nodes(group1)],['design','設計・優先順位',nodes(group2)],['history','説明・作業記録',nodes(group3)]],page.querySelector('.v16-auto-head'));
}
function enhanceAchievements(root){const page=root.querySelector('.record-page');if(!page||page.dataset.v34)return;page.dataset.v34='1';
 const records=[...page.children].filter(e=>e.matches('.record-filter,.record-list,.quality-show-more,.record-footnote')||e.classList.contains('record-subheading')&&e.textContent.includes('追加の達成記録'));
 const additional=page.querySelector('.record-subheading:last-of-type');
 if(additional&&additional.textContent.includes('追加の達成記録')){const after=additional.nextElementSibling;if(after?.matches('.record-list')&&!records.includes(after))records.push(after);}
 const goals=[page.querySelector('.quality-achievements')];
 const heading=[...page.querySelectorAll(':scope > h4.record-subheading')].find(e=>e.textContent.includes('次に狙える'));if(heading)goals.push(heading);
 for(let e=heading?.nextElementSibling;e?.classList.contains('record-card');e=e.nextElementSibling)goals.push(e);
 segments(page,'achievements',[['goals','次にすること',goals],['records','記録を確認',records]],page.querySelector('.record-overall'));
}
function enhancePrestige(root){const guide=root.querySelector('.ascension-guide');if(!guide||guide.dataset.v34)return;guide.dataset.v34='1';
 const accomplished=[...guide.querySelectorAll('.ascension-condition.done')];
 const incomplete=[...guide.querySelectorAll('.ascension-condition.pending')];
 if(accomplished.length){const details=make('details','v34-accomplished');const summary=make('summary','',`達成済みの条件 ${accomplished.length}件を見る`);details.append(summary,...accomplished);const first=guide.querySelector('.ascension-condition');if(first)first.before(details);}
 const intro=guide.querySelector(':scope > p');if(intro){const explain=make('details','v34-rule-details');explain.append(make('summary','', '転生後に残るもの・再建との違い'),intro);const header=guide.querySelector('h4');header?.after(explain);}
 if(incomplete.length){const stamp=make('div','v34-todo-counter',`残り ${incomplete.length}条件 — 上から順に達成しよう`);guide.querySelector('h4')?.after(stamp);}
 // Show every requirement's status and numbers immediately; put longer advice behind a tap.
 for(const cond of incomplete){const advice=cond.querySelector(':scope > p');if(!advice)continue;const more=make('details','v34-condition-explain');more.append(make('summary','', '達成方法を確認'),advice);cond.append(more);}
 const other=[...root.querySelectorAll('.cycle-guide,.cycle-intro,.cycle-promise')];
 other.forEach(x=>x.classList.add('v34-preamble'));
 const page=root.querySelector('.side-body');if(!page)return;
 const tier=page.querySelector('.tier-card'),bridge=page.querySelector('.bridge-panel'),work=page.querySelector('.tier-work'),guideBlock=page.querySelector('.cycle-guide'),migration=page.querySelector('.cycle-choice');
 const primary=[guide];
 const detailed=guide.querySelector('.v34-rule-details'),foot=guide.querySelector('.ascension-foot');if(detailed&&foot)detailed.append(foot);
 // Repeat only the actual submit button: the complete explanatory card stays in '作業'.
 const submit=tier?.querySelector('button[data-prestige]');if(submit){const direct=submit.cloneNode(true);direct.classList.add('v34-ascend-cta');guide.append(direct);}
 segments(page,'prestige', [['requirements','転生条件',primary],['work','作業・演算橋',[bridge,work,tier]],['details','周回ルール',[guideBlock,migration]]],page.querySelector(':scope > h3'));

}
function enhanceGuide(root){const page=root.querySelector('.side-body');if(!page||page.dataset.v34)return;page.dataset.v34='1';const cards=[...page.querySelectorAll('.guide-step')];
 const destinations={'自動化を管理':'automation','実績を確認':'achievements','生産を加速':'equipment','ペットを集める':'pets','星図計画':'constellations','研究を進める':'research','創造工房を組み立てる':'workshop','再誕を目指す':'prestige','スキルを育てる':'skills','恒星と惑星の創造':'celestial','宇宙探索':'explore','文明の発展':'civil','法則を編集':'laws','階層試練に挑む':'challenge'};
 cards.forEach(card=>{const destination=destinations[card.querySelector('strong')?.textContent||''];if(destination){card.dataset.v34Destination=destination;card.setAttribute('role','button');card.tabIndex=0;}});
 if(cards.length>6){cards.forEach((e,i)=>e.classList.toggle('v34-guide-extra',i>=6));const b=make('button','v34-more','ほかの機能を表示');b.type='button';b.dataset.v34More='guide';page.querySelector('.guide-steps')?.after(b);expanded.guide=false;}
}
function enhanceRepeats(root,view){const selector={research:'.research-row',skills:'.skill-row',constellations:'.constellation-card',challenge:'.challenge-row',explore:'.explore-row',civil:'.civil-row',laws:'.law-row'}[view];if(!selector)return;const rows=[...root.querySelectorAll(selector)];if(rows.length<=5)return;const show=Boolean(expanded.lists[view]);rows.forEach((e,i)=>e.classList.toggle('v34-extra',i>=5));const b=make('button','v34-more',show?'一覧を折りたたむ':`さらに表示（残り${rows.length-5}件）`);b.type='button';b.dataset.v34More='list:'+view;root.querySelector('.side-body')?.append(b);root.classList.toggle('v34-list-expanded',show);}
function enhancePanel(){if(!panel||!compact())return;const view=document.body.dataset.mobileView;syncNav();
 if(view==='pets')enhancePets(panel);
 if(view==='automation')enhanceAutomation(panel);
 if(view==='achievements')enhanceAchievements(panel);
 if(view==='prestige')enhancePrestige(panel);
 if(view==='guide')enhanceGuide(panel);
 enhanceRepeats(panel,view);
}
function enhanceEquipment(){if(!facilities||!compact())return;const items=[...facilities.querySelectorAll(':scope > .facility')];const bar=document.getElementById('v34-facility-toolbar')||make('div','v34-facility-toolbar');bar.id='v34-facility-toolbar';bar.innerHTML='';const label=make('span','',`解放済み ${items.length}種類`);bar.append(label);
 if(items.length>5){const b=make('button','v34-more-inline',expanded.equipment?'少なく表示':'一覧をすべて表示');b.type='button';b.dataset.v34More='equipment';bar.append(b);}
 facilities.before(bar);
 items.forEach((it,i)=>it.classList.toggle('v34-extra',i>=5));facilities.classList.toggle('v34-expanded',expanded.equipment);
}
function enhanceCore(){const center=document.getElementById('core-panel');if(!center||center.querySelector('.v34-record-details'))return;
 const dashboard=center.querySelector('.dashboard'),chronicle=center.querySelector('.chronicle');if(!dashboard)return;
 const details=make('details','v34-record-details');details.append(make('summary','', 'プレイ記録・発見を見る'));details.append(dashboard);if(chronicle)details.append(chronicle);center.append(details);
}
function syncNav(){if(!compact())return;const view=document.body.dataset.mobileView||'core',advanced=!['core','equipment','automation','achievements'].includes(view);const menu=document.querySelector('.mobile-nav [data-action="feature-menu"]');const labels={pets:'ペット',prestige:'転生',workshop:'工房',research:'研究',skills:'スキル',constellations:'星図',celestial:'天体',explore:'探索',civil:'文明',laws:'法則',challenge:'試練',guide:'一覧'};document.querySelectorAll('.mobile-nav [data-mobile]').forEach(btn=>{const active=!advanced&&btn.dataset.mobile===view;btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});if(menu){menu.classList.toggle('active',advanced);const span=menu.querySelector('span');if(span)span.textContent=advanced?(labels[view]||'メニュー'):'メニュー';}}
function buildResourceControl(){const upper=document.getElementById('upper-resources');if(!upper||document.getElementById('v34-resources-button'))return;const b=make('button','v34-upper-button','ほかの資源を見る');b.type='button';b.id='v34-resources-button';b.setAttribute('aria-controls','upper-resources');b.setAttribute('aria-expanded','false');document.querySelector('.resourcebar')?.after(b);}
function toggleSection(key){const [view,section]=key.split(':');selected[view]=section;panel.querySelectorAll('[data-v34-pane]').forEach(x=>x.classList.toggle('selected',x.dataset.v34Pane===key));panel.querySelectorAll('[data-v34-section]').forEach(x=>{const current=x.dataset.v34Section===key;x.classList.toggle('selected',current);x.setAttribute('aria-pressed',String(current));});}
function refreshResources(){const upper=document.getElementById('upper-resources'),b=document.getElementById('v34-resources-button');if(!upper||!b)return;b.hidden=upper.hidden;b.textContent=expanded.resources?'ほかの資源を閉じる':'ほかの資源を見る';b.setAttribute('aria-expanded',String(expanded.resources));upper.classList.toggle('v34-resource-open',expanded.resources);}
document.addEventListener('click',e=>{const destination=e.target.closest('[data-v34-destination]');if(destination){window.ForgeGameAPI?.goto(destination.dataset.v34Destination);return;}const section=e.target.closest('[data-v34-section]');if(section){toggleSection(section.dataset.v34Section);return;}const more=e.target.closest('[data-v34-more]');if(more){let key=more.dataset.v34More;if(key==='equipment'){expanded.equipment=!expanded.equipment;enhanceEquipment();}else if(key==='guide'){expanded.guide=!expanded.guide;panel.classList.toggle('v34-guide-open',expanded.guide);more.textContent=expanded.guide?'少なく表示':'ほかの機能を表示';}else if(key.startsWith('list:')){const v=key.slice(5);expanded.lists[v]=!expanded.lists[v];panel.classList.toggle('v34-list-expanded',expanded.lists[v]);more.textContent=expanded.lists[v]?'一覧を折りたたむ':'さらに表示';}return;}
 if(e.target.id==='v34-resources-button'){expanded.resources=!expanded.resources;refreshResources();return;}
});
document.addEventListener('keydown',e=>{const dst=e.target.closest('[data-v34-destination]');if(dst&&(e.key==='Enter'||e.key===' ')){e.preventDefault();window.ForgeGameAPI?.goto(dst.dataset.v34Destination)}});
// The game frequently rebuilds content. Observe only root replacement, not our own nested reorganization.
if(panel){new MutationObserver(()=>enhancePanel()).observe(panel,{childList:true});}
if(facilities){new MutationObserver(()=>enhanceEquipment()).observe(facilities,{childList:true});}
if(document.getElementById('upper-resources')){new MutationObserver(()=>refreshResources()).observe(document.getElementById('upper-resources'),{attributes:true,attributeFilter:['hidden']});}
window.addEventListener('resize',()=>{if(compact()){enhanceCore();enhancePanel();enhanceEquipment();refreshResources();}else{const info=document.querySelector('.v34-record-details');if(info)info.open=true;}});
new MutationObserver(()=>{if(compact())syncNav()}).observe(document.body,{attributes:true,attributeFilter:['data-mobile-view']});
if(compact())enhanceCore();buildResourceControl();enhancePanel();enhanceEquipment();refreshResources();
})();
