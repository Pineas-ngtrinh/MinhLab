const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');

function fixture(includeProxy){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'minhlab-package-test-'));
  const put=(name,value)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  put('scripts/deploy/package-release.cjs',fs.readFileSync(path.resolve(__dirname,'../deploy/package-release.cjs')));
  put('.dockerignore',fs.readFileSync(path.resolve(__dirname,'../../.dockerignore')));
  put('package.json','{}');
  put('deploy/.env.runtime','SYNTHETIC_SECRET=fixture-only\n');
  put('deploy/.env.runtime.example','SYNTHETIC_SECRET=\n');
  put('docs/ooad/keep.drawio','<mxfile/>');
  if(includeProxy)put('proxy.ts','export const proxy = () => "request-guard-fixture";\n');
  return root;
}

test('release archive carries the API proxy, verifies its hash and excludes runtime secrets and OOAD',()=>{
  const root=fixture(true);
  try{
    const result=spawnSync(process.execPath,['scripts/deploy/package-release.cjs'],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const directory=path.join(root,'.local/releases');
    const archive=path.join(directory,fs.readdirSync(directory).find(name=>name.endsWith('.tar.gz')));
    const unpack=path.join(root,'unpacked');fs.mkdirSync(unpack);
    const extracted=spawnSync('tar',['-xzf',archive,'-C',unpack],{encoding:'utf8'});
    assert.equal(extracted.status,0,extracted.stderr);
    const manifest=JSON.parse(fs.readFileSync(path.join(unpack,'RELEASE-MANIFEST.json'),'utf8'));
    const proxy=manifest.files.find(file=>file.path==='proxy.ts');
    assert(proxy);
    assert.equal(proxy.sha256,createHash('sha256').update(fs.readFileSync(path.join(unpack,'proxy.ts'))).digest('hex'));
    assert(fs.readFileSync(path.join(unpack,'.dockerignore'),'utf8').split(/\r?\n/).includes('!proxy.ts'));
    assert(fs.existsSync(path.join(unpack,'deploy/.env.runtime.example')));
    assert(!fs.existsSync(path.join(unpack,'deploy/.env.runtime')));
    assert(!fs.existsSync(path.join(unpack,'docs/ooad/keep.drawio')));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('packaging stops when the API request proxy is absent',()=>{
  const root=fixture(false);
  try{
    const result=spawnSync(process.execPath,['scripts/deploy/package-release.cjs'],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/missing proxy\.ts/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
