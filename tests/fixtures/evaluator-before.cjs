// Baseline geometry evaluator; UI wording follows the current child-facing copy.
/* Geometry is independent of the screen and input event frequency. */
(function (root) {
  'use strict';
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function length(points) {
    return points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
  }
  function resample(points, step = 2) {
    if (!points.length) return [];
    const result = [{ ...points[0] }];
    let carried = 0;
    for (let i = 1; i < points.length; i++) {
      let from = points[i - 1];
      const to = points[i];
      let span = distance(from, to);
      while (span > 0 && carried + span >= step) {
        const ratio = (step - carried) / span;
        from = { x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio,
          t: (from.t || 0) + ((to.t || 0) - (from.t || 0)) * ratio };
        result.push(from);
        span = distance(from, to);
        carried = 0;
      }
      carried += span;
    }
    const last = points[points.length - 1];
    if (distance(result[result.length - 1], last) > 0.001) result.push({ ...last });
    return result;
  }
  function pointToLine(point, a, b) {
    const square = distance(a, b) ** 2;
    const t = square ? Math.max(0, Math.min(1,
      ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / square)) : 0;
    return distance(point, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  function nearest(point, line) {
    let value = Infinity;
    for (let i = 1; i < line.length; i++) value = Math.min(value, pointToLine(point, line[i - 1], line[i]));
    return line.length === 1 ? distance(point, line[0]) : value;
  }
  function evaluate(target, input, cfg) {
    if (target.length < 2) return { pass: false, msg: 'おてほんを もういちど ひらいてね' };
    if (!input || input.length < 2 || length(input) < 1) return { pass: false, msg: 'すこし せんを かいてみよう' };
    const start = input[0], end = input[input.length - 1];
    const a = target[0], b = target[target.length - 1];
    if (distance(start, b) + distance(end, a) + 2 < distance(start, a) + distance(end, b))
      return { pass: false, msg: 'ここから、こちらむきに かいてみよう' };
    if (distance(start, a) > cfg.startTol) return { pass: false, msg: 'はじめの しるしから かいてみよう' };
    if (distance(end, b) > cfg.startTol) return { pass: false, msg: 'もうすこし さきまで かいてみよう' };
    const ratio = length(input) / Math.max(1, length(target));
    if (ratio > cfg.maxRatio) return { pass: false, msg: 'ひとふでで、ゆっくり かいてみよう' };
    if (ratio < 0.55) return { pass: false, msg: 'せんの かたちを おもいだしてみよう' };
    const user = resample(input), model = resample(target);
    if (user.filter(p => nearest(p, target) <= cfg.dev).length / user.length < cfg.validRatio)
      return { pass: false, msg: 'せんの かたちを たしかめてみよう' };
    if (model.filter(p => nearest(p, input) <= cfg.dev).length / model.length < cfg.minCoverage)
      return { pass: false, msg: 'せんの つづきを かいてみよう' };
    return { pass: true, msg: 'かけたね' };
  }
  function pack(strokes, width, height) {
    return strokes.map(stroke => stroke.map(p => ({ x: p.x / width, y: p.y / height, t: Math.round(p.t || 0) })));
  }
  function unpack(strokes, width, height) {
    return strokes.map(stroke => stroke.map(p => ({ x: p.x * width, y: p.y * height, t: p.t || 0 })));
  }
  root.MonjiCore = { distance, length, resample, evaluate, pack, unpack };
  if (typeof module !== 'undefined') module.exports = root.MonjiCore;
})(globalThis);
