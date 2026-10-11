import {manuals} from '../web/src/manuals.js';
import {writeFileSync} from 'node:fs';
let text='# Open IoT — User Manual\n\nMilestone 5.1. Use the exact dashboard address configured in APP_ORIGIN.\n\n';
text+='## Contents\n\n'+manuals.map(m=>'- '+m.title).join('\n')+'\n\n';
for(const m of manuals)text+='## '+m.title+'\n\n'+m.intro+'\n\n**How to use**\n\n'+m.steps.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n\n**Example**\n\n'+m.example+'\n\n**Things to know**\n\n'+m.notes.map(x=>'- '+x).join('\n')+'\n\n**Troubleshooting**\n\n'+m.trouble.map(([q,a])=>'### '+q+'\n\n'+a).join('\n\n')+'\n\n';
writeFileSync(new URL('../docs/USER_MANUAL.md',import.meta.url),text);
console.log('Updated docs/USER_MANUAL.md');
