import fs from 'node:fs';
const base=process.env.MOONLIT_BASE||'http://127.0.0.1:4173';
const three=(a,b,c)=>[{slug:a,orientation:'正位',position:'现状'},{slug:b,orientation:'逆位',position:'阻碍'},{slug:c,orientation:'正位',position:'建议'}];
const cases=[
{id:'career_many_costs',dimension:'职业取舍；多项现实代价与唯一收益',roastLevel:2,question:'我刚来新公司不到三个月，工资高一些，但方向不喜欢、每天很累，还要严格打卡。我下个月该提离职吗？',cards:[{slug:'pentacles-king',orientation:'正位',position:'现状'},{slug:'swords-three',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'career_original_detailed',dimension:'用户原始职场提问；多项已知代价不能被适应期抹掉',roastLevel:2,question:'我应该下个月提离职么？刚去新公司不到三个月，很累，做的不是喜欢的方向，组织的人也古板，觉得挺浪费时间，还要打卡上下班；唯一满足是工资高一点。',cards:[{slug:'pentacles-king',orientation:'正位',position:'现状'},{slug:'swords-three',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'career_countercase',dimension:'相同牌面、相反现实；判断应随事实变化',roastLevel:2,question:'我刚来新公司不到三个月，方向正是我喜欢的，团队也支持我，收入稳定；只是最近两周项目忙、有点累。我下个月该提离职吗？',cards:[{slug:'pentacles-king',orientation:'正位',position:'现状'},{slug:'swords-three',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'wands_work_tradeoff',dimension:'三张权杖正位；工资高但方向不喜欢，须短而有判断且不得编造新计划',roastLevel:2,question:'工资高，但方向不喜欢，这份工作还值得继续吗？',cards:[{slug:'wands-nine',orientation:'正位',position:'现状'},{slug:'wands-ace',orientation:'正位',position:'阻碍'},{slug:'wands-six',orientation:'正位',position:'建议'}]},
{id:'wands_work_countercase',dimension:'同牌面但方向喜欢且有成果；判断不能复制上一例',roastLevel:2,question:'工资还可以，方向也是我喜欢的，最近做的项目有成果，只是连续两周有点累。这份工作还值得继续吗？',cards:[{slug:'wands-nine',orientation:'正位',position:'现状'},{slug:'wands-ace',orientation:'正位',position:'阻碍'},{slug:'wands-six',orientation:'正位',position:'建议'}]},
{id:'procrastination_roast0',dimension:'同题温柔档；清晰事实下的语气控制',roastLevel:0,question:'我这周改了五版计划，却一页提案也没写。明天还要继续改计划吗？',cards:[{slug:'pentacles-eight',orientation:'逆位',position:'此刻的启示'}]},
{id:'procrastination_roast2',dimension:'同题默认毒舌档；有根据的幽默和行动判断',roastLevel:2,question:'我这周改了五版计划，却一页提案也没写。明天还要继续改计划吗？',cards:[{slug:'pentacles-eight',orientation:'逆位',position:'此刻的启示'}]},
{id:'procrastination_roast3',dimension:'同题爆辣档；增加锋利感但不改变事实或结论',roastLevel:3,question:'我这周改了五版计划，却一页提案也没写。明天还要继续改计划吗？',cards:[{slug:'pentacles-eight',orientation:'逆位',position:'此刻的启示'}]},
{id:'relationship_no_reply',dimension:'关系；不能读心，已知行为足以支持适度判断',roastLevel:2,question:'我主动给前任发了三次消息，他都没回复。我还要继续等他主动吗？',cards:[{slug:'cups-eight',orientation:'正位',position:'此刻的启示'}]},
{id:'work_boundary',dimension:'边界；建议可执行且不把牌面当现实证据',roastLevel:2,question:'同事连续三次在下班后发非紧急消息，我每次都回了。我想停止这样做，怎么开口？',cards:three('justice','swords-seven','wands-seven')},
{id:'compound_career',dimension:'复合问题；准备离职与新面试可能性都须回应',roastLevel:2,question:'我应该准备离职么，会有新的面试工作计划么？',cards:three('swords-six','wands-page','swords-nine')},
{id:'sparse_work',dimension:'事实稀少；不得编工作状况与隐藏情绪',roastLevel:2,question:'这份工作还值得继续吗？',cards:three('hanged-man','swords-king','wands-five')},
{id:'world_sparse_work',dimension:'世界正位不等于离职；圣杯王后阻碍位不等于逆位或替人着想',roastLevel:2,question:'这份工作还值得继续吗？',cards:[{slug:'world',orientation:'正位',position:'现状'},{slug:'cups-queen',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'world_work_positive',dimension:'同牌面积极现实；不可自动导向离职',roastLevel:2,question:'这份工作还值得继续吗？我现在能做喜欢的项目，工资也符合预期，团队愿意合作，我还在学新东西。',cards:[{slug:'world',orientation:'正位',position:'现状'},{slug:'cups-queen',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'world_work_negative',dimension:'同牌面消极现实；判断应响应已知代价',roastLevel:2,question:'这份工作还值得继续吗？项目已收尾，接下来半年没有新职责，工资低于我能接受的水平，我也谈过但没有变化。',cards:[{slug:'world',orientation:'正位',position:'现状'},{slug:'cups-queen',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'world_reversed_work',dimension:'世界逆位方向对照；区分停滞与完成',roastLevel:2,question:'这份工作还值得继续吗？',cards:[{slug:'world',orientation:'逆位',position:'现状'},{slug:'cups-queen',orientation:'正位',position:'阻碍'},{slug:'cups-three',orientation:'正位',position:'建议'}]},
{id:'chariot_pages_sparse',dimension:'战车与两张逆位侍从；稀疏输入不能脑补同事传话或套职业账本',roastLevel:2,question:'这份工作还值得继续吗？',cards:[{slug:'chariot',orientation:'正位',position:'现状'},{slug:'pentacles-page',orientation:'逆位',position:'阻碍'},{slug:'swords-page',orientation:'逆位',position:'建议'}]},
{id:'chariot_pages_positive',dimension:'相同牌面，用户明确有成果和可靠信息时判断须随事实改变',roastLevel:2,question:'这份工作还值得继续吗？我喜欢现在的方向，项目每月有新成果，工资稳定；我直接和主管确认过下一阶段职责，信息很清楚。',cards:[{slug:'chariot',orientation:'正位',position:'现状'},{slug:'pentacles-page',orientation:'逆位',position:'阻碍'},{slug:'swords-page',orientation:'逆位',position:'建议'}]},
{id:'chariot_pages_negative',dimension:'相同牌面，用户明确投入无成果且信息混乱时不得泛泛劝继续',roastLevel:2,question:'这份工作还值得继续吗？我已经连续四个月加班，工资没涨，也没有学到新东西；主管两次说会给我新项目，但都没落实。',cards:[{slug:'chariot',orientation:'正位',position:'现状'},{slug:'pentacles-page',orientation:'逆位',position:'阻碍'},{slug:'swords-page',orientation:'逆位',position:'建议'}]},
{id:'vulnerable_roast3',dimension:'用户明确难过；即使选择爆辣也应降强度',roastLevel:3,question:'面试没通过，我这几天很难过，也开始怀疑自己。我想知道接下来该怎么调整，请说得温柔一点。',cards:[{slug:'star',orientation:'正位',position:'此刻的启示'}]}
];
const catalogue=(await(await fetch(base+'/api/cards')).json()).cards;for(const item of cases){for(const c of item.cards){if(!catalogue.some(x=>x.slug===c.slug))throw new Error('Unknown card '+c.slug)}}
const only=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6).split(',');
const selected=only?cases.filter(item=>only.includes(item.id)):cases;
const results=[];const output=process.env.MOONLIT_OUTPUT||'/tmp/moonlit-persona-style-results.json';
const batchSize=Math.max(1,Math.min(2,Number(process.env.MOONLIT_BATCH_SIZE)||2));
for(let i=0;i<selected.length;i+=batchSize){
 const batch=selected.slice(i,i+batchSize);
 const rows=await Promise.all(batch.map(async item=>{const t=Date.now();try{const response=await fetch(base+'/api/reading/followup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:item.question,cards:item.cards,roastLevel:item.roastLevel}),signal:AbortSignal.timeout(300000)});const x=await response.json();return {...item,status:response.status,elapsedMs:Date.now()-t,error:x.error||null,agentOutput:x.agentOutput||null,agentTrace:x.agentTrace||null}}catch(e){return {...item,status:null,elapsedMs:Date.now()-t,error:e.message,agentOutput:null,agentTrace:null}}}));
 results.push(...rows);fs.writeFileSync(output,JSON.stringify(results,null,2));
 for(const row of rows)console.log(JSON.stringify({id:row.id,status:row.status,ms:row.elapsedMs,attempts:row.agentTrace?.attempts,error:row.error,verdict:row.agentOutput?.response?.verdict}));
}
