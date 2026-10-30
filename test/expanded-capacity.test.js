import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../src/api.js';
import {runScheduler} from '../src/engine.js';

function adapter(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for(const version of ['0001_init','0002_email_alerts','0003_telegram_alerts','0004_reliability']){
    sqlite.exec(readFileSync(new URL('../migrations/'+version+'.sql',import.meta.url),'utf8'));
  }
  const prepare=sql=>{
    let params=[];
    return {
      bind(...values){params=values;return this;},
      first(){return sqlite.prepare(sql).get(...params)||null;},
      all(){return {results:sqlite.prepare(sql).all(...params)};},
      run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};}
    };
  };
  return {sqlite,DB:{prepare,async batch(items){
    sqlite.exec('BEGIN');
    try{const results=items.map(s=>s.run());sqlite.exec('COMMIT');return results;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }}};
}

const request=(path,method='GET',data)=>new Request('https://zrain-monitor-api.workers.dev'+path,{
  method,headers:data?{'Content-Type':'application/json'}:{},
  body:data?JSON.stringify(data):undefined
});
const asUser=uid=>({authenticate:async()=>({uid,email:uid+'@example.com'})});

test('expanded Public Beta permits five per account and 30 total, never more',async()=>{
  const {sqlite,DB}=adapter();
  const env={DB,FIREBASE_PROJECT_ID:'zrain-monitor',ALLOWED_ORIGIN:'https://zrain-monitor.web.app',
    PUBLIC_MONITOR_CREATION:'true',MAX_MONITORS_PER_USER:'5',MAX_GLOBAL_MONITORS:'30'};
  try{
    for(let user=0;user<6;user++){
      const owner=asUser('account'+user);
      assert.equal((await handleAPI(request('/api/me'),env,owner)).status,200);
      for(let monitor=0;monitor<5;monitor++){
        const result=await handleAPI(request('/api/monitors','POST',{
          name:'App '+user+' '+monitor,
          url:'https://app-'+user+'-'+monitor+'.onrender.com/health',
          purpose:'uptime'
        }),env,owner);
        assert.equal(result.status,201);
      }
      if(user===0){
        const over=await handleAPI(request('/api/monitors','POST',{
          name:'Sixth monitor',url:'https://extra.onrender.com/health',purpose:'uptime'
        }),env,owner);
        assert.equal(over.status,409,'per-user limit still enforced');
      }
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM monitors').get().n,30);
    const extra=asUser('extra');
    assert.equal((await handleAPI(request('/api/me'),env,extra)).status,200);
    assert.equal((await handleAPI(request('/api/monitors','POST',{
      name:'Overflow monitor',url:'https://overflow.onrender.com/health',purpose:'uptime'
    }),env,extra)).status,409,'global capacity still enforced');
    const me=await (await handleAPI(request('/api/me'),env,asUser('account0'))).json();
    assert.equal(me.capacity.limit,30);
    assert.equal(me.capacity.mine_limit,5);
    assert.equal(me.capacity.mine,5);

    // A one-minute Cron can claim six due monitors each run. Five runs cover 30.
    const successful=async()=>new Response('ok',{status:200});
    for(let run=0;run<5;run++){
      assert.deepEqual(await runScheduler(env,successful),{claimed:6,succeeded:6,failed:0});
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM check_results').get().n,30);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM monitors WHERE status=?').get('UP').n,30);
  }finally{sqlite.close();}
});
