// Owns native read-only network semantics of the deployed walk; retire with its guard.
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import test from 'node:test';
import {loadPlaywright} from '../scripts/clip-studio/tools.mjs';
import {installReadOnlyBrowser, installNativeWriteGuard, probeTelemetry, launchReadOnlyBrowser} from '../scripts/read-only-browser.mjs';

test('native browser reads, navigation and telemetry containment preserve real CORS and refuse writes', async () => {
  let origin, otherOrigin, scenario;
  const requests = [];
  const other = http.createServer((request, response) => {
    requests.push({side:'other',method:request.method,path:request.url});
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'x-product-header');
    if (request.method === 'OPTIONS') return response.writeHead(scenario === 'cors-denied' ? 403 : 204).end();
    if (request.url === '/script.js') return response.writeHead(200, {'content-type':'application/javascript'}).end('window.externalLoaded=true;');
    response.end('native read');
  });
  const shadowForm = target => `<div id="host"></div><script>const root=document.querySelector('#host').attachShadow({mode:'closed'});root.innerHTML='<form action="/save" method="POST" ${target ? 'target="_blank"' : ''}><button>Submit</button></form>';setTimeout(()=>root.querySelector('button').click(),20)</script>`;
  const pages = {
    healthy:()=>'<h1>Healthy</h1>',
    'cors-denied':()=>`<h1>Healthy</h1><script>fetch('${otherOrigin}/read',{headers:{'x-product-header':'1'}}).then(r=>r.text()).then(t=>window.read=t).catch(()=>window.denied=true)</script>`,
    'cors-allowed':()=>pages['cors-denied'](),
    script:()=>`<h1>Healthy</h1><script src="${otherOrigin}/script.js"></script>`,
    write:()=>'<h1>Healthy</h1><script>fetch("/save",{method:"POST"}).catch(()=>{})</script>',
    shadow:()=>'<h1>Healthy</h1>'+shadowForm(false),
    ping:()=>'<h1>Healthy</h1><a href="#done" ping="/ping" id="link">Read</a><script>setTimeout(()=>document.querySelector("#link").click(),20)</script>',
    csp:()=>'<h1>Healthy</h1><img src="/pixel.svg">',
    popup:()=>'<h1>Healthy</h1><script>setTimeout(()=>window.open("/popup-child/"),20)</script>',
    blank:()=>'<h1>Healthy</h1>'+shadowForm(true),
    link:()=>'<a href="/destination" id="link">Read</a><script>setTimeout(()=>document.querySelector("#link").click(),20)</script>',
    form:()=>'<form action="/destination" method="GET" id="form"></form><script>setTimeout(()=>document.querySelector("#form").requestSubmit(),20)</script>',
    telemetry:()=>`<h1>Healthy</h1><script src="https://fixture.clarity.ms/tag/demo"></script><script>fetch("/api/portfolio-insight",{method:"POST"});fetch("/cdn-cgi/rum");fetch('${otherOrigin}/cdn-cgi/rum',{method:'POST'});navigator.sendBeacon("/api/portfolio-insight","test")</script>`,
  };
  const server = http.createServer((request, response) => {
    requests.push({side:'main',method:request.method,path:request.url});
    if (request.method !== 'GET') return response.writeHead(204).end();
    if (request.url === '/favicon.ico') return response.writeHead(204).end();
    if (request.url.startsWith('/destination')) return response.writeHead(200, {'content-type':'text/html'}).end('<h1>Destination</h1>');
    if (request.url === '/pixel.svg') return response.writeHead(200, {'content-type':'image/svg+xml'}).end('<svg xmlns="http://www.w3.org/2000/svg"/>');
    if (request.url === '/popup-child/') { response.setHeader('Content-Security-Policy-Report-Only', "img-src 'none'; report-uri /popup-save"); return response.end('<img src="/pixel.svg">'); }
    if (scenario === 'csp') response.setHeader('Content-Security-Policy-Report-Only', "img-src 'none'; report-uri /csp-report");
    response.writeHead(200, {'content-type':'text/html'}).end(pages[scenario]());
  });
  let browser;
  try {
    server.listen(0,'127.0.0.1'); await once(server,'listening'); origin=`http://127.0.0.1:${server.address().port}`;
    other.listen(0,'127.0.0.1'); await once(other,'listening'); otherOrigin=`http://127.0.0.1:${other.address().port}`;
    browser=await launchReadOnlyBrowser(loadPlaywright().chromium);
    for (const mode of Object.keys(pages)) {
      scenario=mode; requests.length=0;
      const context=await browser.newContext({serviceWorkers:'block'}), violations=[];
      try {
        const telemetry=probeTelemetry(origin), record=value=>violations.push(value);
        await context.exposeBinding('bivReadOnlyViolation',(_source,value)=>record(value));
        await context.addInitScript(installReadOnlyBrowser,{reportName:'bivReadOnlyViolation',telemetry});
        const page=await context.newPage(); await installNativeWriteGuard(page,record,telemetry);
        await page.goto(origin); await page.waitForTimeout(350);
        assert(!requests.some(request=>request.method==='POST'), mode+': no native or page POST may reach a server');
        if (mode==='cors-denied') {
          assert.equal(await page.evaluate('window.denied'),true);
          assert(requests.some(request=>request.side==='other' && request.method==='OPTIONS'));
          assert(!requests.some(request=>request.side==='other' && request.method==='GET'));
        } else if (mode==='cors-allowed') {
          assert.equal(await page.evaluate('window.read'),'native read');
          assert(requests.some(request=>request.side==='other' && request.method==='OPTIONS'));
          assert(requests.some(request=>request.side==='other' && request.method==='GET'));
        } else if (mode==='script') assert.equal(await page.evaluate('window.externalLoaded'),true);
        else if (['write','shadow','ping','csp'].includes(mode)) assert(violations.some(value=>!value.unavailable),mode+': refused write must be reported');
        else if (['popup','blank'].includes(mode)) {
          assert(violations.some(value=>value.unavailable),mode+': new-target coverage must fail explicitly');
          assert(!requests.some(request=>request.path==='/popup-child/'), 'new target cannot make its first read');
        } else if (['link','form'].includes(mode)) {
          assert.equal(await page.textContent('h1'),'Destination');
          assert.equal(violations.length,0,'ordinary GET navigation must remain real');
        } else if (mode==='telemetry') {
          assert(!requests.some(request=>/portfolio-insight|cdn-cgi/.test(request.path)),'telemetry remains local');
          assert.equal(violations.length,0);
        } else assert.equal(violations.length,0);
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); await new Promise(resolve=>other.close(resolve)); }
});


test('the read-only launcher refuses studio or personal browser overrides before launch', () => {
  let launched = false;
  const chromium = { launch() { launched = true; } };
  for (const options of [{ executablePath: '/unmanaged/full-chrome' }, { channel: 'chrome' }, { headless: false }]) {
    assert.throws(() => launchReadOnlyBrowser(chromium, options), /bundled headless shell/);
  }
  assert.equal(launched, false);
});
