/**
 * Full integration test — exercises the entire pipeline end-to-end.
 * Tests: normalizer → matcher → filter-engine → dom-walker
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function createEnv(html) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'dangerously',
  });
  const window = dom.window;

  window.browser = {
    runtime: { getURL: (p) => p, sendMessage: () => {} },
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener: () => {} },
    },
  };

  window.fetch = async (filePath) => {
    const abs = path.join(__dirname, 'src', filePath);
    const data = fs.readFileSync(abs, 'utf8');
    return { ok: true, json: async () => JSON.parse(data) };
  };

  const load = (f) => window.eval(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'));
  load('shared/constants.js');
  load('shared/logger.js');
  load('shared/normalizer.js');
  load('shared/storage.js');
  load('shared/matcher.js');
  load('content/filter-engine.js');
  load('content/dom-walker.js');

  return { window, document: window.document, CB: window.CleanBrowse };
}

async function testNormalizerUnit() {
  console.log('\n── Normalizer Unit Tests ──');
  const { CB } = createEnv('<p>test</p>');
  const N = CB.Normalizer;

  assert('Lowercase', N.normalize('HELLO') === 'hello');
  assert('Leet: @ss → ass', N.normalize('@ss') === 'ass');
  assert('Leet: $h!t → shit', N.normalize('$h!t') === 'shit');
  assert('Leet: f4ck → fack', N.normalize('f4ck') === 'fack');
  assert('Collapse repeats: fuuuuck → fuck', N.normalize('fuuuuck') === 'fuck');
  assert('Spaced out: f.u.c.k → fuck', N.normalize('f.u.c.k') === 'fuck');
  assert('Zero-width chars stripped', N.normalize('f\u200Bu\u200Dc\u200Bk') === 'fuck');
  assert('Unicode NFKD: accented → plain', N.normalize('fück') === 'fuck');
  assert('Empty string', N.normalize('') === '');
  assert('Null safe', N.normalize(null) === '');
}

async function testWhitelist() {
  console.log('\n── Whitelist / False Positive Tests ──');
  const { CB, document } = createEnv(
    '<p>The assassin had a cocktail at the embassy.</p>' +
    '<p>She went to the therapist in Massachusetts.</p>' +
    '<p>The classic bass guitar has great class.</p>' +
    '<p>The cockpit of the cockroach documentary was fascinating.</p>'
  );

  const matcher = await CB.Matcher.compileMatcher(3, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('assassin not filtered', !document.body.innerHTML.includes('cb-blur'));
  assert('Zero false positives', result.matchCount === 0, 'got ' + result.matchCount);
}

async function testActualProfanity() {
  console.log('\n── Actual Profanity Detection ──');
  const { CB, document } = createEnv(
    '<p>What the fuck is this shit.</p>'
  );

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Detects profanity', result.matchCount >= 2, 'got ' + result.matchCount);
  assert('Blur spans inserted', document.querySelectorAll('.cb-blur').length >= 2);
}

async function testReplaceMode() {
  console.log('\n── Replace Mode ──');
  const { CB, document } = createEnv('<p>What the fuck.</p>');

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'replace', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Replace mode finds matches', result.matchCount >= 1);
  const replaced = document.querySelectorAll('.cb-replaced');
  assert('Replace spans inserted', replaced.length >= 1);
  if (replaced.length > 0) {
    assert('Replaced with asterisks', /^\*+$/.test(replaced[0].textContent),
      'got "' + replaced[0].textContent + '"');
  }
}

async function testRemoveMode() {
  console.log('\n── Remove Mode ──');
  const { CB, document } = createEnv('<p>What the fuck.</p>');

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'remove', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Remove mode finds matches', result.matchCount >= 1);
  const bodyText = document.body.textContent.toLowerCase();
  assert('Profanity removed from text', !bodyText.includes('fuck'), 'body: ' + bodyText);
}

async function testEmojiMode() {
  console.log('\n── Emoji Mode ──');
  const { CB, document } = createEnv('<p>What the fuck.</p>');

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'emoji', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Emoji mode finds matches', result.matchCount >= 1);
  const wrapper = document.querySelectorAll('.cb-emoji-wrapper');
  assert('Emoji wrapper inserted', wrapper.length >= 1);
  if (wrapper.length > 0) {
    const imgs = wrapper[0].querySelectorAll('.cb-emoji');
    // "fuck" is 4 letters, Math.max(1, floor(4/4)) = 1 emoji
    assert('Correct number of emojis inserted (1 for 4 letters)', imgs.length === 1);
    assert('Image src is correct', imgs[0].src.includes('icons/censor-emoji.svg'), 'got ' + imgs[0].src);
  }
}

async function testEvasion() {
  console.log('\n── Evasion Detection ──');

  // Test 1: Leetspeak — µ maps to 'u', so fµck → fuck
  const e1 = createEnv('<p>What the f\u00B5ck.</p>');
  const m1 = await e1.CB.Matcher.compileMatcher(1, [], []);
  const eng1 = e1.CB.FilterEngine.createFilterEngine(m1, 'blur', '*');
  const r1 = e1.CB.DOMWalker.walkAndFilter(e1.document.body, eng1);
  assert('Leetspeak fµck detected', r1.matchCount >= 1, 'got ' + r1.matchCount);

  // Test 2: Repeated chars
  const e2 = createEnv('<p>fuuuuck this.</p>');
  const m2 = await e2.CB.Matcher.compileMatcher(1, [], []);
  const eng2 = e2.CB.FilterEngine.createFilterEngine(m2, 'blur', '*');
  const r2 = e2.CB.DOMWalker.walkAndFilter(e2.document.body, eng2);
  assert('Repeated chars fuuuuck detected', r2.matchCount >= 1, 'got ' + r2.matchCount);

  // Test 3: Spaced out
  const e3 = createEnv('<p>f.u.c.k this.</p>');
  const m3 = await e3.CB.Matcher.compileMatcher(1, [], []);
  const eng3 = e3.CB.FilterEngine.createFilterEngine(m3, 'blur', '*');
  const r3 = e3.CB.DOMWalker.walkAndFilter(e3.document.body, eng3);
  assert('Spaced-out f.u.c.k detected', r3.matchCount >= 1, 'got ' + r3.matchCount);
}

async function testCustomWords() {
  console.log('\n── Custom Words ──');
  const { CB, document } = createEnv('<p>The fluffernutter is delicious.</p>');

  const matcher = await CB.Matcher.compileMatcher(1, ['fluffernutter'], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Custom word detected', result.matchCount >= 1, 'got ' + result.matchCount);
}

async function testRemovedWords() {
  console.log('\n── Removed Words ──');
  const { CB, document } = createEnv('<p>What the fuck and shit.</p>');

  // Remove "fuck" from the default lists
  const matcher = await CB.Matcher.compileMatcher(1, [], ['fuck']);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  const html = document.body.innerHTML;
  assert('Removed word "fuck" is NOT filtered', !html.includes('cb-blur') || result.matchCount <= 1);
}

async function testExcludedTags() {
  console.log('\n── Excluded Tags ──');
  const { CB, document } = createEnv(
    '<p>What the fuck.</p><script>var fuck = true;</script><textarea>fuck</textarea>'
  );

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Only <p> text filtered (not script/textarea)', result.matchCount === 1,
    'got ' + result.matchCount);
}

async function testEmptyPage() {
  console.log('\n── Edge Cases ──');
  const { CB, document } = createEnv('<div></div>');

  const matcher = await CB.Matcher.compileMatcher(1, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Empty page: no crash', result.matchCount === 0);
  assert('Empty page: 0 nodes', result.nodesProcessed === 0);
}

async function testMultipleMatchesSameNode() {
  console.log('\n── Multiple Matches in Same Node ──');
  const { CB, document } = createEnv('<p>fuck this shit damn.</p>');

  const matcher = await CB.Matcher.compileMatcher(2, [], []);
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);

  assert('Multiple matches found', result.matchCount >= 2, 'got ' + result.matchCount);
  assert('Multiple blur spans', document.querySelectorAll('.cb-blur').length >= 2);
}

// ── Run all tests ──────────────────────────────────────────

async function main() {
  console.log('🧪 Clean Browse — Full Integration Test Suite\n');

  await testNormalizerUnit();
  await testWhitelist();
  await testActualProfanity();
  await testReplaceMode();
  await testRemoveMode();
  await testEmojiMode();
  await testEvasion();
  await testCustomWords();
  await testRemovedWords();
  await testExcludedTags();
  await testEmptyPage();
  await testMultipleMatchesSameNode();

  console.log('\n════════════════════════════════════════');
  console.log(`  Total: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
