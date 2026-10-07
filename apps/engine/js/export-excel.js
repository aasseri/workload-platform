/**
 * export-excel.js — بناء ملف Excel للنموذج (ExcelJS)
 * يعمل في المتصفح (window.WorkloadExport) وفي Node (require) لاختبار الملف.
 * المدخل: ناتج WorkloadEngine.run(). المخرج: ArrayBuffer لملف xlsx.
 */
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('exceljs'));
  else root.WorkloadExport = factory(root.WorkloadEngine, root.ExcelJS);
})(typeof self !== 'undefined' ? self : this, function(Engine, ExcelJS){
'use strict';
const {LEVELS} = Engine;

async function buildWorkbook(res){
  const {E,best}=res, tasks=best.tasks, ev=best.ev;
  const n=tasks.length, last=n+1, totRow=n+2;
  const FONT='Sakkal Majalla', NAVY='FF1B2C55', GOLD='FFB8892B', GOLDSOFT='FFF6EEDB', ZEBRA='FFF5F6F9', LINE='FF9AA4BD';
  const thin={style:'thin',color:{argb:LINE}};
  const box={top:thin,bottom:thin,left:thin,right:thin};
  const headStyle=c=>{c.font={name:FONT,size:14,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=box;};
  const bodyStyle=(c,fill)=>{c.font={name:FONT,size:14,color:{argb:'FF14203A'}};c.alignment={horizontal:'center',vertical:'middle'};c.border=box;if(fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};};

  const wb=new ExcelJS.Workbook();
  wb.creator='AHMAD ZYAD';

  // sheet order: 'بيانات الجهة' first, then 'المهام'
  const ps={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,printTitlesRow:'1:1',margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.3,footer:0.3}};
  const DS_HEAD=5, DS_END=2000; // header row of the employees table in 'بيانات الجهة', and the counted range end
  const ds=wb.addWorksheet('بيانات الجهة',{views:[{rightToLeft:true,state:'frozen',ySplit:DS_HEAD}],pageSetup:{...ps,orientation:'landscape',printTitlesRow:`${DS_HEAD}:${DS_HEAD}`}});
  const ws=wb.addWorksheet('المهام',{views:[{rightToLeft:true,state:'frozen',ySplit:1}],pageSetup:ps});

  // ---- tasks ----
  ws.columns=[{width:7},{width:13},{width:13},{width:15},{width:13},{width:19},{width:17},{width:19}];
  const hr=ws.addRow(['#','المهمة','التردد','التنفيذ السنوي','التكرار','مدة التنفيذ بالدقائق','الساعات السنوية','النسبة من الإجمالي']);
  hr.height=30; hr.eachCell(headStyle);
  let band=false, prevLi=-1;
  tasks.forEach((t,i)=>{
    const r=i+2;
    if(t.li!==prevLi){band=!band;prevLi=t.li;}
    const row=ws.addRow([t.no,'مهمة '+t.no,LEVELS[t.li].name,{formula:`IFERROR(CHOOSE(MATCH(C${r},{${LEVELS.map(l=>'"'+l.name+'"').join(',')}},0),${LEVELS.map(l=>l.F).join(',')}),0)`,result:t.F},t.r,t.d,
      {formula:`D${r}*E${r}*F${r}/60`,result:+t.h.toFixed(4)},
      {formula:`G${r}/$G$${totRow}`,result:t.h/ev.H}]);
    row.height=22;
    row.eachCell({includeEmpty:true},c=>bodyStyle(c,band?ZEBRA:null));
    row.getCell(7).numFmt='#,##0.00'; row.getCell(8).numFmt='0.00%';
    row.getCell(3).dataValidation={type:'list',allowBlank:false,showErrorMessage:true,errorTitle:'قيمة غير صحيحة',error:'اختر التردد من القائمة',formulae:['"'+LEVELS.map(l=>l.name).join(',')+'"']};
    if(i>0 && tasks[i-1].li!==t.li) row.eachCell(c=>{c.border={...box,top:{style:'medium',color:{argb:GOLD}}};});
  });
  const tr=ws.addRow(['','الإجمالي','','','','',{formula:`SUM(G2:G${last})`,result:ev.H},{formula:`SUM(H2:H${last})`,result:1}]);
  tr.height=26;
  tr.eachCell({includeEmpty:true},c=>{bodyStyle(c,GOLDSOFT);c.font={name:FONT,size:14,bold:true,color:{argb:'FF14203A'}};c.border={...box,top:{style:'medium',color:{argb:GOLD}},bottom:{style:'medium',color:{argb:GOLD}}};});
  tr.getCell(7).numFmt='#,##0.00'; tr.getCell(8).numFmt='0.00%';

  // ---- summary below the tasks table: actual headcount vs. need ----
  const sumRow=(label,value,fmt)=>{
    const row=ws.addRow(['',label,'','','','',value]);
    row.height=24;
    ws.mergeCells(`B${row.number}:F${row.number}`);
    [2,3,4,5,6,7].forEach(k=>{const c=row.getCell(k);bodyStyle(c,GOLDSOFT);c.font={name:FONT,size:14,bold:true,color:{argb:'FF14203A'}};});
    row.getCell(7).numFmt=fmt;
  };
  ws.addRow([]);
  sumRow('العدد الفعلي',{formula:`SUMPRODUCT(--(('بيانات الجهة'!A${DS_HEAD+1}:A${DS_END}<>"")+('بيانات الجهة'!B${DS_HEAD+1}:B${DS_END}<>"")>0))`,result:0},'0');
  sumRow('الاحتياج',{formula:`G${totRow}/${Engine.CAP}`,result:ev.H/Engine.CAP},'0.00');

  // ---- unit data ----
  ds.columns=[{width:15},{width:32},{width:10},{width:12},{width:26},{width:26},{width:28}];
  // unit info block
  const ih=ds.addRow(['معلومات الجهة']);
  ds.mergeCells('A1:G1'); ih.height=28; for(let k=1;k<=7;k++) headStyle(ih.getCell(k));
  ['اسم الجهة','مسؤول الجهة'].forEach(label=>{
    const row=ds.addRow([label]);
    row.height=24;
    ds.mergeCells(`B${row.number}:G${row.number}`);
    const k=row.getCell(1); bodyStyle(k,GOLDSOFT); k.font={name:FONT,size:14,bold:true,color:{argb:'FF14203A'}};
    for(let k=2;k<=7;k++) bodyStyle(row.getCell(k));
    row.getCell(2).alignment={horizontal:'right',vertical:'middle'};
  });
  ds.addRow([]);
  const dh=ds.addRow(['الرقم الوظيفي','الاسم','الجنس','المرتبة','المسمى الوظيفي','المسمى الفعلي','الجهة الفعلية']);
  dh.height=30; dh.eachCell(headStyle);
  for(let i=0;i<E;i++){
    const row=ds.addRow(['','','','','','','']);
    row.height=22;
    row.eachCell({includeEmpty:true},c=>bodyStyle(c,i%2?ZEBRA:null));
    row.getCell(1).numFmt='@';
    row.getCell(3).dataValidation={type:'list',allowBlank:true,formulae:['"ذكر,أنثى"']};
  }
  return wb.xlsx.writeBuffer();
}


return {buildWorkbook};
});
