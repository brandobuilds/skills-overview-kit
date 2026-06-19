/* engine.js — the interactive "what should I do next?" workflow graph.
 * Generalized from gstack/compound: lays out any number of stages evenly,
 * draws the loop + feedback path, and drives the picker → recommendation panel.
 *
 * Reads window.__ENGINE__:
 *   {
 *     stages:  { key: { name, color } },        // color = hex or 'var(--x)'
 *     order:   [ stageKey, ... ],               // left-to-right loop order
 *     cmds:    { id: { stage, role, did, label?, next:[{cmd,primary?,why,cond?}] } },
 *     defaults:{ stageKey: cmdId },              // optional; node click target
 *     start:   cmdId,                            // initial selection
 *     loopNote:'…feeds the next sprint'          // optional feedback-path caption
 *   }
 * Targets: #loopsvg, #picker, #panel  (all provided empty by the template).
 */
(function () {
  var E = window.__ENGINE__;
  if (!E || !E.cmds || !E.order) return;
  var STAGES = E.stages, CMDS = E.cmds, ORDER = E.order;
  var svg = document.getElementById('loopsvg');
  var picker = document.getElementById('picker');
  var panel = document.getElementById('panel');
  if (!svg || !picker || !panel) return;

  var n = ORDER.length;
  var X0 = 92, X1 = 1108;
  var step = n > 1 ? (X1 - X0) / (n - 1) : 0;
  var NODE_X = {}; ORDER.forEach(function (s, i) { NODE_X[s] = Math.round(X0 + i * step); });
  var NUM = {}; ORDER.forEach(function (s, i) { NUM[s] = i + 1; });

  function label(id) { return (CMDS[id] && CMDS[id].label) || id; }
  function stageDefault(s) {
    if (E.defaults && E.defaults[s]) return E.defaults[s];
    for (var k in CMDS) if (CMDS[k].stage === s) return k;
    return null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---- build the SVG ---- */
  var firstX = NODE_X[ORDER[0]], lastX = NODE_X[ORDER[n - 1]], midX = Math.round((firstX + lastX) / 2);
  var arrows = '';
  for (var i = 0; i < n - 1; i++) {
    var a = NODE_X[ORDER[i]] + 46, b = NODE_X[ORDER[i + 1]] - 54;
    arrows += '<line x1="' + a + '" y1="96" x2="' + b + '" y2="96"/>';
  }
  var loopPath = 'M' + (lastX - 6) + ',124 C' + (lastX + 48) + ',205 ' + (lastX + 38) + ',232 ' + midX + ',232 ' +
                 'C' + (firstX - 48) + ',232 ' + (firstX - 42) + ',205 ' + (firstX + 6) + ',126';
  var nodes = '';
  ORDER.forEach(function (s) {
    var x = NODE_X[s], c = STAGES[s].color;
    nodes += '<g class="lnode" data-stage="' + s + '" role="button" tabindex="0" aria-label="Stage ' + NUM[s] + ': ' + esc(STAGES[s].name) + '">' +
      '<circle class="ring" cx="' + x + '" cy="96" r="49" fill="none" stroke="' + c + '" stroke-width="2"/>' +
      '<circle class="core" cx="' + x + '" cy="96" r="36" fill="#11192b" stroke="' + c + '" stroke-width="2.4"/>' +
      '<text x="' + x + '" y="104" text-anchor="middle" fill="' + c + '" font-size="24" font-weight="800">' + NUM[s] + '</text>' +
      '<text x="' + x + '" y="160" text-anchor="middle" fill="var(--ink)" font-size="16" font-weight="800">' + esc(STAGES[s].name) + '</text>' +
      '</g>';
  });
  svg.setAttribute('viewBox', '0 0 1200 250');
  svg.setAttribute('role', 'img');
  svg.innerHTML =
    '<defs>' +
      '<marker id="ah" markerWidth="9" markerHeight="9" refX="6.5" refY="3.2" orient="auto"><path d="M0,0 L7,3.2 L0,6.4 Z" fill="#43597f"/></marker>' +
      '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '</defs>' +
    '<line x1="' + firstX + '" y1="96" x2="' + lastX + '" y2="96" stroke="#1c2942" stroke-width="2"/>' +
    '<g stroke="#43597f" stroke-width="2.2" marker-end="url(#ah)" fill="none">' + arrows + '</g>' +
    '<path d="' + loopPath + '" fill="none" stroke="#f472b6" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" opacity=".7"/>' +
    (E.loopNote ? '<text x="' + midX + '" y="227" text-anchor="middle" fill="#7186a3" font-family="\'JetBrains Mono\',monospace" font-size="12">' + esc(E.loopNote) + '</text>' : '') +
    '<g id="loopnodes">' + nodes + '</g>';

  Array.prototype.forEach.call(svg.querySelectorAll('.lnode'), function (node) {
    var go = function () { var d = stageDefault(node.getAttribute('data-stage')); if (d) select(d); };
    node.addEventListener('click', go);
    node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  /* ---- build the picker ---- */
  var ph = '';
  ORDER.forEach(function (s) {
    var items = Object.keys(CMDS).filter(function (k) { return CMDS[k].stage === s; });
    if (!items.length) return;
    ph += '<div class="pg"><h5 style="color:' + STAGES[s].color + '"><i style="background:' + STAGES[s].color + '"></i>' + esc(STAGES[s].name) + '</h5>';
    items.forEach(function (k) { ph += '<button class="np-chip" data-cmd="' + esc(k) + '" style="--sc:' + STAGES[s].color + '">' + esc(label(k)) + '</button>'; });
    ph += '</div>';
  });
  picker.innerHTML = ph;
  Array.prototype.forEach.call(picker.querySelectorAll('.np-chip'), function (c) {
    c.addEventListener('click', function () { select(c.getAttribute('data-cmd')); });
  });

  /* ---- selection ---- */
  function setLoop(stage) {
    svg.classList.toggle('has-active', !!stage);
    Array.prototype.forEach.call(svg.querySelectorAll('.lnode'), function (node) {
      node.classList.toggle('active', node.getAttribute('data-stage') === stage);
    });
  }
  function setChip(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.np-chip'), function (c) {
      c.classList.toggle('active', c.getAttribute('data-cmd') === id);
    });
  }
  function select(id) {
    var d = CMDS[id]; if (!d) return;
    var st = d.stage, ac = STAGES[st].color;
    setLoop(st); setChip(id);
    var cards = (d.next || []).map(function (nx) {
      var dest = CMDS[nx.cmd] || { stage: st }; var ds = dest.stage, dc = STAGES[ds] ? STAGES[ds].color : ac;
      return '<button class="np-card' + (nx.primary ? ' primary' : '') + '" data-cmd="' + esc(nx.cmd) + '" style="--dc:' + dc + '">' +
        (nx.primary ? '<span class="np-badge">▸ recommended</span>' : '') +
        (nx.cond ? '<span class="np-cond">if ' + esc(nx.cond) + '</span>' : '') +
        '<span class="np-destcmd">' + esc(label(nx.cmd)) + '</span>' +
        '<span class="np-deststage">' + esc(STAGES[ds] ? STAGES[ds].name : '') + '</span>' +
        '<p class="np-why">' + esc(nx.why) + '</p></button>';
    }).join('');
    panel.style.setProperty('--ac', ac);
    panel.innerHTML =
      '<div class="np-now" style="--ac:' + ac + '">' +
        '<span class="tag">Stage ' + NUM[st] + ' · ' + esc(STAGES[st].name) + '</span>' +
        '<div class="youran">you just ran</div>' +
        '<h3>' + esc(label(id)) + '</h3>' +
        '<div class="role">' + esc(d.role || '') + '</div>' +
        '<p class="did"><b>✓</b> ' + esc(d.did || '') + '</p>' +
      '</div>' +
      '<div class="np-nextlabel">Do this next</div>' +
      '<div class="np-cards">' + cards + '</div>' +
      '<div class="np-foot"><button class="np-reset" id="resetbtn">↻ Start fresh</button><span>Tip: click a card to walk forward through the workflow.</span></div>';
    Array.prototype.forEach.call(panel.querySelectorAll('.np-card'), function (c) {
      c.addEventListener('click', function () { select(c.getAttribute('data-cmd')); });
    });
    var reset = panel.querySelector('#resetbtn');
    if (reset) reset.addEventListener('click', function () { select(E.start || ORDER.length && stageDefault(ORDER[0])); });
  }

  select(E.start || stageDefault(ORDER[0]));
})();
