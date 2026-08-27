// Dependency-free CDP driver: launches Chrome headless, evaluates JS, takes screenshots.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;
const fileUrl = 'file://' + path.resolve(process.argv[2] || 'tetris.html');
const scriptFile = process.argv[3]; // js to evaluate in page (async)

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map(); this.sessions = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)){
        const {resolve, reject} = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params={}, sessionId){
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.ws.send(JSON.stringify({id, method, params, sessionId}));
    });
  }
}

(async () => {
  // fresh profile dir
  const prof = fs.mkdtempSync('/tmp/chrome-cdp-');
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port='+PORT,
    '--user-data-dir='+prof, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--window-size=900,820',
    '--force-device-scale-factor=2', 'about:blank'
  ], {stdio:'ignore'});

  // wait for devtools endpoint
  let target;
  for (let i=0;i<50;i++){
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.url === "about:blank" || t.type === "page");
      if (target) break;
    } catch(e){}
    await wait(200);
  }
  if (!target) throw new Error('devtools never came up');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    {width:900, height:820, deviceScaleFactor:2, mobile:false});

  const pageErrors = [];
  cdp.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown')
      pageErrors.push(m.params.exceptionDetails.exception?.description || JSON.stringify(m.params).slice(0,300));
  });

  await cdp.send('Page.navigate', {url: fileUrl});
  await wait(1200);

  async function evalJS(expression){
    const r = await cdp.send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0,400));
    return r.result.value;
  }

  // run the supplied probe script inside the page
  const probe = fs.readFileSync(scriptFile, 'utf8');
  const results = await evalJS(`(async () => { ${probe} })()`);

  async function shot(name){
    const r = await cdp.send('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(name, Buffer.from(r.data, 'base64'));
    console.log('wrote', name);
  }

  console.log('RESULTS:', JSON.stringify(results, null, 2));
  console.log('PAGE ERRORS:', pageErrors.length ? pageErrors : 'none');

  await shot('shot_ingame.png');

  // paused overlay
  await evalJS(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}))`);
  await wait(250);
  await shot('shot_paused.png');

  chrome.kill();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
