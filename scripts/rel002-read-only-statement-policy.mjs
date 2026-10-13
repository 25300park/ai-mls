import assert from 'node:assert/strict';
// Diagnostic harness only. This is a narrow lexical guard, not a general SQL parser.
function tokens(sql){
 assert.equal(typeof sql,'string','READINESS_SQL_REQUIRED');
 const out=[];let i=0,terminated=false;
 while(i<sql.length){
  if(/\s/.test(sql[i])){i++;continue;}
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i);i=end<0?sql.length:end;continue;}
  if(sql.startsWith('/*',i)){let depth=1;i+=2;while(i<sql.length&&depth){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}assert.equal(depth,0,'READINESS_SQL_UNTERMINATED');continue;}
  assert.equal(terminated,false,'READINESS_MULTI_STATEMENT_DENIED');
  if(sql[i]===';'){terminated=true;i++;continue;}
  if(sql[i]==="'"||sql[i]==='"'){
   const escaped=sql[i]==="'"&&/[eE]/.test(sql[i-1]??'')&&out.at(-1)==='E';
   if(escaped)out.pop();
   const quote=sql[i++];let value='',closed=false;
   while(i<sql.length){if(escaped&&sql[i]==='\\'){assert.ok(i+1<sql.length,'READINESS_SQL_UNTERMINATED');i+=2;continue;}if(sql[i]===quote){if(sql[i+1]===quote){value+=quote;i+=2;}else{i++;closed=true;break;}}else{value+=sql[i++];}}
   assert.ok(closed,'READINESS_SQL_UNTERMINATED');
   out.push(quote==='"'?value.toUpperCase():'LITERAL');continue;
  }
  if(sql[i]==='$'){
   const tag=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
   if(tag){const end=sql.indexOf(tag,i+tag.length);assert.ok(end>=0,'READINESS_SQL_UNTERMINATED');i=end+tag.length;out.push('LITERAL');continue;}
  }
  const word=sql.slice(i).match(/^[A-Za-z_][A-Za-z0-9_$]*/)?.[0];
  if(word){out.push(word.toUpperCase());i+=word.length;}else{out.push(sql[i++]);}
 }
 assert.ok(out.length,'READINESS_SQL_REQUIRED');return out;
}
const starts=new Set(['BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);
const forbidden=new Set(['INSERT','UPDATE','DELETE','MERGE','TRUNCATE','CREATE','ALTER','DROP','GRANT','REVOKE','COMMENT','SECURITY','COPY','VACUUM','ANALYZE','CLUSTER','REINDEX','LOCK','SET','RESET','CALL','DO','REFRESH','INTO','PG_ADVISORY_LOCK','PG_ADVISORY_XACT_LOCK','PG_TRY_ADVISORY_LOCK','PG_TRY_ADVISORY_XACT_LOCK','PG_NOTIFY','SET_CONFIG','NEXTVAL','SETVAL','PG_TERMINATE_BACKEND','PG_CANCEL_BACKEND']);
export function createReadOnlyStatementPolicy(){
 let state='IDLE';
 return Object.freeze({get state(){return state;},fail(){state=state==='READ_ONLY_TX'?'FAILED_TX':'FAILED_IDLE';},accept(sql){
  try{
   const words=tokens(sql),canonical=words.join(' ');
   if(state==='FAILED_TX'&&canonical==='ROLLBACK'){state='IDLE';return;}
   assert.ok(state!=='FAILED_TX'&&state!=='FAILED_IDLE','READINESS_POLICY_FAILED_CLOSED');
   if(starts.has(canonical)){assert.equal(state,'IDLE','READINESS_NESTED_BEGIN_DENIED');state='READ_ONLY_TX';return;}
   if(canonical==='COMMIT'||canonical==='ROLLBACK'){assert.equal(state,'READ_ONLY_TX','READINESS_TRANSACTION_REQUIRED');state='IDLE';return;}
   assert.ok(words[0]==='SELECT'||words[0]==='WITH','READINESS_SELECT_ONLY_REQUIRED');
   assert.ok(!words.some(word=>forbidden.has(word)),'READINESS_WRITE_OR_AUTHORITY_DENIED');
   assert.ok(!/\bFOR (?:SHARE|KEY SHARE)\b/.test(canonical),'READINESS_ROW_LOCK_DENIED');
  }catch(error){state=state==='READ_ONLY_TX'||state==='FAILED_TX'?'FAILED_TX':'FAILED_IDLE';throw error;}
 }});
}
