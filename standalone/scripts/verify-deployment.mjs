import assert from 'node:assert/strict';
const origin='https://kland-kevinsilvester.pages.dev';
const revision=process.env.KLAND_COMMIT_SHA;
assert.match(revision||'',/^[a-f0-9]{40}$/,'A full commit SHA is required');
let failure;
for(let attempt=0;attempt<6;attempt++){
  try{
    const meta=await fetch(`${origin}/build.json?revision=${revision}`,{signal:AbortSignal.timeout(15000)});
    assert.equal(meta.status,200,'Build metadata must be available');
    assert.equal((await meta.json()).revision,revision,'Production must serve this commit');
    const response=await fetch(`${origin}/?revision=${revision}`,{signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    const html=await response.text();
    assert.ok(html.includes(revision),'The entry document must match the deployed revision');
    const asset=html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
    assert.ok(asset,'The entry document must include its app scripts');
    assert.equal((await fetch(origin+asset,{signal:AbortSignal.timeout(15000)})).status,200);
    // Read only: never submit a test score to the real leaderboard.
    const board=await fetch(origin+'/api/scores',{signal:AbortSignal.timeout(15000)});
    assert.equal(board.status,200,'The existing leaderboard must remain readable');
    await board.json();
    console.log(`Verified production revision ${revision}, app script and leaderboard read.`);
    process.exit(0);
  }catch(error){failure=error;if(attempt<5)await new Promise(resolve=>setTimeout(resolve,5000));}
}
throw failure;
