"""Developer-only catalog preparation from static UI strings. Never reads campaign data."""
import json,re,time,urllib.request,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CAT=ROOT/'src/i18n/catalogs'
SOURCE=json.loads((CAT/'it.json').read_text(encoding='utf-8'))
LANGUAGES={'en':'English','de':'German','fr':'French','es':'Spanish','pt-BR':'Brazilian Portuguese','ja':'Japanese','ko':'Korean','zh-Hans':'Simplified Chinese','ar':'Modern Standard Arabic','lmo-CH':'Ticinese Swiss Lombard, draft for native review'}
MODEL='qwen3:4b-instruct'
LOG=ROOT/'.tools/m10/translation-progress.json'
def save(path,value):
 temp=path.with_suffix('.pending');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(path)
def request(items,language):
 indexes={str(i):source for i,(_,source) in enumerate(items)}
 schema={'type':'object','properties':{k:{'type':'string'}for k in indexes},'required':list(indexes),'additionalProperties':False}
 instruction=f'Translate Italian desktop RPG companion UI strings into {language}. Return ONLY a JSON object with the SAME numeric keys. Keep all placeholders such as {{0}} and {{1}} EXACTLY unchanged. Preserve meaning, actions, punctuation and whitespace significance. Do not add facts or explanations. Preserve Chronexus, Nodex, D&D, Markdown, JSON, SQLite, UUID, Ollama, Gemma, Qwen, LoRA, QLoRA, SRD, URLs, API names, dice d4/d6/d8/d10/d12/d20/d100 and technical filenames. Translate labels, errors and help naturally and consistently. Names of companies/models and keyboard shortcuts stay unchanged. This is app UI, not campaign content.'
 if language.startswith('Ticinese'):instruction+=' Use general Ticinese forms (Gionta, impostazion, session, personagg, incantesim) consistently; do not merely repeat standard Italian. There is no claim of a single certified orthography.'
 payload={'model':MODEL,'messages':[{'role':'system','content':instruction},{'role':'user','content':json.dumps(indexes,ensure_ascii=False,separators=(',',':'))}],'format':schema,'stream':False,'think':False,'keep_alive':'20m','options':{'temperature':0,'num_ctx':8192,'num_predict':6000}}
 req=urllib.request.Request('http://127.0.0.1:11434/api/chat',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=300) as response:data=json.load(response)
 translated=json.loads(data['message']['content']);out={}
 for key,(msgid,source) in enumerate(items):
  value=translated.get(str(key))
  if not isinstance(value,str) or not value.strip() or sorted(re.findall(r'\{\d+\}',source))!=sorted(re.findall(r'\{\d+\}',value)):continue
  out[msgid]=value
 return out,data.get('eval_count',0),data.get('eval_duration',0)
progress={'model':MODEL,'source':'static UI only','total':len(SOURCE),'completed':{},'failures':[]}
for locale,language in LANGUAGES.items():
 path=CAT/f'{locale}.json';catalog=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
 missing=[(key,value)for key,value in SOURCE.items() if key not in catalog]
 for start in range(0,len(missing),60):
  batch=missing[start:start+60];pending=batch
  for attempt in range(3):
   if not pending:break
   try:
    values,tokens,duration=request(pending,language);catalog.update(values);pending=[item for item in pending if item[0] not in values]
   except Exception as error:
    print(f'{locale} retry {attempt+1}: {error}',flush=True);time.sleep(1)
  if pending:progress['failures'].extend({'locale':locale,'key':key}for key,_ in pending)
  save(path,catalog);progress['completed'][locale]=len(catalog);save(LOG,progress)
  print(f'{locale}: {len(catalog)}/{len(SOURCE)}',flush=True)
 progress['completed'][locale]=len(catalog);save(LOG,progress)
print('DONE '+json.dumps(progress['completed']),flush=True)
if progress['failures']:raise SystemExit('Untranslated entries remain; inspect translation-progress.json')
