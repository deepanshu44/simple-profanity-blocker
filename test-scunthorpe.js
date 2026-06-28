const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function testScunthorpe() {
  console.log('Setting up JSDOM environment...');
  
  // Create a simulated DOM
  const dom = new JSDOM(`<!DOCTYPE html>
    <html>
      <body>
        <p>The Scunthorpe problem is the unintentional blocking of websites, e-mails, forum posts or search results by a spam filter or search engine because their text contains a string of letters that appear to have an obscene or otherwise unacceptable meaning.</p>
        <p>Another test case: Don't block the word 'assassin' or 'cocktail' or 'therapist'.</p>
      </body>
    </html>
  `, {
    url: "https://en.wikipedia.org/wiki/Scunthorpe_problem",
    runScripts: "dangerously" 
  });
  
  const window = dom.window;
  const document = window.document;
  
  // Make standard globals available
  global.window = window;
  global.document = document;
  global.self = window;
  global.Node = window.Node;
  global.NodeFilter = window.NodeFilter;

  // Mock the browser extension API needed by matcher and storage
  window.browser = {
    runtime: {
      getURL: (path) => path, // Just return the relative path
      sendMessage: () => {}
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {}
      },
      onChanged: { addListener: () => {} }
    }
  };

  // We need to mock fetch to load our JSON files from the filesystem instead
  window.fetch = async (filePath) => {
    try {
      const absolutePath = path.join(__dirname, 'src', filePath);
      const data = fs.readFileSync(absolutePath, 'utf8');
      return {
        ok: true,
        json: async () => JSON.parse(data)
      };
    } catch (e) {
      console.error('Failed to read file:', filePath, e.message);
      return { ok: false, status: 404 };
    }
  };

  // Load the shared modules in the exact order as manifest.json
  const loadScript = (filePath) => {
    const code = fs.readFileSync(path.join(__dirname, 'src', filePath), 'utf8');
    window.eval(code);
  };

  console.log('Loading extension modules...');
  loadScript('shared/constants.js');
  loadScript('shared/logger.js');
  loadScript('shared/normalizer.js');
  loadScript('shared/storage.js');
  loadScript('shared/matcher.js');
  loadScript('content/filter-engine.js');
  loadScript('content/dom-walker.js');

  const CB = window.CleanBrowse;
  
  console.log('Compiling matcher (Tier 2)...');
  const matcher = await CB.Matcher.compileMatcher(2, [], []);
  
  console.log('Creating filter engine (Blur mode)...');
  const engine = CB.FilterEngine.createFilterEngine(matcher, 'blur', '*');
  
  console.log('Running DOM Walker...');
  const result = CB.DOMWalker.walkAndFilter(document.body, engine);
  
  console.log('--- Results ---');
  console.log(`Nodes Processed: ${result.nodesProcessed}`);
  console.log(`Profanity Matches Found: ${result.matchCount}`);
  
  console.log('\nFinal HTML output:');
  console.log(document.body.innerHTML);
  
  if (result.matchCount === 0) {
    console.log('\n✅ SUCCESS: No false positives were triggered! The whitelist correctly protected words like "Scunthorpe", "assassin", and "cocktail".');
  } else {
    console.log('\n❌ FAILURE: Matches were found, which means false positives occurred.');
  }
}

testScunthorpe().catch(console.error);
