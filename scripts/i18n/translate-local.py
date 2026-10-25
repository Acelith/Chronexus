"""Developer-only catalog preparation from static UI strings. Never reads campaign data."""
import json,re,time,urllib.request,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CAT=ROOT/'src/i18n/catalogs'
SOURCE=json.loads((CAT/'it.json').read_text(encoding='utf-8'))
LANGUAGES={'en':'English','de':'German','fr':'French','es':'Spanish','pt-BR':'Brazilian Portuguese','ja':'Japanese','ko':'Korean','zh-Hans':'Simplified Chinese','ar':'Modern Standard Arabic','lmo-CH':'Ticinese Swiss Lombard, draft for native review'}
POLICY=json.loads((ROOT/'src/ai-models.json').read_text(encoding='utf-8'))
MODEL=os.environ.get('CHRONEXUS_TRANSLATION_MODEL',POLICY['primary']['name'])
SPEC=next((s for s in POLICY.values() if s['name']==MODEL),None)
if SPEC is None: raise SystemExit('Modello non qualificato: scegliere Qwen3.8-27B oppure Gemma 4 12B.')
_checked=False
LOG=ROOT/'.tools/m10/translation-progress.json'
def save(path,value):
 temp=path.with_suffix('.pending');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(path)
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def local_json(path,payload=None):
 if path not in ['/api/status','/api/show','/api/generate','/api/ps','/api/chat']:raise ValueError('Percorso locale non ammesso')
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 req=urllib.request.Request('http://127.0.0.1:11434'+path,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with opener.open(req,timeout=300) as response:
  raw=response.read(1048577)
  if len(raw)>1048576:raise ValueError('Risposta AI oltre il limite')
 return json.loads(raw)

def verify_runtime():
 global _checked
 if _checked:return
 if local_json('/api/status').get('cloud',{}).get('disabled') is not True:raise ValueError('Cloud non disabilitato')
 show=local_json('/api/show',{'model':MODEL})
 if show.get('remote_host') or show.get('remote_model') or show.get('details',{}).get('format')!='gguf' or 'sha256-'+SPEC['weightDigest'] not in show.get('modelfile',''):raise ValueError('Pesi locali non qualificati')
 local_json('/api/generate',{'model':MODEL,'prompt':'','stream':False,'keep_alive':'5m','options':{'num_ctx':8192,'num_gpu':SPEC['gpuLayers'],'num_batch':SPEC['batch']}})
 if not any(m.get('name')==MODEL and m.get('size_vram',0)>0 for m in local_json('/api/ps').get('models',[])):raise ValueError('GPU non disponibile')
 _checked=True

def request(items,language):
 verify_runtime()
 indexes={str(i):source for i,(_,source) in enumerate(items)}
 schema={'type':'object','properties':{k:{'type':'string'}for k in indexes},'required':list(indexes),'additionalProperties':False}
 instruction=f'Translate Italian desktop RPG companion UI strings into {language}. Return ONLY a JSON object with the SAME numeric keys. Keep all placeholders such as {{0}} and {{1}} EXACTLY unchanged. Preserve meaning, actions, punctuation and whitespace significance. Do not add facts or explanations. Preserve Chronexus, Nodex, D&D, Markdown, JSON, SQLite, UUID, Ollama, Gemma, Qwen, LoRA, QLoRA, SRD, URLs, API names, dice d4/d6/d8/d10/d12/d20/d100 and technical filenames. Translate labels, errors and help naturally and consistently. Names of companies/models and keyboard shortcuts stay unchanged. This is app UI, not campaign content.'
 if language.startswith('Ticinese'):instruction+=' Use general Ticinese forms (Gionta, impostazion, session, personagg, incantesim) consistently; do not merely repeat standard Italian. There is no claim of a single certified orthography.'
 payload={'model':MODEL,'messages':[{'role':'system','content':instruction},{'role':'user','content':json.dumps(indexes,ensure_ascii=False,separators=(',',':'))}],'format':schema,'stream':False,'think':False,'keep_alive':'20m','options':{'temperature':0,'num_ctx':8192,'num_predict':6000,'num_gpu':SPEC['gpuLayers'],'num_batch':SPEC['batch']}}
 data=local_json('/api/chat',payload)
 if data.get('done_reason')=='length':raise ValueError('Traduzione incompleta')
 translated=json.loads(data['message']['content']);out={}
 for key,(msgid,source) in enumerate(items):
  value=translated.get(str(key))
  if not isinstance(value,str) or not value.strip() or sorted(re.findall(r'\{\d+\}',source))!=sorted(re.findall(r'\{\d+\}',value)):continue
  out[msgid]=value
 return out,data.get('eval_count',0),data.get('eval_duration',0)
def main():
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

if __name__=='__main__':main()
