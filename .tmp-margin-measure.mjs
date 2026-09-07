import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { renderPreviewHtml } from './packages/exporter/src/index.ts';
import { catalogModernStore } from '@solara/project-schema/catalog-modern-fixture';
const browser=await chromium.launch({headless:true});
const out=[];
for (const [name,path] of [['home','/'],['category','/categoria/remeras/'],['product','/producto/remera-basica/']]) {
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 await p.setContent(renderPreviewHtml(catalogModernStore,'draft',path));
 const data=await p.evaluate(() => {
  const result={};
  for (const sel of ['.solara-container','main','section','[data-solara-module]']) {
   result[sel]=Array.from(document.querySelectorAll(sel)).slice(0,10).map((e)=>{
    const r=e.getBoundingClientRect(); const c=getComputedStyle(e);
    return {tag:e.tagName, cls:String(e.className).slice(0,60), x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), mt:c.marginTop, mb:c.marginBottom, pl:c.paddingLeft, pr:c.paddingRight, pt:c.paddingTop, pb:c.paddingBottom};
   });
  }
  return result;
 });
 out.push({name,data}); await p.close();
}
await browser.close();
writeFileSync('.tmp-margin-results.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
