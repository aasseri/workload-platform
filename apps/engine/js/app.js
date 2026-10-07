/**
 * app.js — واجهة الصفحة: الإدخال، العرض، التصدير.
 * يعتمد على WorkloadEngine و WorkloadExport.
 */
(function(){
'use strict';
const {CAP, LEVELS, SCENARIOS, run, gradeOf, counts} = window.WorkloadEngine;
const {buildWorkbook} = window.WorkloadExport;
const fmt = (x,d=0)=>Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
let current=null;


function render(res){
  current=res;
  const {E,T,best}=res, tasks=best.tasks, ev=best.ev;
  $('tgt').textContent=fmt(T);
  const cs=counts(tasks);
  const hs=LEVELS.map((_,li)=>tasks.filter(t=>t.li===li).reduce((a,t)=>a+t.h,0));
  $('structMeta').textContent=`${E} موظفين · ${tasks.length} مهمة · المستوى ×${res.M} = ${res.N0}`;
  let sh=`<thead><tr><th>التردد</th><th class="n">عدد المهام</th><th class="n">الساعات</th><th class="n">الحصة</th><th></th></tr></thead><tbody>`;
  LEVELS.forEach((L,li)=>{const p=hs[li]/ev.H*100;
    sh+=`<tr><td>${L.name}</td><td class="n">${cs[li]}</td><td class="n">${fmt(hs[li],1)}</td><td class="n">${fmt(p,1)}%</td><td><div class="bartrack"><div class="bar" style="width:${p}%"></div></div></td></tr>`;});
  sh+=`</tbody><tfoot><tr><td>الإجمالي</td><td class="n">${tasks.length}</td><td class="n">${fmt(ev.H,1)}</td><td class="n">100%</td><td></td></tr></tfoot>`;
  $('structTbl').innerHTML=sh;

  $('searchMeta').textContent=`${SCENARIOS} سيناريو · ${res.byN.length} أحجام`;
  let st=`<thead><tr><th class="n">المهام</th><th>التوزيع (ي/أ/ش/ر/ن/س)</th><th class="n">الانحراف</th><th class="n">الجودة</th></tr></thead><tbody>`;
  res.byN.forEach(c=>{st+=`<tr class="${c===best?'chosen':''}"><td class="n">${c.N}</td><td>${counts(c.tasks).join(' / ')}</td><td class="n">${fmt(Math.abs(c.ev.devPct)<0.005?0:c.ev.devPct,2)}%</td><td class="n">${fmt(c.ev.score*100,1)}</td></tr>`;});
  $('searchTbl').innerHTML=st+'</tbody>';

  const dev=ev.H-T;
  $('verify').innerHTML=[
    ['الساعات المستهدفة',fmt(T)],
    ['الساعات الناتجة',fmt(ev.H,1)],
    ['الانحراف بالساعات',(dev>=0?'+':'')+fmt(dev,1)],
    ['نسبة الانحراف',(dev>=0?'+':'')+fmt(ev.devPct,3)+'%'],
    ['الاحتياج الناتج',fmt(ev.H/CAP,2)+' موظف'],
  ].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
  const [g,cls]=gradeOf(ev);
  $('gradePill').textContent=g; $('gradePill').className='pill '+cls;
  $('gradeNote').textContent=`درجة الجودة المركبة ${fmt(ev.score*100,1)} من 100`;
  $('scores').innerHTML=[
    ['قرب الهدف (40%)',ev.sDev],['التدرج بين المستويات (20%)',ev.sGrad],
    ['تنوع الأزمنة (20%)',ev.sDiv],['عدم تضخيم التكرار (20%)',ev.sInf]
  ].map(([k,v])=>`<div class="score"><div class="row"><span>${k}</span><b>${fmt(v*100,0)}</b></div><div class="track"><div class="fill" style="width:${v*100}%"></div></div></div>`).join('');

  $('taskMeta').textContent=`المعادلة: التنفيذ السنوي × التكرار × المدة ÷ 60`;
  let tt=`<thead><tr><th class="n">#</th><th>المهمة</th><th>التردد</th><th class="n">التنفيذ السنوي</th><th class="n">التكرار</th><th class="n">مدة التنفيذ (د)</th><th class="n">الساعات السنوية</th><th class="n">النسبة من الإجمالي</th></tr></thead><tbody>`;
  let prev=-1;
  tasks.forEach(t=>{const L=LEVELS[t.li];
    tt+=`<tr class="${t.li!==prev&&prev!==-1?'lvl-start':''}"><td class="n">${t.no}</td><td>مهمة ${t.no}</td><td><span class="freq">${L.name}</span></td><td class="n">${L.F}</td><td class="n">${t.r}</td><td class="n">${t.d}</td><td class="n">${fmt(t.h,2)}</td><td class="n">${fmt(t.h/ev.H*100,2)}%</td></tr>`;prev=t.li;});
  tt+=`</tbody><tfoot><tr><td></td><td>الإجمالي</td><td></td><td></td><td></td><td></td><td class="n">${fmt(ev.H,2)}</td><td class="n">100%</td></tr></tfoot>`;
  $('taskTbl').innerHTML=tt;
  $('seedInfo').textContent=`رقم السيناريو: ${res.seed}`;
}

function readE(){
  const v=Number($('emp').value);
  if(!Number.isInteger(v)||v<3||v>150){$('err').textContent='أدخل عددًا صحيحًا من 3 إلى 150 موظفًا.';$('err').hidden=false;return null;}
  $('err').hidden=true; return v;
}
const readM=()=>Number($('mult').value);
function go(seed){const E=readE(); if(E==null) return; $('toast').hidden=true; render(run(E,seed,readM())); $('empty').hidden=true; $('results').hidden=false; $('alt').disabled=false; syncXls();}
const newSeed=()=>Math.floor(Math.random()*900000)+100000;

$('gen').addEventListener('click',()=>go(current&&current.E===readE()&&current.M===readM()?current.seed:newSeed()));
// «المستوى» داخل لوحة سجل البحث: تغييره يعيد التوليد فورًا بنفس رقم السيناريو
$('mult').addEventListener('change',()=>{ if(current) go(current.seed); });
$('alt').addEventListener('click',()=>go(newSeed()));
let typing=null;
$('emp').addEventListener('input',()=>{
  clearTimeout(typing); $('err').hidden=true;
  const raw=$('emp').value, v=Number(raw);
  const ok=raw!==''&&Number.isInteger(v)&&v>=3&&v<=150;
  $('tgt').textContent=ok?fmt(v*CAP):'—';
  if(current && !(ok && current.E===v)){
    current=null; $('results').hidden=true; $('empty').hidden=false;
    $('alt').disabled=true; syncXls(); $('toast').hidden=true;
  }
  if(raw!=='' && !ok) typing=setTimeout(()=>readE(),900);
});
$('emp').addEventListener('keydown',e=>{if(e.key==='Enter') go(newSeed());});

/* ---------- تنزيل الملف ----------
 * داخل Artifact على claude.ai: التنزيل المباشر محجوب، فنستخدم قدرة downloads.
 * خارج Claude (فتح index.html مباشرة أو استضافة عادية): رابط تنزيل عادي.
 */
let claudeDownloads=null;
$('xls').disabled=true; $('alt').disabled=true;
function syncXls(){$('xls').disabled=!(window.ExcelJS&&current);}

function saveWithLink(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

$('xls').addEventListener('click',async()=>{
  if(!current) return;
  const filename=`نموذج_عبء_العمل_${current.E}_موظف.xlsx`;
  try{
    const buf=await buildWorkbook(current);
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    if(claudeDownloads) await claudeDownloads.save({filename,data:blob});
    else saveWithLink(blob,filename);
    $('toast').textContent='تم حفظ الملف.'; $('toast').hidden=false;
  }catch(e){
    if(e&&e.code==='declined') return;
    $('toast').textContent=(e&&e.code==='rate_limited')?'نافذة حفظ مفتوحة بالفعل، أكملها أولًا.':'تعذّر التصدير في هذا العرض.';
    $('toast').hidden=false;
  }
});

if(!window.ExcelJS) $('xlsnote').hidden=false;
// يكتشف بيئة Claude Artifact إن وُجدت (لا شيء يتغير خارجها)
(async()=>{
  for(let i=0;i<10 && !(window.claude&&window.claude.use);i++) await new Promise(r=>setTimeout(r,150));
  try{ if(window.claude&&window.claude.use) claudeDownloads=await window.claude.use('downloads'); }catch(e){ claudeDownloads=null; }
})();

})();
