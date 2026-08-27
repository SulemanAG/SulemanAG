import fs from 'node:fs';

const token = process.env.GITHUB_TOKEN;
const login = process.env.GITHUB_REPOSITORY_OWNER || 'SulemanAG';
if (!token) throw new Error('GITHUB_TOKEN is required');

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-widgets' };

async function graphql(query, variables = {}) {
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || j));
  return j.data;
}

async function getUser() {
  const q = `query($login:String!){ user(login:$login){ login name followers{totalCount} repositories(ownerAffiliations:OWNER, first:100, privacy:PUBLIC){totalCount nodes{stargazerCount languages(first:20, orderBy:{field:SIZE, direction:DESC}){edges{size node{name color}}}}} contributionsCollection { totalCommitContributions totalPullRequestContributions totalIssueContributions totalRepositoryContributions contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
  return (await graphql(q, { login })).user;
}

const user = await getUser();
const out = 'assets/profile-widgets';
fs.mkdirSync(out, { recursive: true });

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const GOLD='#D4AF37', TEXT='#F2F2F2', MUTED='#A0A0A0', BG='#050505', GRID='#222226';

function shell(w,h,title,body){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" rx="10" fill="${BG}"/><rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="10" fill="none" stroke="#252525"/><text x="24" y="31" font-family="monospace" font-size="14" font-weight="700" fill="${GOLD}" letter-spacing="1.2">${esc(title)}</text>${body}</svg>`;
}

// Top languages
const langs = new Map();
for (const repo of user.repositories.nodes) for (const e of repo.languages.edges) langs.set(e.node.name, (langs.get(e.node.name)||0)+e.size);
const top = [...langs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
const total = top.reduce((a,[,v])=>a+v,0)||1;
const colors = ['#D4AF37','#B8892E','#8F6B22','#6F5420','#51431F','#38351F'];
let body='';
let start=-90; const cx=92, cy=112, r=54, sw=18;
for(let i=0;i<top.length;i++){const pct=top[i][1]/total; const end=start+pct*360; const large=(end-start)>180?1:0; const a1=start*Math.PI/180,a2=end*Math.PI/180; const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2); body+=`<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${colors[i]}" stroke-width="${sw}"/>`; start=end;}
body+=`<circle cx="${cx}" cy="${cy}" r="37" fill="${BG}"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="monospace" font-size="12" fill="${MUTED}">LANG</text>`;
top.forEach(([name,val],i)=>{const y=62+i*28; const pct=(val/total*100).toFixed(1); body+=`<circle cx="184" cy="${y-5}" r="4" fill="${colors[i]}"/><text x="198" y="${y}" font-family="monospace" font-size="12" fill="${TEXT}">${esc(name)}</text><text x="${330}" y="${y}" text-anchor="end" font-family="monospace" font-size="11" fill="${MUTED}">${pct}%</text>`;});
fs.writeFileSync(`${out}/top-languages.svg`, shell(360,235,'TOP LANGUAGES',body));

// GitHub stats
const stars=user.repositories.nodes.reduce((a,r)=>a+r.stargazerCount,0);
const c=user.contributionsCollection;
const items=[['CONTRIBUTIONS',c.totalContributions],['COMMITS',c.totalCommitContributions],['PULL REQUESTS',c.totalPullRequestContributions],['ISSUES',c.totalIssueContributions],['REPOSITORIES',user.repositories.totalCount],['STARS',stars]];
body=''; items.forEach(([k,v],i)=>{const col=i%3,row=Math.floor(i/3),x=35+col*135,y=74+row*70;body+=`<text x="${x}" y="${y}" font-family="monospace" font-size="10" fill="${MUTED}">${k}</text><text x="${x}" y="${y+27}" font-family="monospace" font-size="21" font-weight="700" fill="${TEXT}">${esc(v)}</text>`;});
fs.writeFileSync(`${out}/github-stats.svg`, shell(440,225,'GITHUB STATISTICS',body));

// Activity graph from contribution calendar, last 31 days
const days=user.contributionsCollection.contributionCalendar.weeks.flatMap(w=>w.contributionDays).slice(-31);
const vals=days.map(d=>d.contributionCount); const max=Math.max(1,...vals);
const x0=35,y0=175,w=650,h=105; let path=''; vals.forEach((v,i)=>{const x=x0+i*(w/(vals.length-1));const y=y0-h*(v/max);path+=(i?' L ':'M ')+x.toFixed(1)+' '+y.toFixed(1)});
body=`<g opacity="0.45">${[0,1,2,3].map(i=>`<line x1="${x0}" y1="${y0-i*35}" x2="${x0+w}" y2="${y0-i*35}" stroke="${GRID}"/>`).join('')}</g><path d="${path}" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="${path} L ${x0+w} ${y0} L ${x0} ${y0} Z" fill="${GOLD}" opacity="0.08"/>`;
vals.forEach((v,i)=>{const x=x0+i*(w/(vals.length-1));const y=y0-h*(v/max);body+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${TEXT}"/>`;});
body+=`<text x="35" y="205" font-family="monospace" font-size="10" fill="${MUTED}">LAST 31 DAYS</text><text x="685" y="205" text-anchor="end" font-family="monospace" font-size="10" fill="${MUTED}">LIVE FROM GITHUB</text>`;
fs.writeFileSync(`${out}/activity-graph.svg`, shell(720,235,'CONTRIBUTION ACTIVITY',body));

console.log(`Generated profile widgets for ${login}`);
