// Owns wrong-versus-unavailable precedence at the actual browser action point;
// retire with createBrowserCheck.
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import test from 'node:test';
import {createBrowserCheck} from '../scripts/live-browser.mjs';
import {WrongAnswer} from '../scripts/live-result.mjs';
import {launchReadOnlyBrowser} from '../scripts/read-only-browser.mjs';
import {loadPlaywright,cachedBrowser} from '../scripts/clip-studio/tools.mjs';

test('actual browser observation keeps explicit unsupported capability3 separate from induced JS wrong1', async () => {
  let mode, writes = 0;
  const server=http.createServer((request,response)=>{if(request.method!=='GET')writes++;return response.writeHead(200,{'content-type':'text/html'}).end('<h1>Healthy</h1>'+({
    worker:'<script>new Worker("/worker.js")</script>',
    popup:'<script>window.open("/popup/").document.title="Child"</script>',
    write:'<script>fetch("/save",{method:"POST"}).catch(()=>{});new Worker("/worker.js")</script>',
    script:'<script>throw new Error("Real UI defect")</script>',
    hidden:'<style>body{display:none}</style>',
    opacity:'<style>body{opacity:0}</style>',
    healthy:'',
  }[mode]));});
  let browser;
  try {
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    const playwright=loadPlaywright();browser=await launchReadOnlyBrowser(playwright.chromium,{headless:true,executablePath:cachedBrowser()??undefined});
    const observe=createBrowserCheck({browser,playwright,base,check:(_name,run)=>run()});
    for(const [scenario,expected] of [['healthy',0],['worker',3],['popup',3],['write',1],['script',1],['hidden',1],['opacity',1]]){
      mode=scenario;
      let code=0;
      try {await observe('fixture '+mode,async page=>{await page.goto(base);await page.waitForTimeout(150);});}
      catch(error){code=error instanceof WrongAnswer?1:3;}
      assert.equal(code,expected,scenario);
      assert.equal(writes,0,'classification must not require a delivered write');
    }
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
