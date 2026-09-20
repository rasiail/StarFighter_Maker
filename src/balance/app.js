import { BALANCE } from '../data/generated/balance.js';
import { compareStrategies, DEFAULT_ASSUMPTIONS } from './simulator.js';

const names = { balanced:'균형', offense:'공격', survival:'생존', random:'무작위', cannon:'기관포', standardMissile:'표준 미사일', multiMissile:'멀티 미사일', stage_aircraft:'공중 적기', tank:'전차', ship_hull:'전함 선체', ship_turret:'전함 함포', boss:'보스' };
const $ = id => document.getElementById(id);
let results;

function assumptions() {
    const multi = Number($('multi-share').value) / 100;
    return {
        ...DEFAULT_ASSUMPTIONS,
        runs: Number($('runs').value),
        cannonAccuracy: Number($('cannon-accuracy').value) / 100,
        missileAccuracy: Number($('missile-accuracy').value) / 100,
        cannonUptime: Number($('cannon-uptime').value) / 100,
        standardMissileShare: 1 - multi,
        multiMissileShare: multi,
        engagementSecondsPerTarget: Number($('engagement-seconds').value) / 100,
    };
}

function formatTime(seconds) { const minutes=Math.floor(seconds/60), rest=Math.round(seconds%60); return `${minutes}분 ${String(rest).padStart(2,'0')}초`; }
function metric(label,value,detail='') { return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`; }

function drawLineChart(svg, points, xValue, yValue, yLabel, formatter = value => value.toFixed(0)) {
    const width=520,height=260,margin={top:22,right:20,bottom:38,left:55};
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.replaceChildren();
    const xs=points.map(xValue),ys=points.map(yValue),xMax=Math.max(...xs,1),yMax=Math.max(...ys,1)*1.08;
    const x=v=>margin.left+v/xMax*(width-margin.left-margin.right), y=v=>height-margin.bottom-v/yMax*(height-margin.top-margin.bottom);
    const ns='http://www.w3.org/2000/svg'; const add=(tag,attrs,text)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;svg.append(el);return el;};
    for(let i=0;i<=4;i++){const value=yMax*i/4;add('line',{x1:margin.left,x2:width-margin.right,y1:y(value),y2:y(value),class:'chart-grid'});add('text',{x:margin.left-8,y:y(value)+4,'text-anchor':'end',class:'chart-axis'},formatter(value));}
    for(let i=0;i<=4;i++){const value=xMax*i/4;add('text',{x:x(value),y:height-14,'text-anchor':'middle',class:'chart-axis'},`${(value/60).toFixed(0)}분`);}
    const path=points.map((point,i)=>`${i?'L':'M'}${x(xValue(point)).toFixed(1)},${y(yValue(point)).toFixed(1)}`).join(' ');
    add('path',{d:`M${x(xs[0])},${y(0)} ${path.replace(/^M/,'L')} L${x(xs.at(-1))},${y(0)} Z`,class:'chart-area'});
    add('path',{d:path,class:'chart-line'});
    points.forEach(point=>{
        const dot=add('circle',{cx:x(xValue(point)),cy:y(yValue(point)),r:3,class:'chart-dot'});
        const title=document.createElementNS(ns,'title');
        title.textContent=`${point.point}: ${formatter(yValue(point))} ${yLabel}`;
        dot.append(title);
    });
    add('text',{x:margin.left,y:14,class:'chart-label'},yLabel);
}

function drawXpChart() {
    let cumulative=0; const points=BALANCE.levels.map(row=>{const item={level:row.currentLevel,required:row.xpToNext,cumulative};cumulative+=row.xpToNext;return item;});
    const svg=$('xp-chart'),width=1200,height=300,margin={top:24,right:65,bottom:40,left:65},ns='http://www.w3.org/2000/svg'; svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
    const x=v=>margin.left+(v-1)/(points.length-1)*(width-margin.left-margin.right), y1=v=>height-margin.bottom-v/Math.max(...points.map(p=>p.required))*(height-margin.top-margin.bottom), y2=v=>height-margin.bottom-v/Math.max(...points.map(p=>p.cumulative))*(height-margin.top-margin.bottom);
    const add=(tag,a,t)=>{const e=document.createElementNS(ns,tag);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));if(t!==undefined)e.textContent=t;svg.append(e);return e;};
    for(let i=0;i<=4;i++){const yy=margin.top+i*(height-margin.top-margin.bottom)/4;add('line',{x1:margin.left,x2:width-margin.right,y1:yy,y2:yy,class:'chart-grid'});}
    add('path',{d:points.map((p,i)=>`${i?'L':'M'}${x(p.level)},${y1(p.required)}`).join(' '),class:'chart-line'});
    add('path',{d:points.map((p,i)=>`${i?'L':'M'}${x(p.level)},${y2(p.cumulative)}`).join(' '),fill:'none',stroke:'var(--blue)','stroke-width':2.5});
    add('text',{x:margin.left,y:15,class:'chart-label'},'요구 XP (초록) / 누적 XP (파랑, 독립 축)');
    for(const level of [1,10,20,30,40,50,60]) add('text',{x:x(level),y:height-15,'text-anchor':'middle',class:'chart-axis'},`Lv.${level}`);
}

function render() {
    const error=$('validation-error'); error.hidden=true;
    try { results=compareStrategies(assumptions()); } catch (exception) { error.textContent=exception.message; error.hidden=false; return; }
    const selected=results[$('chart-strategy').value];
    $('summary').innerHTML=[
        metric('예상 런 시간',formatTime(selected.averageSeconds),`10~90%: ${formatTime(selected.p10Seconds)}~${formatTime(selected.p90Seconds)}`),
        metric('종료 레벨',selected.averageFinalLevel.toFixed(1),`선택 카드 ${selected.averageSelections.toFixed(1)}회`),
        metric('총 표적',selected.timeline.at(-1).cumulativeTargets.toFixed(0),`웨이브 ${BALANCE.stages.reduce((sum, stage) => sum + stage.waves.reduce((a,b) => a+b,0),0)} + 보스 ${BALANCE.stages.length}`),
        metric('최종 전투 DPS',selected.finalWeapons.totalDps.toFixed(1),'입력 명중률·사용 비중 반영'),
    ].join('');
    $('strategy-table').tBodies[0].innerHTML=Object.values(results).map(r=>`<tr><td>${names[r.strategy]}</td><td>${formatTime(r.averageSeconds)}</td><td>${formatTime(r.p10Seconds)}~${formatTime(r.p90Seconds)}</td><td>${r.averageFinalLevel.toFixed(1)}</td><td>${r.averageSelections.toFixed(1)}</td><td>${r.finalWeapons.totalDps.toFixed(1)}</td></tr>`).join('');
    drawLineChart($('level-chart'),selected.timeline,p=>p.elapsedSeconds,p=>p.level,'레벨',v=>v.toFixed(1));
    drawLineChart($('dps-chart'),selected.timeline,p=>p.elapsedSeconds,p=>p.dps,'DPS');
    drawLineChart($('enemy-chart'),selected.timeline,p=>p.elapsedSeconds,p=>p.cumulativeTargets,'표적');
    const weaponEntries=['cannon','standardMissile','multiMissile'].map(key=>[key,selected.finalWeapons[key]]),weaponTotal=weaponEntries.reduce((sum,[,v])=>sum+v.sustainedDps,0);
    $('weapon-table').tBodies[0].innerHTML=weaponEntries.map(([key,value])=>`<tr><td>${names[key]}</td><td>${value.burstDamage.toFixed(1)}</td><td>${value.sustainedDps.toFixed(1)}</td><td>${(value.sustainedDps/weaponTotal*100).toFixed(1)}%</td></tr>`).join('');
    const enemyEntries=Object.entries(selected.averageEnemyCounts),enemyTotal=enemyEntries.reduce((s,[,v])=>s+v,0);
    $('enemy-table').tBodies[0].innerHTML=enemyEntries.sort((a,b)=>b[1]-a[1]).map(([key,value])=>`<tr><td>${names[key]||key}</td><td>${value.toFixed(1)}</td><td>${(value/enemyTotal*100).toFixed(1)}%</td></tr>`).join('');
}

export function initBalanceLab() {
    for(const input of document.querySelectorAll('input[type=range]')) input.addEventListener('input',()=>{input.nextElementSibling.value=input.id==='engagement-seconds'?`${(input.value/100).toFixed(2)}초`:`${input.value}%`;});
    $('run-simulation').addEventListener('click',render);
    $('chart-strategy').addEventListener('change',render);
    drawXpChart();
    render();
}

if (typeof document !== 'undefined') initBalanceLab();
