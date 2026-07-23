import { chromium } from 'playwright'
const PANEL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html'
async function useSuper(page){
  await page.route('**/plugin/wax-wallet/cmd', async (route)=>{
    let cmd=''; try{cmd=JSON.parse(route.request().postData()||'{}').cmd}catch{}
    if(cmd!=='status') return route.continue()
    const res=await route.fetch(); const body=await res.json()
    for(const a of body?.status?.accounts??[]) a.selected = a.account==='waxwingsuper'&&a.permission==='active'
    await route.fulfill({response:res, body:JSON.stringify(body)})
  })
}
const b=await chromium.launch({headless:true})
const p=await b.newPage({viewport:{width:1280,height:900}})
await useSuper(p)
await p.goto(PANEL,{waitUntil:'networkidle'})
await p.click('button:has-text("Connect via waxwing")')
await p.waitForSelector('button:has-text("Breeding")',{timeout:20000})
await p.click('button:has-text("Breeding")')
await p.waitForSelector('button[aria-pressed]',{timeout:20000})
await p.waitForTimeout(1500)
const atRest = await p.$$eval('button[aria-pressed]', els=>({
  img: els.filter(e=>e.querySelector('img')&&!e.querySelector('svg')).length,
  svg: els.filter(e=>e.querySelector('svg')).length
}))
// hover the FIRST unselected card
const cards = await p.$$('button[aria-pressed]')
let target=null
for(const c of cards){ if((await c.getAttribute('aria-pressed'))==='false'){target=c;break} }
await target.hover()
await p.waitForTimeout(400)
const hoveredIsSvg = await target.evaluate(e=>!!e.querySelector('svg') && !e.querySelector('img'))
// move away
await p.mouse.move(5,5)
await p.waitForTimeout(500)
const backToImg = await target.evaluate(e=>!!e.querySelector('img') && !e.querySelector('svg'))
console.log(JSON.stringify({atRest, hoveredIsSvg, backToImg}))
await b.close()
