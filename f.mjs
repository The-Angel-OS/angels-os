import pg from 'pg'
const c=new pg.Client({connectionString:process.env.DB,ssl:{rejectUnauthorized:false}});await c.connect()
const cols=await c.query(`select column_name from information_schema.columns where table_name='settings' order by ordinal_position`)
console.log(cols.rows.map(r=>r.column_name).join(', '))
const r=await c.query(`select * from settings where tenant_id=11`)
console.log(JSON.stringify(r.rows,null,1).slice(0,1500))
await c.end()
