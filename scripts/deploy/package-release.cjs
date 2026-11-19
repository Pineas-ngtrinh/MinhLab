const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const entries=['app','src','public','database/migrations','database/seeds','scripts','deploy','package.json','package-lock.json',
  'next.config.mjs','proxy.ts','tsconfig.json','tailwind.config.js','postcss.config.js','eslint.config.mjs',
  'Dockerfile','.dockerignore','compose.yaml','docs/operations/vps-docker.md','docs/operations/minhlab-click-deployment.md',
  'docs/design/custom-print-lifecycle-and-retention.md'];
const files=[];
function walk(name){
  const base=path.basename(name);
  if((base.startsWith('.env')&&!base.endsWith('.example'))||['.cleanup-enabled','__pycache__'].includes(base)
    ||name.startsWith('src/lib/quote/ml/')||name==='src/lib/quote/ml'||/\.(pyc|log)$/.test(name))return;
  const p=path.join(root,name);
  if(!fs.existsSync(p))return;
  const stat=fs.lstatSync(p);
  if(stat.isSymbolicLink())throw new Error(`Release input cannot be a symlink: ${name}`);
  if(stat.isDirectory())for(const child of fs.readdirSync(p).sort())walk(`${name}/${child}`);
  else if(stat.isFile())files.push(name);
}
for(const entry of entries)walk(entry);
if(!files.includes('proxy.ts'))throw new Error('Release is missing proxy.ts; refuse to omit API request protection.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'.local/releases',`minhlab-${stamp}.tar.gz`);
fs.mkdirSync(path.dirname(output),{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'minhlab-release-manifest-'));
try{
  for(const name of files){
    const target=path.join(temp,name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root,name),target);
  }
  fs.writeFileSync(path.join(temp,'RELEASE-MANIFEST.json'),JSON.stringify({createdAt:new Date().toISOString(),
    verification:'See the task review; packaging does not certify deployment readiness.',
    files:files.map(name=>({path:name,sha256:createHash('sha256').update(fs.readFileSync(path.join(temp,name))).digest('hex')}))},null,2)+'\n');
  const result=spawnSync('tar',['-czf',output,'-C',temp,'.'],{stdio:'inherit',env:{...process.env,COPYFILE_DISABLE:'1'}});
  if(result.status!==0){fs.rmSync(output,{force:true});throw new Error('Could not package release.');}
  fs.writeFileSync(output+'.sha256',createHash('sha256').update(fs.readFileSync(output)).digest('hex')+'  '+path.basename(output)+'\n');
  process.stdout.write(`${output}\n${files.length} files packaged; local credentials, databases, build output and training data excluded.\n`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
