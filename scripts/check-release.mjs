import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {resolve,relative,basename} from 'node:path';
// Windows-safe root URL conversion.
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const skip=new Set(['node_modules','.git','dist','.pio','screenshots','test-results','playwright-report']);
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(skip.has(e.name))return [];const p=resolve(dir,e.name);if(e.isSymbolicLink())return [relative(cwd,p).replaceAll('\\','/')];return e.isDirectory()?walk(p):[relative(cwd,p).replaceAll('\\','/')];});}
let files;
try{const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(resolve(top)!==resolve(cwd))throw Error();files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd,encoding:'utf8'}).split('\0').filter(Boolean);}catch{files=walk(cwd);}
const failures=[];
for(const name of [...new Set(files)]){
 const b=basename(name);
 if((/^\.(?:device\.)?env(?:\.|$)/.test(b)&&!b.endsWith('.example'))||b==='secrets.h'||/\.(?:pem|key|p12|pfx|dump|backup)$/i.test(b)||name.includes('.upgrade-backups/'))failures.push(name+': private configuration, key or backup file');
 const path=resolve(cwd,name);if(lstatSync(path).isSymbolicLink()){failures.push(name+': unexpected symlink');continue;}
 const data=readFileSync(path);if(data.includes(0))continue;const text=data.toString('utf8');
 const patterns=[[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'private key'],[/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,'GitHub credential'],[/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,'GitHub credential'],[/\b(?:DEVICE_TOKEN|TOKEN_ENCRYPTION_KEY)\s*[:=]\s*["']?[A-Za-z0-9_+\/-]{43}=?["']?(?:\s|;|$)/m,'literal IoT credential'],[/C:\\Users\\nithi|nithinu174@gmail\.com|192\.168\.20\.8/,'private installation reference']];
 for(const [pattern,reason]of patterns)if(pattern.test(text)&&name!=='scripts/check-release.mjs')failures.push(name+': '+reason);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Release hygiene passed for ${new Set(files).size} candidate files. Review staged diffs; this check is not a complete secret scanner.`);
