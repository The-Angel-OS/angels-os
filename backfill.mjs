import pg from 'pg'
const c = new pg.Client({connectionString: process.env.DB, ssl:{rejectUnauthorized:false}})
await c.connect()
// Faithful copy of what the manifests said on 260824 — behavior must not change.
const M = {
  'answer53':              { pub:true, glob:true, dd:'about',   links:[{label:'Answer 53 — original site', url:'https://answer53.vercel.app'}], subs:[] },
  'gpt-psychosis':         { pub:true, glob:true, dd:'readme',  links:[], subs:[] },
  'ready-player-everyone': { pub:true, glob:true, dd:'readme',  links:[], subs:['clearwater-cruisin','kendev'] },
  'wdeg':                  { pub:true, glob:true, dd:'readme',  links:[{label:'WDEG Portal (coming)', url:'https://wheredideveryonego.spacesangels.com'}], subs:['clearwater-cruisin'] },
  'angel-os-handbook':     { pub:true, glob:true, dd:'welcome', links:[], subs:[] },
  'holy-bible':            { pub:true, glob:true, dd:'about',   links:[], subs:['clearwater-cruisin'] },
}
for (const [slug, m] of Object.entries(M)) {
  const cur = await c.query('select subscribers from works where slug=$1', [slug])
  if (!cur.rows.length) { console.log('MISSING', slug); continue }
  const have = Array.isArray(cur.rows[0].subscribers) ? cur.rows[0].subscribers : []
  const subs = Array.from(new Set([...have, ...m.subs]))
  await c.query(
    `update works set published=$2, available_globally=$3, default_doc=$4, links=$5, subscribers=$6,
      opt_outs=coalesce(opt_outs,'[]'::jsonb) where slug=$1`,
    [slug, m.pub, m.glob, m.dd, JSON.stringify(m.links), JSON.stringify(subs)],
  )
}
const r = await c.query('select slug,owner,published,available_globally,default_doc,subscribers,opt_outs from works order by id')
console.table(r.rows.map(x=>({...x, subscribers:JSON.stringify(x.subscribers), opt_outs:JSON.stringify(x.opt_outs), links:undefined})))
await c.end()
