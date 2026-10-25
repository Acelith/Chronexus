import base64
import hashlib
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
import publish_app_update as publisher

class PublisherTests(unittest.TestCase):
    def test_download_paths_are_fixed_to_release_assets_on_forgegit(self):
        valid = 'https://github.com/attachments/01234567-89ab-cdef-0123-456789abcdef'
        self.assertEqual(publisher.allowed_download(valid),valid)
        self.assertEqual(publisher.allowed_download('https://github.com/Acelith/Chronexus/releases/download/v0.4.0/latest.json').split('/')[-1],'latest.json')
        for url in ['https://foreign.example/attachments/abc','http://github.com/attachments/abc','https://github.com/api/v1/user','https://github.com/attachments/abc?token=secret','https://github.com/Acelith/Chronexus/releases/download/../../config']:
            with self.assertRaises(ValueError):publisher.allowed_download(url)

    def test_git_helper_is_scoped_and_never_accepts_another_host(self):
        class Result:
            returncode=0
            stdout='protocol=https\nhost=github.com\nusername=synthetic\npassword=test-only\n'
        with patch.object(publisher.subprocess,'run',return_value=Result()) as run:
            auth=publisher.authorized_git_header()
            self.assertEqual(auth,'Basic '+base64.b64encode(b'synthetic:test-only').decode())
            self.assertEqual(run.call_args.kwargs['input'],'url=https://github.com/Acelith/Chronexus.git\n\n')
        Result.stdout=Result.stdout.replace('github.com','foreign.example')
        with patch.object(publisher.subprocess,'run',return_value=Result()):
            with self.assertRaises(ValueError):publisher.authorized_git_header()

    def test_remote_content_must_match_size_and_hash(self):
        client=publisher.Client('token synthetic')
        expected={'size':4,'sha256':hashlib.sha256(b'test').hexdigest()}
        for payload in [b'bad',b'test!',b'fake']:
            with patch.object(client.opener,'open',return_value=io.BytesIO(payload)):
                with self.assertRaises(ValueError):client.verify('https://github.com/attachments/abc',expected)
        with patch.object(client.opener,'open',return_value=io.BytesIO(b'test')) as opened:
            client.verify('https://github.com/attachments/abc',expected,anonymous=True)
            self.assertNotIn('Authorization',opened.call_args.args[0].headers)

    def test_corrupt_draft_asset_never_finalizes_and_receipt_keeps_no_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);package=root/'installers'/'release';package.mkdir(parents=True)
            notes=root/'docs/releases';notes.mkdir(parents=True);(notes/'v0.4.0.md').write_text('Public notes')
            report={'version':'0.4.0','sourceCommit':'synthetic','assets':[{'name':'latest.json','size':4,'sha256':'a'*64}]}
            calls=[]
            class Fake:
                def __init__(self,authorization):pass
                def api(self,path,method='GET',body=None):
                    calls.append((method,path))
                    if path==publisher.API:return {'full_name':'acelith/Chronexus','private':False,'permissions':{'push':True}}
                    if '/tags/' in path:raise urllib.error.HTTPError('https://github.com',404,'absent',{},None)
                    if method=='POST':return {'id':100,'tag_name':'v0.4.0','draft':True}
                    if path.endswith('/assets'):return []
                    raise AssertionError('Unexpected mutation')
                def upload(self,release,path):return {'id':200,'name':path.name,'size':4,'browser_download_url':'https://github.com/attachments/01234567-89ab-cdef-0123-456789abcdef'}
                def verify(self,*args,**kwargs):raise ValueError('Remote checksum mismatch')
            with patch.object(publisher,'ROOT',root),patch.object(publisher,'validate',return_value=(package,report)),patch.object(publisher,'Client',Fake):
                with self.assertRaises(ValueError):publisher.publish('token synthetic-secret',package,True)
            self.assertFalse(any(method=='PATCH' for method,_ in calls))
            content=(package/'forgejo-update-receipt.json').read_text()
            self.assertNotIn('synthetic-secret',content)
            self.assertEqual(json.loads(content)['releaseId'],100)

if __name__=='__main__':unittest.main()
