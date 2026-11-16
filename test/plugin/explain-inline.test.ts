import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Window } from "happy-dom";
import { createRepoFixture } from "../support/fixtures";

const skill = await Bun.file(new URL("../../dist/plugin-skills/explain-inline/SKILL.md", import.meta.url)).text();
const template = skill.split('<!-- EXPLAIN_PAGE_START -->\n```html\n')[1].split('\n```\n<!-- EXPLAIN_PAGE_END -->')[0];
const recipe = skill.match(/```ts\n([\s\S]*?)\n```/)![1];
const fixtureData = await Bun.file(new URL("fixtures/explanation.json", import.meta.url)).json();

async function page(data: unknown) {
  const window = new Window();
  window.document.body.innerHTML = template.replace(/<script[\s\S]*?<\/script>/g, '');
  const input = window.document.createElement('script'); input.id = 'explain-data'; input.type = 'application/json'; input.textContent = JSON.stringify(data); window.document.body.append(input);
  // The player timer is captured so tests advance it by hand and can see it being cleared.
  const timers = { tick: null as null | (() => void), cleared: 0 };
  (window as any).setInterval = (fn: () => void) => { timers.tick = fn; return 1; };
  (window as any).clearInterval = () => { timers.tick = null; timers.cleared++; };
  // DOM-only tests omit Mermaid; the real pinned renderer is checked in the offline
  // browser run. The runtime reaches browser APIs through window only.
  const runtime = template.match(/<script>([\s\S]*?)<\/script>/)![1];
  new Function("window", "document", runtime)(window, window.document);
  await window.happyDOM.whenAsyncComplete();
  return { window, timers };
}
const classes = (node: any) => (node.getAttribute('class') ?? '').split(/\s+/);
const click = (scope: any, label: string) => [...scope.querySelectorAll('button')].find((b: any) => b.textContent === label)!.click();

test("single exported skill extracts offline HTML and preserves hostile code exactly", async () => {
  const fixture = await createRepoFixture('ah-explain-single-file-');
  try {
    const installed = await fixture.writeText('SKILL.md', skill);
    const renderer = await fixture.writeText('render.ts', recipe);
    const hostile = '</script><img src=x onerror=alert(1)> $& $` $\' {{ secret }} {% include "x" %}';
    const input = await fixture.writeText('data.json', JSON.stringify({components:[{type:'TourStop',title:'Literal',path:'x.ts',symbol:'x',code:hostile,consequence:'Literal text'}]}));
    const output = fixture.filePath('page.html');
    const child = Bun.spawn([process.execPath,renderer,installed,input,output],{cwd:fixture.rootDir,stdout:'pipe',stderr:'pipe'});
    expect(await child.exited).toBe(0);
    const html = await Bun.file(output).text();
    expect(html).not.toContain('<img src=x');
    expect(JSON.parse(html.match(/id="explain-data"[^>]*>([\s\S]*?)<\/script>/)![1]).components[0].code).toBe(hostile);
    const overwrite = Bun.spawn([process.execPath,renderer,installed,input,input],{cwd:fixture.rootDir,stdout:'pipe',stderr:'pipe'});
    expect(await overwrite.exited).not.toBe(0);
  } finally { await fixture.cleanup(); }
});

test("Pele is embedded with pinned hash, full notices, and no remote script loader", () => {
  const bundle = template.match(/id="pele-bundle"[^>]*data-sha256="([^"]+)"[^>]*>([^<]+)</)!;
  const decoded = Bun.gunzipSync(Buffer.from(bundle[2], 'base64'));
  expect(createHash('sha256').update(decoded).digest('hex')).toBe(bundle[1]);
  expect(bundle[1]).toBe('0b0a46c57a5a6971670c09f5ec4066705bd78505f90fd11adf6260325efa0910');
  expect(skill).toContain('Copyright (c) 2026 kepano');
  expect(skill).toContain('Copyright (c) 2026 Lucide Icons and Contributors');
  expect(template).not.toMatch(/<script[^>]+src=/);
});

test("lifecycle shows directed wires and moves the active state through them", async () => {
  const { window, timers } = await page({components:fixtureData.components.filter((c: {type:string}) => c.type === 'Lifecycle')});
  try {
    const lc = window.document.querySelector('[data-component=Lifecycle]') as any;
    const wire = (id: string) => lc.querySelector(`.gx-wires [data-edge="${id}"]`), node = (id: string) => lc.querySelector(`[data-node=${id}]`);
    expect(lc.querySelectorAll('.gx-wires .wire')).toHaveLength(6);
    expect(lc.querySelectorAll('.gx-wires .wire polygon')).toHaveLength(6); // one arrowhead each
    expect(wire('browser->controller').getAttribute('data-from')).toBe('browser');
    expect(wire('browser->controller').getAttribute('data-to')).toBe('controller');
    expect(wire('respond').getAttribute('data-kind')).toBe('under'); // a reply is a return arc
    expect(classes(wire('controller->queue'))).toContain('async');
    // Step 1: only the first wire is active and carries the moving marker.
    expect(classes(wire('browser->controller'))).toContain('active');
    expect([...lc.querySelectorAll('.token')].map((t: any) => t.dataset.edge)).toEqual(['browser->controller']);
    expect(node('browser').dataset.state).toBe('active');
    expect(classes(node('controller'))).toContain('arrive');
    expect(node('queue').dataset.state).toBe('idle');
    click(lc, 'Next');
    expect(classes(wire('browser->controller'))).toContain('done');
    expect(classes(wire('controller->queue'))).toContain('active');
    expect([...lc.querySelectorAll('.token')].map((t: any) => t.dataset.edge)).toEqual(['controller->queue']);
    expect(node('browser').dataset.state).toBe('done');
    expect(lc.querySelector('.count').textContent).toBe('2 / 7');
    click(lc, 'Previous');
    expect(lc.dataset.step).toBe('1');
    // Play advances on the timer, shows the failure step, and stops at the end.
    click(lc, 'Play');
    expect(lc.dataset.playing).toBe('true');
    expect([...lc.querySelectorAll('button')].some((b: any) => b.textContent === 'Pause')).toBe(true);
    for (let i = 0; i < 4; i++) timers.tick!();
    expect(lc.dataset.step).toBe('5');
    expect(lc.hasAttribute('data-failure')).toBe(true);
    expect(lc.querySelector('.caption .badge.fail')).not.toBeNull();
    click(lc, 'Pause');
    expect(timers.tick).toBeNull();
    expect(lc.dataset.playing).toBe('false');
    const pausedToken = lc.querySelector('.token');
    click(lc, 'Play');
    expect(lc.querySelector('.token')).toBe(pausedToken); // resume must not rewind the marker
    timers.tick!(); timers.tick!();
    expect(lc.dataset.step).toBe('7');
    expect(lc.dataset.playing).toBe('true'); // final transfer gets its full interval
    timers.tick!();
    expect(timers.tick).toBeNull(); // timer cleared after the final transfer
    expect([...lc.querySelectorAll('.token')].map((t: any) => t.dataset.edge).sort()).toEqual(['queue->worker', 'worker->mailer']);
    expect([...lc.querySelectorAll('button')].some((b: any) => b.textContent === 'Replay')).toBe(true);
    click(lc, 'Reset');
    expect(lc.dataset.step).toBe('1');
    expect(classes(wire('worker->mailer'))).toContain('idle');
    (lc.querySelectorAll('.dots button')[2] as any).click();
    expect(lc.dataset.step).toBe('3');
    expect(lc.querySelector('.dots [aria-current=step]').getAttribute('aria-label')).toContain('Step 3');
    // A detached player clears its timer instead of running forever.
    click(lc, 'Play'); lc.remove(); timers.tick!();
    expect(timers.tick).toBeNull();
  } finally { await window.happyDOM.close(); }
});

test("code map keeps before/after correct and details focused on the selection", async () => {
  const { window } = await page({components:fixtureData.components.filter((c: {type:string}) => c.type === 'CodeMap')});
  try {
    const map = window.document.querySelector('[data-component=CodeMap]') as any;
    const edges = () => [...map.querySelectorAll('.gx-wires .wire')].map((w: any) => w.getAttribute('data-edge')).sort();
    expect(edges()).toEqual(['controller->job', 'job->mailer']); // After is the default view
    expect(map.querySelector('.map-detail').textContent).toContain('ReceiptJob.perform_later(order.id)');
    click(map, 'Before');
    expect(map.querySelector('[data-node=job]').hasAttribute('data-off')).toBe(true);
    expect(map.querySelector('[data-node=job]').disabled).toBe(true);
    expect(edges()).toEqual(['controller->mailer']);
    expect(map.querySelector('.gx-labels').textContent).toBe('send immediately');
    click(map, 'All');
    expect(edges()).toHaveLength(3);
    expect(classes(map.querySelector('[data-edge="controller->mailer"]'))).toContain('removed');
    expect(map.querySelector('[data-edge="controller->mailer"]').getAttribute('data-kind')).toBe('over');
    click(map, 'After');
    map.querySelector('[data-node=job]').click();
    expect(map.querySelector('[data-node=job]').getAttribute('aria-pressed')).toBe('true');
    const detail = map.querySelector('.map-detail');
    expect(detail.textContent).toContain('app/jobs/receipt_job.rb');
    expect(detail.textContent).toContain('Order.find(order_id)');
    expect(detail.textContent).not.toContain('send immediately');
    expect(classes(map.querySelector('[data-edge="controller->job"]'))).toContain('focus');
    // Connection buttons navigate to the neighbor.
    [...detail.querySelectorAll('.links button')].find((b: any) => b.textContent.includes('Receipt mailer'))!.click();
    expect(map.querySelector('[data-node=mailer]').getAttribute('aria-pressed')).toBe('true');
    expect(map.querySelector('.connections')).toBeNull(); // no duplicate list of every edge
  } finally { await window.happyDOM.close(); }
});

test("tour, chart, stat, callout and steps render from the fixture", async () => {
  const { window } = await page({components:fixtureData.components.filter((c: {type:string}) => !['Mermaid','Lifecycle','CodeMap'].includes(c.type))});
  try {
    const doc = window.document;
    expect(doc.querySelector('[role=alert]')).toBeNull();
    const stops = [...doc.querySelectorAll('[data-component=TourStop]')] as any[];
    expect(stops.map(s => s.open)).toEqual([true, false]);
    expect(stops[0].querySelector('summary').textContent).toContain('orders_controller.rb:11');
    click(doc, 'Expand all');
    expect(stops.every(s => s.open)).toBe(true);
    expect(doc.querySelectorAll('.chart')).toHaveLength(2);
    expect(doc.querySelectorAll('.chart .hit[aria-label="Before: 840"]')).toHaveLength(1);
    expect(doc.querySelectorAll('[data-component=Stat]')).toHaveLength(3);
    expect(doc.querySelectorAll('.steps li')).toHaveLength(3);
    expect(doc.querySelector('.callout.warning')).not.toBeNull();
  } finally { await window.happyDOM.close(); }
});

test("Diff is gone and the skill points to BB's own diff rendering", async () => {
  expect(template).not.toContain('renderers.Diff');
  expect(skill).toContain('There is no Diff component');
  expect(skill).toContain('`bb git diff`');
  expect(skill).not.toMatch(/::diff|inline-diff\{/);
  const { window } = await page({components:[{type:'Diff',title:'x',patch:'@@ -1 +1 @@\n-a\n+b'}]});
  try {
    const alert = window.document.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('Unknown component: Diff');
    expect(alert.textContent).toContain('CodeTour');
  } finally { await window.happyDOM.close(); }
});

test("each documented Mermaid type has guidance and a fixture example", () => {
  const charts = fixtureData.components.filter((c: {type:string}) => c.type === 'Mermaid').map((c: {chart:string}) => c.chart.split(/[\s\n]/)[0]);
  for (const kind of ['flowchart', 'sequenceDiagram', 'stateDiagram-v2', 'erDiagram', 'classDiagram']) {
    expect(charts).toContain(kind);
    expect(skill).toContain('`' + kind);
  }
});

test("invalid components show errors and code stays inert", async () => {
  const code = '<img src=x onerror="window.injected=true">';
  const { window } = await page({components:[
    {type:'TourStop',title:'x',path:'a.ts',symbol:'x',code,consequence:'literal'},
    {type:'Lifecycle',nodes:[{id:'a',label:'A'}],edges:[{from:'a',to:'b'}],steps:[{caption:'bad'}]},
    {type:'Lifecycle',nodes:[{id:'a',label:'A'}],edges:[{from:'a',to:'a'}],steps:[{caption:'self'}]},
    {type:'Chart',kind:'bar',data:[{label:'bad',value:'12'}]},
    {type:'__proto__'},
  ]});
  try {
    expect(window.document.querySelectorAll('[role=alert]')).toHaveLength(4);
    expect(window.document.querySelector('img')).toBeNull();
    expect(window.document.querySelector('code')!.textContent).toBe(code);
  } finally { await window.happyDOM.close(); }
});
